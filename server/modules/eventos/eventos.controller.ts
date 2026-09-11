import type { NextFunction, Request, Response } from 'express'
import { NotFoundError } from '../../core/errors.js'
import type { MediaService } from '../media/media.service.js'
import { createEventoSchema, updateEventoSchema, listEventosQuery } from './dto/evento.dto.js'
import type { ImageKind } from './eventos.image.js'
import type { EventosService } from './eventos.service.js'

export class EventosController {
  constructor(
    private readonly service: EventosService,
    private readonly media: MediaService,
  ) {}

  create = async (req: Request, res: Response) => {
    const dto = createEventoSchema.parse(req.body)
    res.status(201).json({ evento: await this.service.create(dto, req.user!.id) })
  }

  list = async (req: Request, res: Response) => {
    res.json(await this.service.list(listEventosQuery.parse(req.query)))
  }

  get = async (req: Request, res: Response) => {
    res.json({ evento: await this.service.getById(String(req.params.id)) })
  }

  update = async (req: Request, res: Response) => {
    const dto = updateEventoSchema.parse(req.body)
    res.json({ evento: await this.service.update(String(req.params.id), dto) })
  }

  publish = async (req: Request, res: Response) => {
    res.json({ evento: await this.service.publish(String(req.params.id)) })
  }

  unpublish = async (req: Request, res: Response) => {
    res.json({ evento: await this.service.unpublish(String(req.params.id)) })
  }

  remove = async (req: Request, res: Response) => {
    await this.service.remove(String(req.params.id))
    res.status(204).end()
  }

  uploadImagem = async (req: Request, res: Response) => {
    const media = await this.media.upload(req.file, req.user!.id)
    res.status(201).json({ media })
  }

  // pública
  listUpcoming = async (_req: Request, res: Response) => {
    res.json({ eventos: await this.service.listUpcomingPublished() })
  }

  // pública
  getBySlug = async (req: Request, res: Response) => {
    const evento = await this.service.getPublishedBySlug(String(req.params.slug))
    if (!evento) { res.status(404).json({ error: 'Evento não encontrado.' }); return }
    res.json({ evento })
  }

  // pública — imagem 1200×630 do preview do link
  serveCard = async (req: Request, res: Response, next: NextFunction) => {
    await this.enviarImagem(req, res, next, 'card')
  }

  // pública — arte 1080×1920 para Stories
  serveStory = async (req: Request, res: Response, next: NextFunction) => {
    await this.enviarImagem(req, res, next, 'story')
  }

  /**
   * Cache curto de propósito: a imagem é regerada a cada salvamento do evento, então um
   * `immutable` como o da biblioteca de mídia deixaria o preview velho no ar por um ano.
   */
  private enviarImagem = async (req: Request, res: Response, next: NextFunction, kind: ImageKind) => {
    const caminho = await this.service.imagePathBySlug(String(req.params.slug), kind)
    res.type('image/png')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.sendFile(caminho, { dotfiles: 'allow' }, (err) => {
      if (err) {
        const e = err as NodeJS.ErrnoException & { status?: number }
        next(e.code === 'ENOENT' || e.status === 404
          ? new NotFoundError('Imagem não encontrada.')
          : err)
      }
    })
  }
}
