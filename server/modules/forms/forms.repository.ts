import type { Pool } from 'pg'
import type { SubmissionRow } from './dto/submission-row.js'
import type { FieldFilter } from './dto/submission.dto.js'

export interface CreateSubmissionInput {
  formKey: string
  data: Record<string, string>
  ip: string | null
  userAgent: string | null
}

export interface ListFilters {
  formKey: string
  q?: string
  searchableKeys: string[]
  de?: string
  ate?: string
  fields: FieldFilter[]
}

export interface FormCount { form_key: string; total: number; last_at: Date }

export class FormSubmissionRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateSubmissionInput): Promise<SubmissionRow> {
    const r = await this.pool.query<SubmissionRow>(
      `INSERT INTO form_submissions (form_key, data, submitted_ip, user_agent)
       VALUES ($1, $2::jsonb, $3::inet, $4)
       RETURNING *`,
      [input.formKey, JSON.stringify(input.data), input.ip, input.userAgent],
    )
    return r.rows[0]
  }

  async markNotified(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE form_submissions SET notified_at = now(), notify_error = NULL WHERE id = $1', [id],
    )
  }

  async markNotifyFailed(id: string, error: string): Promise<void> {
    await this.pool.query(
      'UPDATE form_submissions SET notified_at = NULL, notify_error = $2 WHERE id = $1', [id, error],
    )
  }

  /**
   * O mesmo `WHERE` alimenta a listagem e a exportação: se divergissem, o arquivo baixado
   * deixaria de corresponder ao que está na tela.
   */
  private buildWhere(f: ListFilters): { sql: string; params: unknown[] } {
    const parts = ['form_key = $1']
    const params: unknown[] = [f.formKey]
    if (f.q && f.searchableKeys.length > 0) {
      const ors = f.searchableKeys.map(k => {
        params.push(k, `%${f.q}%`)
        return `data->>$${params.length - 1} ILIKE $${params.length}`
      })
      parts.push(`(${ors.join(' OR ')})`)
    }
    if (f.de) { params.push(f.de); parts.push(`created_at >= $${params.length}::date`) }
    // `ate` inclui o dia inteiro: comparar com a data crua cortaria tudo que chegou depois de 00h00.
    if (f.ate) { params.push(f.ate); parts.push(`created_at < ($${params.length}::date + interval '1 day')`) }
    for (const ff of f.fields) {
      params.push(ff.key, ff.value)
      parts.push(`data->>$${params.length - 1} = $${params.length}`)
    }
    return { sql: `WHERE ${parts.join(' AND ')}`, params }
  }

  async list(f: ListFilters, page: { limit: number; offset: number }): Promise<{ rows: SubmissionRow[]; total: number }> {
    const { sql, params } = this.buildWhere(f)
    const rows = await this.pool.query<SubmissionRow>(
      `SELECT * FROM form_submissions ${sql} ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset],
    )
    const count = await this.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM form_submissions ${sql}`, params,
    )
    return { rows: rows.rows, total: count.rows[0].count }
  }

  async listAll(f: ListFilters, max: number): Promise<SubmissionRow[]> {
    const { sql, params } = this.buildWhere(f)
    const r = await this.pool.query<SubmissionRow>(
      `SELECT * FROM form_submissions ${sql} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
      [...params, max],
    )
    return r.rows
  }

  async countByForm(): Promise<FormCount[]> {
    const r = await this.pool.query<FormCount>(
      `SELECT form_key, count(*)::int AS total, max(created_at) AS last_at
       FROM form_submissions GROUP BY form_key`,
    )
    return r.rows
  }
}
