// server/core/security/csrf.ts
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

function sign(value: string): string {
  return createHmac('sha256', config.csrfSecret).update(value).digest('base64url')
}

/** Token = "<valor>.<assinatura>". Vai no cookie (lido pelo JS) e no header X-CSRF-Token. */
export function issueCsrfToken(): string {
  const value = randomBytes(18).toString('base64url')
  return `${value}.${sign(value)}`
}

export function isValidCsrfToken(token: string | undefined): boolean {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot < 0) return false
  const value = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(value)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function tokensMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}
