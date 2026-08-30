import { Router, type RequestHandler } from 'express'
import { TooManyRequestsError } from '../../core/errors.js'
import { rateLimit } from '../../lib/rate-limit.js'
import type { FormsController } from './forms.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

const limiter = rateLimit({ maxRequests: 5, windowMs: 60_000 })

const limitByIp: RequestHandler = (req, _res, next) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
  next(limiter.check(ip)
    ? undefined
    : new TooManyRequestsError('Muitas tentativas. Tente novamente em alguns minutos.'))
}

/** Montado em /api/formularios. Público, sem auth. */
export function makeFormsPublicRoutes(controller: FormsController): Router {
  const r = Router()
  r.post('/:formKey', limitByIp, wrap(controller.submit))
  return r
}

/** Montado em /api/admin. Leitura exige forms:read; baixar o arquivo exige forms:export. */
export function makeFormsAdminRoutes(
  controller: FormsController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const read = requirePermission('forms:read')
  const exportar = requirePermission('forms:export')
  r.get('/formularios', wrap(requireAuth), read, wrap(controller.catalog))
  r.get('/formularios/:formKey/submissoes', wrap(requireAuth), read, wrap(controller.list))
  r.get('/formularios/:formKey/submissoes.csv', wrap(requireAuth), exportar, wrap(controller.exportCsv))
  return r
}
