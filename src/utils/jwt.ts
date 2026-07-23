/**
 * JWT Client — mirrors the .NET JwtClient.cs logic using the Web Crypto API.
 *
 * Key derivation: The .NET code does Base64Encode(privateKey) then
 * SymmetricJwk.FromBase64Url(), which ultimately means the HMAC key
 * bytes = UTF-8 bytes of the raw privateKey string.
 */

import type { Merchant, JwtRequest, JwtPayload } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  return base64UrlEncodeBytes(bytes)
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function toUnixTime(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 1000)
}

function generateOrderId(): string {
  const now = new Date()
  const timeStr =
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0') +
    String(now.getMilliseconds()).padStart(3, '0')
  return timeStr.substring(0, 9)
}

// ─── Core JWT Builder ─────────────────────────────────────────────────────────

async function buildToken(payload: JwtPayload, merchant: Merchant): Promise<string> {
  // Key = UTF-8 bytes of the raw privateKey (see derivation note above)
  const keyBytes = new TextEncoder().encode(merchant.privateKey)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  const sigB64 = base64UrlEncodeBytes(new Uint8Array(signature))
  return `${signingInput}.${sigB64}`
}

function buildBasePayload(merchant: Merchant, request: JwtRequest): JwtPayload {
  const now = toUnixTime()
  return {
    nbf: now,
    exp: now + 3 * 60 * 60, // 3 hours
    iat: now,
    iss: merchant.publicKey,
    unique_name: merchant.publicKey,
    sub: '1234567',
    aud: merchant.audience ?? 'BCO',
    Request: request,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * GetToken — for the BCO Checkout modal (AUTH transaction)
 */
export async function getToken(
  orderId: string,
  totalAmount: string,
  terminalId: string,
  merchant: Merchant,
  invoice?: string,
): Promise<string> {
  const inv = invoice ?? generateOrderId()

  const request: JwtRequest = {
    orderId,
    totalAmount,
    clientId: 'Test-001',
    idSession: crypto.randomUUID(),
    terminalId,
    invoice: inv,
    transactionType: merchant.transactionType ?? 'AUTH',
    paymentIndicator: 'C101',
    Wallet: merchant.wallet ?? 'C',
    CryptogramEci: merchant.cryptogramEci ?? '42',
    Cryptogram: merchant.cryptogram ?? 'TESTING_CRYPTO',
    CryptogramBlockB: 'MDAwMDAwMDAwMDAwMDAwMDAwMDA=',
    Device: '20',
    ...(merchant.isApplePayTransaction !== undefined && { IsApplePayTransaction: merchant.isApplePayTransaction }),
  }

  const payload = buildBasePayload(merchant, request)
  return buildToken(payload, merchant)
}

/**
 * getTokenCapture — for capture transactions
 */
export async function getTokenCapture(
  transactionId: string,
  totalAmount: string,
  terminalId: string,
  merchant: Merchant,
): Promise<string> {
  const request: JwtRequest = {
    orderId: '',
    totalAmount,
    terminalId,
    transactionId,
    invoice: '',
  }

  const payload = buildBasePayload(merchant, request)
  payload.exp = toUnixTime() + 3 * 60 // 3 minutes for capture
  return buildToken(payload, merchant)
}

/**
 * getTokenReverse — for reversal transactions
 */
export async function getTokenReverse(
  invoice: string,
  orderId: string,
  terminalId: string,
  merchant: Merchant,
): Promise<string> {
  const request: JwtRequest = {
    orderId,
    totalAmount: '',
    terminalId,
    invoice,
  }

  const payload = buildBasePayload(merchant, request)
  payload.exp = toUnixTime() + 3 * 60
  return buildToken(payload, merchant)
}

/**
 * Generates a new order ID (timestamp-based, 9 chars)
 */
export { generateOrderId }

/**
 * Validates and extracts Response from a JWT returned by the payment gateway.
 * NOTE: This only decodes — it does NOT verify the signature in the browser
 * (signature verification requires the private key server-side).
 */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as T
  } catch {
    return null
  }
}
