import { app } from '@azure/functions'

// Same logic as the devApiPlugin proxy in the frontend's vite.config.ts,
// packaged as a standalone Azure Function so the deployed (static) frontend
// has something server-side to call. The sale-api App Registration is a
// confidential client (has a secret) — Client Credentials can only be
// exchanged server-side, Microsoft's token endpoint does not allow the real
// token POST from a browser origin (confirmed: preflight OPTIONS advertises
// CORS, the actual POST response does not).

let cachedToken = null

async function getSalesApiToken() {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - 30_000 > now) {
    return cachedToken.value
  }

  const tenantId = process.env.AZURE_SALES_TENANT_ID
  const clientId = process.env.AZURE_SALES_CLIENT_ID
  const clientSecret = process.env.AZURE_SALES_CLIENT_SECRET
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Faltan AZURE_SALES_TENANT_ID / AZURE_SALES_CLIENT_ID / AZURE_SALES_CLIENT_SECRET en Application Settings')
  }
  const audience = (process.env.AZURE_SALES_AUDIENCE || `api://${clientId}`).trim()

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

  const data = await res.json()
  cachedToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return cachedToken.value
}

app.http('salesProxy', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'v1/sales',
  handler: async (request) => {
    let token
    try {
      token = await getSalesApiToken()
    } catch (err) {
      return {
        status: 502,
        jsonBody: { title: 'Proxy auth error', detail: err instanceof Error ? err.message : String(err) },
      }
    }

    const baseUrl = (process.env.AZURE_SALES_API_BASE_URL || 'https://appgateway-hackhathon-api.azurewebsites.net').trim()
    const correlationId = request.headers.get('x-correlation-id')
    const body = await request.text()

    const upstream = await fetch(`${baseUrl}/api/v1/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
      },
      body,
    })

    return {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
      body: await upstream.text(),
    }
  },
})
