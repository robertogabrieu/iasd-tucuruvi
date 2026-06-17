import type { Request, Response } from 'express'
import { createBoletimDto, updateBoletimDto, listBoletinsQuery } from './dto/boletim.dto.js'
import type { BoletinsService } from './boletins.service.js'

export class BoletinsController {
  constructor(private readonly service: BoletinsService) {}

  create = async (req: Request, res: Response) => {
    const dto = createBoletimDto.parse(req.body)
    const created = await this.service.create(dto, req.user!.id)
    res.status(201).json({ boletim: created })
  }

  list = async (req: Request, res: Response) => {
    const params = listBoletinsQuery.parse(req.query)
    res.json(await this.service.list(params))
  }

  get = async (req: Request, res: Response) => {
    res.json({ boletim: await this.service.getById(String(req.params.id)) })
  }

  update = async (req: Request, res: Response) => {
    const dto = updateBoletimDto.parse(req.body)
    res.json({ boletim: await this.service.update(String(req.params.id), dto) })
  }

  publish = async (req: Request, res: Response) => {
    res.json({ boletim: await this.service.publish(String(req.params.id)) })
  }

  unpublish = async (req: Request, res: Response) => {
    res.json({ boletim: await this.service.unpublish(String(req.params.id)) })
  }

  remove = async (req: Request, res: Response) => {
    await this.service.delete(String(req.params.id))
    res.status(204).end()
  }

  // pública
  getBySlug = async (req: Request, res: Response) => {
    const boletim = await this.service.getPublishedBySlug(String(req.params.slug))
    if (!boletim) { res.status(404).json({ error: 'Boletim não encontrado.' }); return }
    res.json({ boletim })
  }

  // pública — último boletim publicado (ou null). Alimenta o item de menu condicional.
  getLatest = async (_req: Request, res: Response) => {
    res.json({ boletim: await this.service.getLatestPublished() })
  }
}
