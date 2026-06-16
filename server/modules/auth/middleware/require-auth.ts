import type { RequestHandler } from 'express'
import { UnauthorizedError } from '../../../core/errors.js'
import type { TokenService } from '../../../core/security/token.service.js'

export function makeRequireAuth(tokens: TokenService): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = req.cookies?.access_token as string | undefined
      if (!token) throw new UnauthorizedError('Não autenticado.')
      const userId = await tokens.verifyAccessToken(token)
      req.user = { id: userId }
      next()
    } catch {
      next(new UnauthorizedError('Não autenticado.'))
    }
  }
}
