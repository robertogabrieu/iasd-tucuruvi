import type { Request, Response } from 'express'
import { BadRequestError } from '../../core/errors.js'
import { parseFieldFilters, submissionExportQuery, submissionListQuery } from './dto/submission.dto.js'
import { normalizeIp, type FormsService } from './forms.service.js'
import type { FormDefinition } from './dto/form-definition.js'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export class FormsController {
  constructor(private readonly forms: FormsService) {}

  /** Público. Responde antes de tentar o aviso: e-mail fora do ar não pode custar o pedido. */
  submit = async (req: Request, res: Response) => {
    const def = this.forms.requireForm(String(req.params.formKey))
    const ip = normalizeIp((req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip)
    const userAgent = (req.headers['user-agent'] as string | undefined)?.slice(0, 500) ?? null
    const row = await this.forms.submit(def, req.body, ip, userAgent)
    res.json({ success: true, message: 'Mensagem enviada com sucesso!' })
    if (row) void this.forms.notify(def, row)
  }

  private filtros(req: Request, def: FormDefinition) {
    const { filters, error } = parseFieldFilters(req.query as Record<string, unknown>, def)
    if (error) throw new BadRequestError(error)
    return filters
  }

  catalog = async (_req: Request, res: Response) => {
    res.json({ data: await this.forms.catalog() })
  }

  list = async (req: Request, res: Response) => {
    const def = this.forms.requireForm(String(req.params.formKey))
    const query = submissionListQuery.parse(req.query)
    res.json(await this.forms.list(def, query, this.filtros(req, def)))
  }

  exportCsv = async (req: Request, res: Response) => {
    const def = this.forms.requireForm(String(req.params.formKey))
    const query = submissionExportQuery.parse(req.query)
    const csv = await this.forms.exportCsv(def, { ...query, page: 1, limit: 1 }, this.filtros(req, def))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${def.key}-${today()}.csv"`)
    res.send(csv)
  }
}
