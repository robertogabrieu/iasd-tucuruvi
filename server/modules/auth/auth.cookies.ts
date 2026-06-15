import type { Response } from 'express'
import { config, durationToMs } from '../../core/config.js'

const base = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'strict' as const,
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie('access_token', token, { ...base, maxAge: durationToMs(config.jwtAccessTtl) })
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    ...base,
    path: '/api/auth',
    maxAge: durationToMs(config.jwtRefreshTtl),
  })
}

export function setCsrfCookie(res: Response, token: string): void {
  // NÃO httpOnly: o frontend lê e reenvia no header X-CSRF-Token.
  res.cookie('csrf_token', token, { httpOnly: false, secure: config.cookieSecure, sameSite: 'strict' })
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie('access_token', base)
  res.clearCookie('refresh_token', { ...base, path: '/api/auth' })
}
