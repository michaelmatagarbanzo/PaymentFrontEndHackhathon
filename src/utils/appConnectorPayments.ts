import type {
  AppConnectorPaymentRequest,
  AppConnectorPaymentResponse,
  AppConnectorProblemDetails,
  Merchant,
  PaymentForm,
  ResponseAuth,
} from '@/types'

const DEFAULT_API_BASE_URL = import.meta.env.VITE_PAYMENTS_API_BASE_URL?.trim() || 'http://localhost:7071'
const DEFAULT_API_KEY = import.meta.env.VITE_PAYMENTS_API_KEY?.trim() || 'dev-functions-key'
const DEFAULT_CURRENCY = import.meta.env.VITE_PAYMENTS_CURRENCY?.trim() || 'USD'

function normalizeCardNumber(cardNumber: string): string {
  return cardNumber.replace(/\s+/g, '')
}

function toAmountString(amount: number): string {
  return amount.toFixed(2)
}

function toOptionalString(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function allPresent(values: Array<string | undefined>): boolean {
  return values.every((value) => (value?.trim() ?? '') !== '')
}

export function buildAppConnectorPaymentRequest(params: {
  merchant: Merchant
  form: PaymentForm
  referenceCode: string
  currency?: string
  entryMode?: string
  ecspLogId?: string | null
}): AppConnectorPaymentRequest {
  const { merchant, form, referenceCode } = params
  const currency = params.currency?.trim() || DEFAULT_CURRENCY
  const entryMode = params.entryMode?.trim() || 'Keyed'

  const authenticationInformation = allPresent([
    merchant.authenticationEci,
    merchant.authenticationCavv,
    merchant.authenticationXid,
    merchant.authenticationEnrollmentStatus,
  ])
    ? {
      eci: merchant.authenticationEci!.trim(),
      cavv: merchant.authenticationCavv!.trim(),
      xid: merchant.authenticationXid!.trim(),
      enrollmentStatus: merchant.authenticationEnrollmentStatus!.trim(),
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

  const processingInformation = allPresent([
    merchant.errorCentinel,
    merchant.statusReason,
  ])
    ? {
      errorCentinel: merchant.errorCentinel!.trim(),
      statusReason: merchant.statusReason!.trim(),
    }
    : null

  return {
    clientReferenceInformation: {
      code: referenceCode,
      ecspLogId: params.ecspLogId ?? null,
    },
    transactionInformation: {
      transactionType: merchant.transactionType?.trim() || 'Sale',
      terminalId: merchant.terminalId,
      entryMode,
    },
    paymentInformation: {
      card: {
        number: normalizeCardNumber(form.creditCard),
        expirationMonth: form.expirationMonth.trim(),
        expirationYear: form.expirationYear.trim(),
        securityCode: toOptionalString(form.cvv),
        cardHolderName: toOptionalString(form.fullName),
      },
    },
    orderInformation: {
      amountDetails: {
        totalAmount: toAmountString(form.amount),
        currency,
      },
    },
    authenticationInformation,
    tokenizationInformation,
    processingInformation,
  }
}

export async function sendAppConnectorPayment(
  request: AppConnectorPaymentRequest,
  options?: {
    apiBaseUrl?: string
    apiKey?: string
    correlationId?: string
  },
): Promise<Response> {
  const baseUrl = options?.apiBaseUrl?.trim() || DEFAULT_API_BASE_URL
  const apiKey = options?.apiKey?.trim() || DEFAULT_API_KEY

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  })

  if (options?.correlationId) {
    headers.set('X-Correlation-Id', options.correlationId)
  }

  return fetch(`${baseUrl}/api/v1/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  })
}

export function mapPaymentResponseToResult(response: AppConnectorPaymentResponse): ResponseAuth {
  return {
    transactionId: response.transactionId,
    referenceNumber: response.referenceNumber ?? undefined,
    authorizationNumber: response.authorizationCode ?? undefined,
    responseCode: response.providerResponseCode ?? undefined,
    responseCodeDescription: response.providerMessage ?? response.providerStatus ?? response.status,
    provider: response.provider,
    status: response.status,
    providerStatus: response.providerStatus ?? undefined,
    providerResponseCode: response.providerResponseCode ?? undefined,
    providerMessage: response.providerMessage ?? undefined,
    authorizationCode: response.authorizationCode ?? undefined,
    referenceCode: response.referenceCode ?? undefined,
    traceId: response.traceId,
    processedAt: response.processedAt,
  }
}

export function toProblemMessage(problem: AppConnectorProblemDetails, fallback: string): string {
  const title = problem.title?.trim()
  const detail = problem.detail?.trim()
  if (title && detail) return `${title}: ${detail}`
  if (title) return title
  if (detail) return detail
  return fallback
}
