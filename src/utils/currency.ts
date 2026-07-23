/**
 * Converts a decimal number to ISO amount format (no decimal point,
 * last two digits are cents). Mirrors .NET DoubleToIso extension method.
 *
 * Examples:
 *   5.04 → "504"
 *   10.50 → "1050"
 *   100 → "10000"
 */
export function doubleToIso(value: number): string {
  const str = value.toString()
  const dotIndex = str.indexOf('.')

  if (dotIndex !== -1) {
    const integer = str.substring(0, dotIndex)
    let decimal = str.substring(dotIndex + 1)
    decimal = decimal.substring(0, decimal.length >= 2 ? 2 : 1)
    return `${integer}${decimal}`
  }

  return `${str}00`
}

/**
 * Formats a number as a locale currency string (e.g. 1,234.56)
 */
export function formatCurrency(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Parses an ISO amount string back to a float.
 * "504" → 5.04
 */
export function isoToDouble(iso: string): number {
  const num = parseInt(iso, 10)
  return num / 100
}

/**
 * Generates a random 9-digit invoice number.
 */
export function generateInvoice(): string {
  return String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0')
}

/**
 * Returns 3 random product IDs in range [1, 3] — mirrors getListId() in .NET
 */
export function getRandomProductIds(): number[] {
  return Array.from({ length: 3 }, () => Math.floor(Math.random() * 3) + 1)
}
