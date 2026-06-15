import { Router, type RequestHandler } from 'express'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import type { InvitationController } from './invitation.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

/** Montado em /api/admin. Convidar exige users:invite. */
export function makeInvitationAdminRoutes(
  controller: InvitationController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  r.post(
    '/invitations',
    wrap(requireAuth),
    requirePermission('users:invite'),
    requireCsrf,
    wrap(controller.invite),
  )
  return r
}

/** Montado em /api/auth (público). Aceite de convite — sem autenticação, com CSRF. */
export function makeInvitationPublicRoutes(controller: InvitationController): Router {
  const r = Router()
  r.post('/accept-invite', requireCsrf, wrap(controller.accept))
  return r
}
