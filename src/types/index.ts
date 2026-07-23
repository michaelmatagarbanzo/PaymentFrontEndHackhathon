// ─── Merchant & Config ────────────────────────────────────────────────────────

export interface Merchant {
  merchantId: string
  privateKey: string
  publicKey: string
  terminalId: string
  description: string
  audience: string
  // Optional fields for server-to-server transactions
  transactionType?: string
  invoice?: string
  authorizationNumber?: string
  systemTraceNumber?: string
  referenceNumber?: string
  orderId?: string
  wallet?: string
  isApplePayTransaction?: string
  cryptogramEci?: string
  cryptogram?: string
}

export interface MerchantsConfig {
  merchants: Merchant[]
  checkoutScripts: Record<string, string>
  safekeyScripts: Record<string, string>
  environment: 'development' | 'staging' | 'production'
}

// ─── Custom test cards ──────────────────────────────────────────────────────────

export interface Card {
  id: string
  card: string
  month: string
  year: string
  cvv: string
  amount: number
  description: string
}

// ─── Products ─────────────────────────────────────────────────────────────────

export interface Product {
  id: number
  nombre: string
  descripcion?: string
  valor: number
  cantidadDisponible: number
  cantidadPedido: number
  subTotal: number
}

// ─── Purchase / Order ─────────────────────────────────────────────────────────

export interface Purchase {
  numeroOrden: string
  pedido: Product[]
  purchaseJwt: string
  total: string
  terminal: string
  merchant: string
  publicKey: string
  invoice?: string
}

// ─── Payment Form ─────────────────────────────────────────────────────────────

export interface PaymentForm {
  creditCard: string
  expirationMonth: string
  expirationYear: string
  cvv: string
  fullName: string
  address: string
  mobilePhone: string
  email: string
  invoice: string
  amount: number
  paymentIndicator: string
}

// ─── JWT Payload ──────────────────────────────────────────────────────────────

export interface JwtRequest {
  orderId: string
  totalAmount: string
  terminalId: string
  invoice: string
  transactionType?: string
  [key: string]: string | undefined
}

export interface JwtPayload {
  nbf: number
  exp: number
  iat: number
  iss: string
  unique_name: string
  sub: string
  aud: string
  Request: JwtRequest
}

// ─── Transaction Result ───────────────────────────────────────────────────────

export interface ResponseAuth {
  responseCode?: string
  responseCodeDescription?: string
  hostTime?: string
  hostDate?: string
  referenceNumber?: string
  authorizationNumber?: string
  systemTraceNumber?: string
  securityCodeValidation?: string
  zipCodeValidation?: string
  addressValidation?: string
  avsValidation?: string
  giftMessage?: string
  clientName?: string
  balanceAmount?: string
  confirmNumber?: string
  fraudScore?: string
  transactionId?: string
  invoice?: string
  detResponseCodeDescription?: string
  detResponseCode?: string
  salesAmount?: string
  refundsAmount?: string
  orderId?: string
}

// ─── SDK Declarations (global window objects) ─────────────────────────────────

declare global {
  interface Window {
    checkout?: {
      init: (options: CheckoutInitOptions) => void
      isClave: (value: boolean) => void
      UpdateTokenToPay: (token: string) => void
      accessKey: string
    }
    BacSecurePay?: {
      Init: (options: BacSecurePayOptions) => void
      Pay: () => void
    }
  }
}

export interface CheckoutInitOptions {
  PublicKey: string
  Token: string
  callback: (data: { token: string }) => void
  renderButton: boolean
  buttonText: string
  buttonContainerId: string
  buttonCustomCSS: string
}

export interface BacSecurePayOptions {
  Token: string
  PublicKey: string
  LoadSongBird: boolean
  Continue: () => void
  callback: (data: { Token: string }) => void
}
