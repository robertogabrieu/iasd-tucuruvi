import { Router, type RequestHandler } from 'express'
import multer, { MulterError } from 'multer'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import { config } from '../../core/config.js'
import { BadRequestError } from '../../core/errors.js'
import type { MediaController } from './media.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.mediaMaxBytes, files: 1 },
})

/**
 * Roda o multer e traduz seus erros (ex.: arquivo grande demais) para BadRequestError aqui,
 * mantendo o error-handler central genérico (sem conhecer multer). A mensagem usa o limite
 * configurado, então acompanha MEDIA_MAX_BYTES.
 */
const uploadSingle: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const mb = Math.round(config.mediaMaxBytes / (1024 * 1024))
      return next(err.code === 'LIMIT_FILE_SIZE'
        ? new BadRequestError(`Arquivo muito grande. Tamanho máximo: ${mb} MB.`)
        : new BadRequestError('Falha no upload do arquivo.'))
    }
    next(err)
  })
}

/** Montado em /api/admin. Tudo exige media:manage; mutações exigem CSRF. */
export function makeMediaAdminRoutes(
  controller: MediaController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const manage = requirePermission('media:manage')
  r.get('/media', wrap(requireAuth), manage, wrap(controller.list))
  r.post('/media', wrap(requireAuth), manage, requireCsrf, uploadSingle, wrap(controller.upload))
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
