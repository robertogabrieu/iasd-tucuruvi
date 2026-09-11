import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { config } from '../config.js'

export interface OAuthStatePayload { userId: string; iat: number; nonce: string }
const MAX_AGE_MS = 10 * 60 * 1000

function sign(data: string): string {
  return createHmac('sha256', config.csrfSecret).update(data).digest('base64url')
}
export function issueOAuthState(userId: string): string {
  const payload: OAuthStatePayload = { userId, iat: Date.now(), nonce: randomBytes(9).toString('base64url') }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${data}.${sign(data)}`
}
export function verifyOAuthState(state: string | undefined): OAuthStatePayload | null {
  if (!state) return null
  const dot = state.lastIndexOf('.')
  if (dot < 0) return null
  const data = state.slice(0, dot)
  const a = Buffer.from(state.slice(dot + 1))
  const b = Buffer.from(sign(data))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let payload: OAuthStatePayload
  try { payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) } catch { return null }
  if (typeof payload?.userId !== 'string' || typeof payload?.iat !== 'number') return null
  if (Date.now() - payload.iat > MAX_AGE_MS) return null
  return payload
}
