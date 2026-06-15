import { Router, type RequestHandler } from 'express'
import type { AuthController } from './auth.controller.js'
import { requireCsrf } from './middleware/require-csrf.js'

// asyncWrap: encaminha rejeições para o error-handler central (sem try/catch nos handlers).
const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

export function makeAuthRoutes(controller: AuthController, requireAuth: RequestHandler): Router {
  const r = Router()
  r.get('/csrf', controller.csrf)
  r.post('/login', requireCsrf, wrap(controller.login))
  r.post('/refresh', requireCsrf, wrap(controller.refresh))
  r.post('/logout', requireCsrf, wrap(controller.logout))
  r.get('/me', wrap(requireAuth), wrap(controller.me))
  r.post('/forgot-password', requireCsrf, wrap(controller.forgotPassword))
  r.post('/reset-password', requireCsrf, wrap(controller.resetPassword))
  return r
}
