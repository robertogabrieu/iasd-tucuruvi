import { Router, type RequestHandler } from 'express'
import multer from 'multer'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import { config } from '../../core/config.js'
import type { MediaController } from './media.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.mediaMaxBytes, files: 1 },
})

/** Montado em /api/admin. Tudo exige media:manage; mutações exigem CSRF. */
export function makeMediaAdminRoutes(
  controller: MediaController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const manage = requirePermission('media:manage')
  r.get('/media', wrap(requireAuth), manage, wrap(controller.list))
  r.post('/media', wrap(requireAuth), manage, requireCsrf, upload.single('file'), wrap(controller.upload))
  r.delete('/media/:id', wrap(requireAuth), manage, requireCsrf, wrap(controller.remove))
  return r
}

/** Montado em /media. Público, sem auth: serve original e thumbnail. */
export function makeMediaPublicRoutes(controller: MediaController): Router {
  const r = Router()
  r.get('/:id', wrap(controller.serveOriginal))
  r.get('/:id/thumb', wrap(controller.serveThumb))
  return r
}
