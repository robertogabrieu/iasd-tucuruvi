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
  const tplManage = requirePermission('boletim:templates:manage')

  r.get('/boletins', wrap(requireAuth), write, wrap(c.list))
  r.post('/boletins', wrap(requireAuth), write, requireCsrf, wrap(c.create))

  // Rotas LITERAIS de template — ANTES de /boletins/:id (senão são capturadas como :id).
  r.get('/boletins/template-options', wrap(requireAuth), write, wrap(c.templateOptions))
  r.get('/boletins/templates', wrap(requireAuth), tplManage, wrap(c.listTemplates))
  r.post('/boletins/templates', wrap(requireAuth), tplManage, requireCsrf, wrap(c.createTemplate))
  r.get('/boletins/templates/:id', wrap(requireAuth), tplManage, wrap(c.getTemplate))
  r.patch('/boletins/templates/:id', wrap(requireAuth), tplManage, requireCsrf, wrap(c.updateTemplate))
  r.delete('/boletins/templates/:id', wrap(requireAuth), tplManage, requireCsrf, wrap(c.deleteTemplate))

  // Rotas de :id (paramétricas) — DEPOIS das literais.
  r.get('/boletins/:id', wrap(requireAuth), write, wrap(c.get))
  r.patch('/boletins/:id', wrap(requireAuth), write, requireCsrf, wrap(c.update))
  r.post('/boletins/:id/publish', wrap(requireAuth), publish, requireCsrf, wrap(c.publish))
  r.post('/boletins/:id/unpublish', wrap(requireAuth), publish, requireCsrf, wrap(c.unpublish))
  r.delete('/boletins/:id', wrap(requireAuth), write, requireCsrf, wrap(c.remove))
  r.post('/boletins/:id/duplicate', wrap(requireAuth), write, requireCsrf, wrap(c.duplicate))
  r.post('/boletins/:id/save-as-template', wrap(requireAuth), write, tplManage, requireCsrf, wrap(c.saveAsTemplate))
  return r
}

/** Montado em /api/boletins (pública, sem auth/CSRF). */
export function makeBoletinsPublicRoutes(c: BoletinsController): Router {
  const r = Router()
  r.get('/', wrap(c.getLatest)) // antes de /:slug para não ser capturado como slug
  r.get('/:slug', wrap(c.getBySlug))
  return r
}
