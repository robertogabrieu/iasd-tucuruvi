import { Router, type RequestHandler } from 'express'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import type { SettingsController } from './settings.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

/** Montado em /api/admin. Tudo exige settings:manage (US-14 CA-07). */
export function makeSettingsRoutes(
  controller: SettingsController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const perm = requirePermission('settings:manage')
  r.get('/settings/email', wrap(requireAuth), perm, wrap(controller.getEmail))
  r.put('/settings/email', wrap(requireAuth), perm, requireCsrf, wrap(controller.putEmail))
  r.post('/settings/email/test', wrap(requireAuth), perm, requireCsrf, wrap(controller.testEmail))
  r.get('/settings/email/oauth/authorize', wrap(requireAuth), perm, wrap(controller.authorize))
  r.get('/settings/email/oauth/callback', wrap(controller.oauthCallback)) // SEM requireAuth (state autentica)
  r.post('/settings/email/oauth/disconnect', wrap(requireAuth), perm, requireCsrf, wrap(controller.disconnect))
  return r
}
