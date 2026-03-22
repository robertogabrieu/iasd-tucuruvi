import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export function generateCsrfToken(secret: string): string {
  const nonce = randomBytes(16).toString('hex')
  const hmac = createHmac('sha256', secret).update(nonce).digest('hex')
  return `${nonce}.${hmac}`
}

export function validateCsrfToken(token: string, secret: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [nonce, providedHmac] = parts
  const expectedHmac = createHmac('sha256', secret).update(nonce).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))
  } catch {
    return false
  }
}
