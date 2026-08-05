import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ── Playwright runner ──────────────────────────────────────────────────────────

let _browser: import('playwright').Browser | null = null

async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    const { chromium } = await import('playwright')
    _browser = await chromium.launch({ headless: true })
  }
  return _browser
}

async function playwrightRunCase(body: {
  caseId: number
  card: string; month: string; year: string; cvv: string; amount: number
  merchant: Record<string, unknown>; sdkUrl: string
}, baseUrl: string): Promise<Record<string, unknown>> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  let hadChallenge = false

  let resolveResult!: (v: Record<string, unknown>) => void
  const resultPromise = new Promise<Record<string, unknown>>(r => { resolveResult = r })

  // Expose a Node-side callback the page can invoke
  await page.exposeFunction('__pwResult__', (data: Record<string, unknown>) => {
    const t = data.type as string
    if (t === 'challenge_solving') {
      hadChallenge = true
    } else if (t === 'result') {
      resolveResult({ ...data, hadChallenge })
    }
  })

  // Intercept window.parent.postMessage — when loaded directly, parent === self
  await page.addInitScript(() => {
    const orig = window.postMessage.bind(window)
    window.postMessage = function (msg: unknown, ...args: unknown[]) {
      if (msg && typeof msg === 'object') {
        const pw = (window as Record<string, unknown>).__pwResult__ as ((d: unknown) => void) | undefined
        pw?.(msg)
      }
      return (orig as (...a: unknown[]) => unknown)(msg, ...args)
    }
  })

  // Fill challenge input in any attached frame (works cross-origin via Playwright)
  page.on('frameattached', async (frame) => {
    try {
      await frame.waitForSelector('input[name="challengeDataEntry"]', { timeout: 25000 })
      hadChallenge = true
      await frame.fill('input[name="challengeDataEntry"]', '1234')
      await new Promise(r => setTimeout(r, 700))
      await frame.evaluate(() => {
        const form = document.querySelector<HTMLFormElement>('form[name="cardholderInput"]')
          ?? document.forms[0]
        if (!form) return
        const btn = form.querySelector<HTMLElement>(
          'input[type="submit"].primary, input[type="submit"][class*="primary"], input[type="submit"], button[type="submit"]'
        )
        btn ? btn.click() : form.submit()
      })
    } catch { /* frame detached or no challenge in this frame */ }
  })

  const params = new URLSearchParams({
    caseId: String(body.caseId),
    card:   body.card,
    month:  body.month,
    year:   body.year,
    cvv:    body.cvv,
    amount: String(body.amount),
    m:      Buffer.from(JSON.stringify(body.merchant)).toString('base64'),
    sdkUrl: body.sdkUrl,
  })

  try {
    await page.goto(`${baseUrl}/runner?${params}`, { waitUntil: 'domcontentloaded', timeout: 15000 })

    return await Promise.race([
      resultPromise,
      new Promise<Record<string, unknown>>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 55000)
      ),
    ])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { status: msg === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR', hadChallenge, message: msg }
  } finally {
    await page.close().catch(() => {})
  }
}

// ── Sale API proxy (Client Credentials) ─────────────────────────────────────
// The sale-api App Registration is a confidential client (has a secret), so the
// token exchange must happen here (Node, dev-only) and never in browser code —
// a VITE_-prefixed secret would ship inside the built JS bundle.
let cachedSalesToken: { value: string; expiresAt: number } | null = null

async function getSalesApiToken(env: Record<string, string>): Promise<string> {
  const now = Date.now()
  if (cachedSalesToken && cachedSalesToken.expiresAt - 30_000 > now) {
    return cachedSalesToken.value
  }

  const tenantId = env.AZURE_SALES_TENANT_ID
  const clientId = env.AZURE_SALES_CLIENT_ID
  const clientSecret = env.AZURE_SALES_CLIENT_SECRET
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Faltan AZURE_SALES_TENANT_ID / AZURE_SALES_CLIENT_ID / AZURE_SALES_CLIENT_SECRET en .env')
  }
  const audience = env.AZURE_SALES_AUDIENCE?.trim() || `api://${clientId}`

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: `${audience}/.default`,
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) {
    throw new Error(`No se pudo obtener token AAD: ${res.status} ${await res.text()}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  cachedSalesToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return cachedSalesToken.value
}

async function proxySaleRequest(
  env: Record<string, string>,
  body: Buffer,
  correlationId: string | string[] | undefined,
): Promise<{ status: number; contentType: string; body: string }> {
  const token = await getSalesApiToken(env)
  const baseUrl = env.AZURE_SALES_API_BASE_URL?.trim() || 'https://appgateway-hackhathon-api.azurewebsites.net'

  const upstream = await fetch(`${baseUrl}/api/v1/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(correlationId ? { 'X-Correlation-Id': String(correlationId) } : {}),
    },
    body: body.toString('utf-8'),
  })

  return {
    status: upstream.status,
    contentType: upstream.headers.get('content-type') ?? 'application/json',
    body: await upstream.text(),
  }
}

// ── Dev-server API middlewares ────────────────────────────────────────────────
// Registered via a plugin's configureServer hook — `server.configureServer` is
// not a real Vite option, it must live on a plugin to actually be wired up.
function devApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: '3ds-tester-dev-api',
    configureServer(server) {

      // ── Sale API proxy — injects AAD Bearer token, keeps secret server-side ──
      server.middlewares.use('/api/v1/sales', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          proxySaleRequest(env, Buffer.concat(chunks), req.headers['x-correlation-id'])
            .then(({ status, contentType, body }) => {
              res.writeHead(status, { 'Content-Type': contentType })
              res.end(body)
            })
            .catch((err) => {
              res.writeHead(502, { 'Content-Type': 'application/problem+json' })
              res.end(JSON.stringify({ title: 'Proxy error', detail: err instanceof Error ? err.message : String(err) }))
            })
        })
      })

      // ── Playwright case runner ───────────────────────────────────────────────
      server.middlewares.use('/api/run-case', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          let body: Parameters<typeof playwrightRunCase>[0]
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) }
          catch { res.writeHead(400); res.end('Bad JSON'); return }

          const baseUrl = `http://${req.headers.host}`
          playwrightRunCase(body, baseUrl)
            .then(result => {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(result))
            })
            .catch(err => {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ status: 'ERROR', message: String(err) }))
            })
        })
      })

      // ── Maintenance API — custom cards & saved terminals ───────────────────
      function readBody(req: IncomingMessage): Promise<Buffer> {
        return new Promise((res, reject) => {
          const chunks: Buffer[] = []
          req.on('data', (c: Buffer) => chunks.push(c))
          req.on('end', () => res(Buffer.concat(chunks)))
          req.on('error', reject)
        })
      }

      const merchantsConfigPath = resolve(__dirname, 'src/config/merchants.config.json')
      const cardsConfigPath = resolve(__dirname, 'src/config/cards.config.json')

      server.middlewares.use('/api/config/merchants', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          const config = JSON.parse(fs.readFileSync(merchantsConfigPath, 'utf-8'))
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(config.merchants))
          return
        }
        if (req.method === 'PUT') {
          readBody(req).then((buf) => {
            let merchants: unknown
            try { merchants = JSON.parse(buf.toString('utf-8')) }
            catch { res.writeHead(400); res.end('Bad JSON'); return }
            const config = JSON.parse(fs.readFileSync(merchantsConfigPath, 'utf-8'))
            config.merchants = merchants
            fs.writeFileSync(merchantsConfigPath, JSON.stringify(config, null, 2) + '\n')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(config.merchants))
          }).catch((err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ message: String(err) }))
          })
          return
        }
        res.writeHead(405); res.end()
      })

      server.middlewares.use('/api/config/cards', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          const config = JSON.parse(fs.readFileSync(cardsConfigPath, 'utf-8'))
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(config.cards))
          return
        }
        if (req.method === 'PUT') {
          readBody(req).then((buf) => {
            let cards: unknown
            try { cards = JSON.parse(buf.toString('utf-8')) }
            catch { res.writeHead(400); res.end('Bad JSON'); return }
            fs.writeFileSync(cardsConfigPath, JSON.stringify({ cards }, null, 2) + '\n')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(cards))
          }).catch((err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ message: String(err) }))
          })
          return
        }
        res.writeHead(405); res.end()
      })

      // ── ACS challenge proxy ────────────────────────────────────────────────
      // Kept as fallback for manual testing in PaymentView.
      server.middlewares.use('/acs-proxy', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const encodedUrl = (req.url ?? '/').replace(/^\//, '')
        if (!encodedUrl) return next()

        let targetUrl: URL
        try { targetUrl = new URL(decodeURIComponent(encodedUrl)) }
        catch { return next() }

        const bodyChunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => bodyChunks.push(chunk))
        req.on('end', () => {
          const body = Buffer.concat(bodyChunks)

          const options: https.RequestOptions = {
            hostname: targetUrl.hostname,
            port:     targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path:     targetUrl.pathname + targetUrl.search,
            method:   req.method,
            headers: {
              host:              targetUrl.hostname,
              'accept-encoding': 'identity',
              'user-agent':      req.headers['user-agent'] ?? 'Mozilla/5.0',
              ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}),
              ...(req.headers['cookie']       ? { cookie:         req.headers['cookie']        } : {}),
              ...(body.length > 0             ? { 'content-length': String(body.length)        } : {}),
            },
          }

          const protocol = targetUrl.protocol === 'https:' ? https : http
          const proxyReq = protocol.request(options, (proxyRes) => {
            const headers: Record<string, string | string[] | undefined> = {
              ...proxyRes.headers as Record<string, string | string[] | undefined>,
            }
            delete headers['content-security-policy']
            delete headers['content-security-policy-report-only']
            delete headers['x-frame-options']
            delete headers['content-length']

            if (
              proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 &&
              typeof headers['location'] === 'string' &&
              /cardinalcommerce\.com/i.test(headers['location'])
            ) {
              headers['location'] = `/acs-proxy/${encodeURIComponent(headers['location'])}`
              res.writeHead(proxyRes.statusCode, headers)
              res.end()
              return
            }

            const chunks: Buffer[] = []
            proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk))
            proxyRes.on('end', () => {
              const responseBody = Buffer.concat(chunks)
              res.writeHead(proxyRes.statusCode ?? 200, headers)
              res.end(responseBody)
            })
          })

          proxyReq.on('error', (err) => {
            console.error('[acs-proxy] Error:', err.message)
            res.writeHead(502)
            res.end(`Proxy error: ${err.message}`)
          })

          if (body.length > 0) proxyReq.write(body)
          proxyReq.end()
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), devApiPlugin(env)],
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
    server: {
      fs: { strict: false },
    },
  }
})
