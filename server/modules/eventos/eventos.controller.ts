import type { Request, Response } from 'express'
import { createEventoSchema, updateEventoSchema, listEventosQuery } from './dto/evento.dto.js'
import type { EventosService } from './eventos.service.js'

export class EventosController {
  constructor(private readonly service: EventosService) {}

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
}
