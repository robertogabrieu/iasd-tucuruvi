import { Router, type RequestHandler } from 'express'
import multer, { MulterError } from 'multer'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import { config } from '../../core/config.js'
import { BadRequestError } from '../../core/errors.js'
import type { EventosController } from './eventos.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.mediaMaxBytes, files: 1 },
})

/**
 * Mesma tradução de erro do multer usada na biblioteca de mídia (media.routes.ts): o
 * error-handler central não conhece multer, então "arquivo grande demais" vira BadRequestError
 * aqui, com o limite configurado na mensagem.
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
  // Upload próprio do módulo, com evento:write: a rota da biblioteca de mídia exige
  // media:manage, que um líder que só publica evento não tem (spec §4).
  r.post('/eventos/imagens', wrap(requireAuth), write, requireCsrf, uploadSingle, wrap(c.uploadImagem))
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

/**
 * Montado em /eventos (pública, fora de /api): são as imagens que o robô do WhatsApp busca
 * pela URL absoluta do Open Graph, e precisam morar no mesmo caminho da página (spec §5.1).
 */
export function makeEventosImageRoutes(c: EventosController): Router {
  const r = Router()
  r.get('/:slug/card.png', wrap(c.serveCard))
  r.get('/:slug/story.png', wrap(c.serveStory))
  return r
}
