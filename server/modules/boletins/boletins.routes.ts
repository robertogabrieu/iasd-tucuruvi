import { Router, type RequestHandler } from 'express'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import type { BoletinsController } from './boletins.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

/** Montado em /api/admin. */
export function makeBoletinsAdminRoutes(
  c: BoletinsController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const write = requirePermission('boletim:write')
  const publish = requirePermission('boletim:publish')
  r.get('/boletins', wrap(requireAuth), write, wrap(c.list))
  r.post('/boletins', wrap(requireAuth), write, requireCsrf, wrap(c.create))
  r.get('/boletins/:id', wrap(requireAuth), write, wrap(c.get))
  r.patch('/boletins/:id', wrap(requireAuth), write, requireCsrf, wrap(c.update))
  r.post('/boletins/:id/publish', wrap(requireAuth), publish, requireCsrf, wrap(c.publish))
  r.post('/boletins/:id/unpublish', wrap(requireAuth), publish, requireCsrf, wrap(c.unpublish))
  r.delete('/boletins/:id', wrap(requireAuth), write, requireCsrf, wrap(c.remove))
  return r
}

/** Montado em /api/boletins (pública, sem auth/CSRF). */
export function makeBoletinsPublicRoutes(c: BoletinsController): Router {
  const r = Router()
  r.get('/', wrap(c.getLatest)) // antes de /:slug para não ser capturado como slug
  r.get('/:slug', wrap(c.getBySlug))
  return r
}
