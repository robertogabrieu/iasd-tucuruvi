// server/modules/auth/middleware/require-csrf.ts
import type { RequestHandler } from 'express'
import { ForbiddenError } from '../../../core/errors.js'
import { isValidCsrfToken, tokensMatch } from '../../../core/security/csrf.js'

// Double-submit: header X-CSRF-Token deve existir, ser válido (assinatura) e igual ao cookie.
export const requireCsrf: RequestHandler = (req, _res, next) => {
  const header = req.get('x-csrf-token') ?? undefined
  const cookie = req.cookies?.csrf_token as string | undefined
  if (!isValidCsrfToken(header) || !tokensMatch(header, cookie)) {
    throw new ForbiddenError('Token CSRF inválido.')
  }
  next()
}
