import type {
  Merchant,
  PaymentForm,
  ResponseAuth,
  SaleProblemDetails,
  SaleRequest,
  SaleResponse,
} from '@/types'

const DEFAULT_CURRENCY = import.meta.env.VITE_PAYMENTS_CURRENCY?.trim() || 'USD'

function normalizeCardNumber(cardNumber: string): string {
  return cardNumber.replace(/\s+/g, '')
}

function allPresent(values: Array<string | undefined>): boolean {
  return values.every((value) => (value?.trim() ?? '') !== '')
}

function toExpirationDate(month: string, year: string): string {
  const yy = year.trim().slice(-2)
  const mm = month.trim().padStart(2, '0')
  return `${yy}${mm}`
}

function toInvoice(invoice: string): number {
  const digits = invoice.replace(/\D/g, '')
  const value = parseInt(digits, 10)
  return Number.isFinite(value) && value > 0 ? value : Date.now()
}

export function buildSaleRequest(params: {
  merchant: Merchant
  form: PaymentForm
  currency?: string
}): SaleRequest {
  const { merchant, form } = params
  const currency = params.currency?.trim() || DEFAULT_CURRENCY

  const authenticationInformation = allPresent([merchant.authenticationEci, merchant.authenticationCavv])
    ? {
      eci: merchant.authenticationEci!.trim(),
      cavv: merchant.authenticationCavv!.trim(),
      xid: merchant.authenticationXid?.trim() || undefined,
      enrollmentStatus: merchant.authenticationEnrollmentStatus?.trim() || undefined,
    }
    : null

  const tokenizationInformation = allPresent([
    merchant.wallet,
    merchant.device,
    merchant.paymentIndicator,
    merchant.cryptogramEci,
    merchant.cryptogram,
  ])
    ? {
      wallet: merchant.wallet!.trim(),
      device: merchant.device!.trim(),
      paymentIndicator: merchant.paymentIndicator!.trim(),
      cryptogramEci: merchant.cryptogramEci!.trim(),
      cryptogram: merchant.cryptogram!.trim(),
    }
    : null

  const processingInformation = allPresent([merchant.errorCentinel, merchant.statusReason])
    ? {
      errorCentinel: merchant.errorCentinel!.trim(),
      statusReason: merchant.statusReason!.trim(),
    }
    : null

  return {
    terminalId: merchant.terminalId,
    transactionType: 'SALE',
    totalAmount: form.amount,
    currency,
    accountNumber: normalizeCardNumber(form.creditCard),
    expirationDate: toExpirationDate(form.expirationMonth, form.expirationYear),
    invoice: toInvoice(form.invoice),
    securityCodeEntry: form.cvv,
    securityValidationResponse: merchant.securityValidationResponse?.trim() || '1',
    binValidate: merchant.binValidate ?? false,
    authenticationInformation,
    tokenizationInformation,
    processingInformation,
  }
}

// In dev, '/api/v1/sales' is intercepted by the devApiPlugin proxy in
// vite.config.ts. In production there's no such dev server, so the built
// site needs an absolute URL to the deployed sales-proxy-function instead —
// set via VITE_SALES_PROXY_URL. Either way, we never call
// appgateway-hackhathon-api directly: the sale-api client secret must stay
// server-side (Client Credentials can't be exchanged from a browser).
const SALES_PROXY_URL = import.meta.env.VITE_SALES_PROXY_URL?.trim() || '/api/v1/sales'

export async function sendSaleTransaction(
  request: SaleRequest,
  options?: { correlationId?: string },
): Promise<Response> {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (options?.correlationId) {
    headers.set('X-Correlation-Id', options.correlationId)
  }

  return fetch(SALES_PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  })
}

export function mapSaleResponseToResult(response: SaleResponse): ResponseAuth {
  const auth = response.authorization
  return {
    transactionId: response.transactionId,
    responseCode: auth?.responseCode,
    responseCodeDescription: auth?.responseDescription,
    authorizationNumber: auth?.authorizationNumber,
    referenceNumber: auth?.referenceNumber,
    hostDate: auth?.hostDate,
    hostTime: auth?.hostTime,
    provider: auth?.authorizationSource,
    status: response.status,
    processedAt: response.processingDateTime ?? response.createdAt,
  }
}

export function toProblemMessage(problem: SaleProblemDetails, fallback: string): string {
  const title = problem.title?.trim()
  const detail = problem.detail?.trim()
  if (title && detail) return `${title}: ${detail}`
  if (title) return title
  if (detail) return detail
  return fallback
}
