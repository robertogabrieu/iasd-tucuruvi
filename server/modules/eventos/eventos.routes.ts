import { Router, type RequestHandler } from 'express'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import type { EventosController } from './eventos.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

/** Montado em /api/admin. */
export function makeEventosAdminRoutes(
  c: EventosController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const write = requirePermission('evento:write')
  const publish = requirePermission('evento:publish')

  r.get('/eventos', wrap(requireAuth), write, wrap(c.list))
  r.post('/eventos', wrap(requireAuth), write, requireCsrf, wrap(c.create))
  r.get('/eventos/:id', wrap(requireAuth), write, wrap(c.get))
  r.patch('/eventos/:id', wrap(requireAuth), write, requireCsrf, wrap(c.update))
  r.delete('/eventos/:id', wrap(requireAuth), write, requireCsrf, wrap(c.remove))
  r.post('/eventos/:id/publicar', wrap(requireAuth), publish, requireCsrf, wrap(c.publish))
  r.post('/eventos/:id/despublicar', wrap(requireAuth), publish, requireCsrf, wrap(c.unpublish))
  return r
}

/** Montado em /api/eventos (pública, sem auth/CSRF). */
export function makeEventosPublicRoutes(c: EventosController): Router {
  const r = Router()
  r.get('/', wrap(c.listUpcoming))
  r.get('/:slug', wrap(c.getBySlug))
  return r
}
