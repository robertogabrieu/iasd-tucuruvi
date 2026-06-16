import { Router, type RequestHandler } from 'express'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import type { RoleController } from './role.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

export function makeRoleAdminRoutes(
  controller: RoleController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const perm = requirePermission('roles:assign')
  r.get('/roles', wrap(requireAuth), perm, wrap(controller.list))
  r.post('/users/:id/roles', wrap(requireAuth), perm, requireCsrf, wrap(controller.assign))
  r.delete('/users/:id/roles/:roleId', wrap(requireAuth), perm, requireCsrf, wrap(controller.remove))
  const manage = requirePermission('roles:manage')
  r.get('/permissions', wrap(requireAuth), manage, wrap(controller.listPermissions))
  r.get('/roles/manage', wrap(requireAuth), manage, wrap(controller.listManaged))
  r.post('/roles', wrap(requireAuth), manage, requireCsrf, wrap(controller.create))
  r.patch('/roles/:id', wrap(requireAuth), manage, requireCsrf, wrap(controller.rename))
  r.put('/roles/:id/permissions', wrap(requireAuth), manage, requireCsrf, wrap(controller.setPermissions))
  r.delete('/roles/:id', wrap(requireAuth), manage, requireCsrf, wrap(controller.deleteRole))
  return r
}
