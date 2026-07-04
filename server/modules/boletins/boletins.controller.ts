import type { Request, Response } from 'express'
import {
  createBoletimDto,
  updateBoletimDto,
  listBoletinsQuery,
  createTemplateDto,
  saveAsTemplateDto,
  listTemplatesQuery,
} from './dto/boletim.dto.js'
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

  duplicate = async (req: Request, res: Response) => {
    res.status(201).json({ boletim: await this.service.duplicate(String(req.params.id), req.user!.id) })
  }

  saveAsTemplate = async (req: Request, res: Response) => {
    const dto = saveAsTemplateDto.parse(req.body)
    res.status(201).json({ boletim: await this.service.saveAsTemplate(String(req.params.id), dto.name, dto.clearContent, req.user!.id) })
  }

  listTemplates = async (req: Request, res: Response) => {
    res.json(await this.service.listTemplates(listTemplatesQuery.parse(req.query)))
  }

  templateOptions = async (_req: Request, res: Response) => {
    res.json({ templates: await this.service.listTemplateOptions() })
  }

  createTemplate = async (req: Request, res: Response) => {
    const dto = createTemplateDto.parse(req.body)
    res.status(201).json({ boletim: await this.service.createBlankTemplate(dto.name, req.user!.id) })
  }

  getTemplate = async (req: Request, res: Response) => {
    res.json({ boletim: await this.service.getTemplateById(String(req.params.id)) })
  }

  updateTemplate = async (req: Request, res: Response) => {
    res.json({ boletim: await this.service.updateTemplate(String(req.params.id), updateBoletimDto.parse(req.body)) })
  }

  deleteTemplate = async (req: Request, res: Response) => {
    await this.service.deleteTemplate(String(req.params.id)); res.status(204).end()
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
