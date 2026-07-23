<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { Merchant } from '@/types'
import { getToken, generateOrderId, decodeJwtPayload } from '@/utils/jwt'
import { doubleToIso, generateInvoice } from '@/utils/currency'
import { loadSdkUrl } from '@/composables/useSdkSource'

// ── URL params ────────────────────────────────────────────────────────────────
const sp = new URLSearchParams(window.location.search)
const caseId   = Number(sp.get('caseId') ?? 0)
const card     = sp.get('card')   ?? ''
const month    = sp.get('month')  ?? '01'
const year     = sp.get('year')   ?? '2027'
const cvv      = sp.get('cvv')    ?? '123'
const amount   = Number(sp.get('amount') ?? 500)
const merchant = JSON.parse(atob(sp.get('m') ?? btoa('{}'))) as Merchant
const sdkUrl   = sp.get('sdkUrl') ?? ''

const invoice = generateInvoice()

// ── Random cardholder data ────────────────────────────────────────────────────
const FIRST_NAMES = ['Andrés','María','José','Ana','Luis','Laura','Diego','Sofía','Fabián','Daniela']
const LAST_NAMES  = ['Ramírez','Soto','Mora','Jiménez','Vargas','Castillo','Rojas','Arias','Chaves','Solís']
const ADDRESSES   = ['Barrio Escalante, San José','Desamparados, San José','Curridabat, San José','Heredia Centro, Heredia','Alajuela Centro, Alajuela']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

const fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
const address  = pick(ADDRESSES)
const phone    = `+506${pick(['6','7','8'])}${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`
const email    = `${fullName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'.')}${Math.floor(Math.random()*900)+100}@gmail.com`

// ── postMessage helper ────────────────────────────────────────────────────────
function post(payload: Record<string, unknown>) {
  window.parent.postMessage({ caseId, ...payload }, window.location.origin)
}

// ── Challenge auto-solver ─────────────────────────────────────────────────────
let observer: MutationObserver | null = null
let challengeSolved = false
let challengePoller: ReturnType<typeof setInterval> | null = null

function solveChallenge(el: HTMLInputElement, ownerDoc: Document) {
  if (challengeSolved) return
  challengeSolved = true

  el.focus()
  el.value = '1234'
  el.dispatchEvent(new Event('input',  { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))

  post({ type: 'challenge_solving' })

  // Target primary submit only — not RESEND / CANCEL
  const form = el.closest('form')
  const btn  = form?.querySelector<HTMLElement>('input[type="submit"].primary, input[type="submit"][class*="primary"]')
            ?? form?.querySelector<HTMLElement>('input[type="submit"], button[type="submit"]')
            ?? ownerDoc.querySelector<HTMLElement>('input[type="submit"].primary')

  // Wait for parent to show the iframe before submitting
  setTimeout(() => {
    if (btn) {
      btn.click()
    } else {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      el.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', bubbles: true }))
    }
  }, 900)
}

function checkDoc(doc: Document) {
  if (challengeSolved) return
  try {
    // Specific challenge input first
    const named = doc.querySelector<HTMLInputElement>('input[name="challengeDataEntry"]')
    if (named && named.value === '') { solveChallenge(named, doc); return }

    // Fallback: any empty visible text input outside #runner-form
    const inputs = doc.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input[type="tel"], input[type="number"], input:not([type])',
    )
    for (const el of inputs) {
      if (el.value !== '' || el.closest('#runner-form')) continue
      solveChallenge(el, doc)
      break
    }
  } catch { /* cross-origin */ }
}

// Scan all iframes accessible in a document (recursive up to 4 levels deep)
function scanIframes(root: Document, depth = 0) {
  if (depth > 4) return
  try {
    root.querySelectorAll<HTMLIFrameElement>('iframe').forEach(iframe => {
      try {
        const doc = iframe.contentDocument
        if (doc) {
          checkDoc(doc)
          scanIframes(doc, depth + 1)
        }
      } catch { /* cross-origin */ }
    })
  } catch { /* cross-origin root */ }
}

function watchForChallenge() {
  // MutationObserver on runner's own document
  observer = new MutationObserver(() => {
    if (challengeSolved) return
    checkDoc(document)
    scanIframes(document)
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // Polling fallback — catches cases where document.write() replaces the iframe doc
  // so MutationObserver has a stale reference
  challengePoller = setInterval(() => {
    if (challengeSolved) {
      if (challengePoller) { clearInterval(challengePoller); challengePoller = null }
      return
    }
    checkDoc(document)
    scanIframes(document)
  }, 400)
}

// ── Intercept Cardinal iframe URLs → same-origin proxy ────────────────────────
// Must run BEFORE the SDK loads so that any iframe the SDK creates for the
// challenge page is redirected through /acs-proxy and becomes same-origin.
function interceptCardinalIframes() {
  const proto = HTMLIFrameElement.prototype
  const desc  = Object.getOwnPropertyDescriptor(proto, 'src')

  function proxyCardinal(url: string): string {
    if (url && /cardinalcommerce\.com/i.test(url)) {
      return `/acs-proxy/${encodeURIComponent(url)}`
    }
    return url
  }

  // Intercept .src property setter
  if (desc?.set) {
    Object.defineProperty(proto, 'src', {
      get: desc.get,
      set(url: string) { desc.set!.call(this, proxyCardinal(url)) },
      configurable: true,
    })
  }

  // Fallback: intercept setAttribute('src', ...)
  const origSetAttr = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (name: string, value: string) {
    if (this instanceof HTMLIFrameElement && name === 'src') {
      value = proxyCardinal(value)
    }
    origSetAttr.call(this, name, value)
  }
}

// ── Main flow ─────────────────────────────────────────────────────────────────
let timeoutHandle: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  post({ type: 'started' })

  interceptCardinalIframes()

  try {
    await loadSdkUrl(sdkUrl, `safekey-runner-${caseId}`)
  } catch {
    post({ type: 'result', status: 'ERROR', message: 'No se pudo cargar el SDK' })
    return
  }

  if (!window.BacSecurePay) {
    post({ type: 'result', status: 'ERROR', message: 'BacSecurePay no encontrado en window' })
    return
  }

  let token: string
  try {
    const orderId = generateOrderId()
    token = await getToken(orderId, doubleToIso(amount), merchant.terminalId, merchant, invoice)
  } catch (err) {
    post({ type: 'result', status: 'ERROR', message: `Token: ${(err as Error).message}` })
    return
  }

  watchForChallenge()

  timeoutHandle = setTimeout(() => {
    observer?.disconnect()
    if (challengePoller) { clearInterval(challengePoller); challengePoller = null }
    post({ type: 'result', status: 'TIMEOUT' })
  }, 45_000)

  try {
    window.BacSecurePay.Init({
      Token: token,
      PublicKey: merchant.publicKey,
      LoadSongBird: false,
      Continue: () => window.BacSecurePay?.Pay(),
      callback: (data) => {
        if (timeoutHandle) clearTimeout(timeoutHandle)
        observer?.disconnect()
        if (challengePoller) { clearInterval(challengePoller); challengePoller = null }

        if (data.Token === 'FAILURE') {
          post({ type: 'result', status: 'FAILURE' })
        } else {
          const decoded = decodeJwtPayload<{ Response?: Record<string, unknown> }>(data.Token)
          post({ type: 'result', status: 'SUCCESS', response: decoded?.Response ?? decoded })
        }
      },
    })
  } catch (err) {
    if (timeoutHandle) clearTimeout(timeoutHandle)
    observer?.disconnect()
    if (challengePoller) { clearInterval(challengePoller); challengePoller = null }
    post({ type: 'result', status: 'ERROR', message: (err as Error).message })
  }
})

onUnmounted(() => {
  observer?.disconnect()
  if (challengePoller) { clearInterval(challengePoller); challengePoller = null }
  if (timeoutHandle) clearTimeout(timeoutHandle)
})
</script>

<template>
  <!-- Hidden SDK inputs — read by BacSecurePay via dpmp-field attribute -->
  <div id="runner-form">
    <input type="hidden" dpmp-field="CardNumber"      data-cardinal-field="AccountNumber" :value="card" />
    <input type="hidden" dpmp-field="CardExpMonth"    data-cardinal-field="ExpMonth"      :value="month" />
    <input type="hidden" dpmp-field="CardExpYear"     data-cardinal-field="ExpYear"       :value="year" />
    <input type="hidden" dpmp-field="Cvv"             data-cardinal-field="CVV"           :value="cvv" />
    <input type="hidden" dpmp-field="Amount"   :value="amount" />
    <input type="hidden" dpmp-field="Invoice"  :value="invoice" />
    <input type="hidden" dpmp-field="BillingFullName"  :value="fullName" />
    <input type="hidden" dpmp-field="BillingAddress1"  :value="address" />
    <input type="hidden" dpmp-field="MobilePhone"      data-cardinal-field="MobilePhone" :value="phone" />
    <input type="hidden" dpmp-field="Email"            data-cardinal-field="Email"       :value="email" />
  </div>
</template>
