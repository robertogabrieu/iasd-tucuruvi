import type { RequestHandler } from 'express'
import { ForbiddenError, UnauthorizedError } from '../../../core/errors.js'
import type { PermissionRepository } from '../permission.repository.js'

/**
 * Fábrica do middleware de autorização por permissão. Roda DEPOIS de requireAuth
 * (que popula req.user). 401 se não autenticado (defesa); 403 se faltar a permissão.
 * Trata os próprios erros via next(e) — não precisa de wrap nas rotas.
 */
export function makeRequirePermission(permissions: PermissionRepository) {
  return (key: string): RequestHandler => async (req, _res, next) => {
    try {
      const userId = req.user?.id
      if (!userId) throw new UnauthorizedError('Não autenticado.')
      const ok = await permissions.userHasPermission(userId, key)
      if (!ok) throw new ForbiddenError('Permissão insuficiente.')
      next()
    } catch (e) {
      next(e)
    }
  }
}
