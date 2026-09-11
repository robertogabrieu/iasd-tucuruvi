import { NotFoundError, ValidationError } from '../../core/errors.js'
import { paginate, toOffset } from '../../core/pagination.js'
import { sanitize } from '../../lib/sanitize.js'
import { sendMail } from '../../lib/mail.js'
import { FORMS, findForm } from './catalog/index.js'
import { buildSubmissionSchema, toPublicDefinition, validateCatalog } from './forms.definition.utils.js'
import { buildNotifyBody } from './forms.mail.js'
import { toCsv } from './forms.csv.js'
import type { FormDefinition, PublicFormDefinition } from './dto/form-definition.js'
import type { SubmissionRow } from './dto/submission-row.js'
import type { FieldFilter, SubmissionListQuery } from './dto/submission.dto.js'
import type { FormSubmissionRepository, ListFilters } from './forms.repository.js'


/** Teto de linhas por exportação. */
export const EXPORT_MAX_ROWS = 10_000


export interface FormSummary extends PublicFormDefinition {
  total: number
  lastAt: string | null
}

export class FormsService {
  constructor(private readonly repository: FormSubmissionRepository) {}

  /** Chamado no bootstrap: catálogo inconsistente impede o servidor de atender. */
  validateCatalogOrDie(): void {
    validateCatalog(FORMS)
  }

  requireForm(formKey: string): FormDefinition {
    const def = findForm(formKey)
    if (!def) throw new NotFoundError('Formulário não encontrado.')
    return def
  }

  /**
   * Grava e devolve a linha, ou `null` quando o campo-armadilha veio preenchido — nesse caso o
   * envio é descartado em silêncio e quem enviou recebe a mesma resposta de sucesso. Recusar com
   * erro ensinaria o robô qual campo evitar; pessoa nenhuma preenche um campo escondido.
   * A notificação NÃO acontece aqui — ver `notify`.
   */
  async submit(
    def: FormDefinition, body: unknown, ip: string | null, userAgent: string | null,
  ): Promise<SubmissionRow | null> {
    if (typeof body === 'object' && body !== null && String((body as Record<string, unknown>).honeypot ?? '') !== '') {
      return null
    }
    const parsed = buildSubmissionSchema(def).safeParse(body)
    if (!parsed.success) {
      throw new ValidationError('Dados inválidos.', parsed.error.flatten().fieldErrors)
    }
    const data: Record<string, string> = {}
    for (const field of def.fields) {
      const value = (parsed.data as Record<string, string>)[field.key]
      if (value !== undefined && value !== '') data[field.key] = sanitize(value)
    }
    return this.repository.create({ formKey: def.key, data, ip, userAgent })
  }

  /**
   * Disparado depois de a resposta já ter saído. Falha de e-mail fica registrada na linha e
   * nunca vira erro para quem preencheu — era isso que fazia o pedido se perder.
   */
  async notify(def: FormDefinition, row: SubmissionRow): Promise<void> {
    if (!def.notify) return
    try {
      await sendMail({
        to: def.notify.to,
        subject: def.notify.subject,
        text: buildNotifyBody(def, row),
      })
      await this.repository.markNotified(row.id)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await this.repository.markNotifyFailed(row.id, message.slice(0, 300))
    }
  }

  private toFilters(def: FormDefinition, query: SubmissionListQuery, fields: FieldFilter[]): ListFilters {
    return {
      formKey: def.key,
      q: query.q,
      searchableKeys: def.fields.filter(f => f.searchable).map(f => f.key),
      de: query.de,
      ate: query.ate,
      fields,
    }
  }

  async list(def: FormDefinition, query: SubmissionListQuery, fields: FieldFilter[]) {
    const { rows, total } = await this.repository.list(
      this.toFilters(def, query, fields),
      { limit: query.limit, offset: toOffset(query) },
    )
    return paginate(rows, total, query)
  }

  async exportCsv(def: FormDefinition, query: SubmissionListQuery, fields: FieldFilter[]): Promise<string> {
    const rows = await this.repository.listAll(this.toFilters(def, query, fields), EXPORT_MAX_ROWS)
    return toCsv(def, rows)
  }

  /** Catálogo para o painel, cruzado com quantos envios cada formulário já tem. */
  async catalog(): Promise<FormSummary[]> {
    const counts = new Map(( await this.repository.countByForm()).map(c => [c.form_key, c]))
    return FORMS.map(def => {
      const c = counts.get(def.key)
      return {
        ...toPublicDefinition(def),
        total: c?.total ?? 0,
        lastAt: c?.last_at ? c.last_at.toISOString() : null,
      }
    })
  }
}
