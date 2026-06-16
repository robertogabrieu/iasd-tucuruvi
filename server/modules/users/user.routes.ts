import { Router, type RequestHandler } from 'express'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import type { UserController } from './user.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

/** Montado em /api/admin. Leitura exige users:read; mutações exigem users:manage. */
export function makeUserAdminRoutes(
  controller: UserController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const read = requirePermission('users:read')
  const manage = requirePermission('users:manage')
  r.get('/users', wrap(requireAuth), read, wrap(controller.list))
  r.get('/users/:id', wrap(requireAuth), read, wrap(controller.get))
  r.patch('/users/:id', wrap(requireAuth), manage, requireCsrf, wrap(controller.update))
  r.patch('/users/:id/status', wrap(requireAuth), manage, requireCsrf, wrap(controller.setStatus))
  r.post('/users/:id/unlock', wrap(requireAuth), manage, requireCsrf, wrap(controller.unlock))
  r.post('/users/:id/password-reset', wrap(requireAuth), manage, requireCsrf, wrap(controller.passwordReset))
  return r
}
