import type { Pool } from 'pg'
import type { Block } from './dto/block.schema.js'

export interface BoletimRow {
  id: string
  title: string
  summary: string | null
  cover_media_id: string | null
  content: Block[]
  status: 'draft' | 'published'
  slug: string | null
  published_at: Date | null
  created_by: string | null
  created_at: Date
  updated_at: Date
}

export interface UpdateBoletimFields {
  title?: string
  summary?: string | null
  coverMediaId?: string | null
  content?: Block[]
}

export class BoletinsRepository {
  constructor(private readonly pool: Pool) {}

  async create(title: string, createdBy: string): Promise<BoletimRow> {
    const r = await this.pool.query<BoletimRow>(
      `INSERT INTO boletins (title, created_by) VALUES ($1, $2) RETURNING *`,
      [title, createdBy],
    )
    return r.rows[0]
  }

  async findById(id: string): Promise<BoletimRow | null> {
    const r = await this.pool.query<BoletimRow>('SELECT * FROM boletins WHERE id = $1', [id])
    return r.rows[0] ?? null
  }

  async findPublishedBySlug(slug: string): Promise<BoletimRow | null> {
    const r = await this.pool.query<BoletimRow>(
      `SELECT * FROM boletins WHERE slug = $1 AND status = 'published'`, [slug],
    )
    return r.rows[0] ?? null
  }

  async list({ limit, offset }: { limit: number; offset: number }): Promise<{ rows: BoletimRow[]; total: number }> {
    const rows = await this.pool.query<BoletimRow>(
      `SELECT * FROM boletins ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset],
    )
    const count = await this.pool.query<{ count: number }>('SELECT count(*)::int AS count FROM boletins')
    return { rows: rows.rows, total: count.rows[0].count }
  }

  /** Atualiza somente os campos fornecidos; sempre toca updated_at. */
  async update(id: string, f: UpdateBoletimFields): Promise<BoletimRow | null> {
    const sets: string[] = []
    const vals: unknown[] = []
    let i = 1
    if (f.title !== undefined) { sets.push(`title = $${i++}`); vals.push(f.title) }
    if (f.summary !== undefined) { sets.push(`summary = $${i++}`); vals.push(f.summary) }
    if (f.coverMediaId !== undefined) { sets.push(`cover_media_id = $${i++}`); vals.push(f.coverMediaId) }
    if (f.content !== undefined) { sets.push(`content = $${i++}::jsonb`); vals.push(JSON.stringify(f.content)) }
    sets.push(`updated_at = now()`)
    vals.push(id)
    const r = await this.pool.query<BoletimRow>(
      `UPDATE boletins SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals,
    )
    return r.rows[0] ?? null
  }

  async setPublished(id: string, slug: string): Promise<BoletimRow | null> {
    const r = await this.pool.query<BoletimRow>(
      `UPDATE boletins SET status = 'published', slug = $1, published_at = now(), updated_at = now()
       WHERE id = $2 RETURNING *`, [slug, id],
    )
    return r.rows[0] ?? null
  }

  async setUnpublished(id: string): Promise<BoletimRow | null> {
    // O `slug` é deliberadamente MANTIDO ao despublicar: preserva o link já distribuído
    // (CA-04 US-18) e faz o `publish` reusar o mesmo slug ao republicar (slug imutável).
    // Não limpar o slug aqui — a rota pública já esconde o conteúdo via status='published'.
    const r = await this.pool.query<BoletimRow>(
      `UPDATE boletins SET status = 'draft', updated_at = now() WHERE id = $1 RETURNING *`, [id],
    )
    return r.rows[0] ?? null
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM boletins WHERE id = $1', [id])
  }

  /** True se já existe um boletim usando este slug (qualquer estado). */
  async slugExists(slug: string): Promise<boolean> {
    const r = await this.pool.query('SELECT 1 FROM boletins WHERE slug = $1 LIMIT 1', [slug])
    return r.rowCount! > 0
  }

  /**
   * True se a mídia está em uso por QUALQUER boletim: como capa, ou dentro de content
   * em bloco image (props.mediaId) ou gallery (props.mediaIds[]). Fecha CA-05 da US-17.
   *
   * Cobre apenas referências por id nos blocos image/gallery — que são os ÚNICOS que
   * referenciam a biblioteca. O bloco `text` guarda um doc do TipTap montado só com
   * StarterKit + Link (sem nó de imagem), então nunca carrega `mediaId`; se um dia o
   * editor ganhar imagem inline no texto, esta query precisa varrer `props.doc` também.
   */
  async mediaInUse(mediaId: string): Promise<boolean> {
    const r = await this.pool.query(
      `SELECT 1 FROM boletins b
       WHERE b.cover_media_id = $1
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(b.content) AS elem
            WHERE elem->'props'->>'mediaId' = $1
               OR elem->'props'->'mediaIds' ? $1
          )
       LIMIT 1`, [mediaId],
    )
    // Nota: `content` é NOT NULL DEFAULT '[]' e o repo só escreve arrays, então
    // jsonb_array_elements é seguro. O operador `?` testa pertinência de string no array
    // (gallery) e o `->>` compara a string (image). `$1` é placeholder pg, sem conflito com `?`.
    return r.rowCount! > 0
  }
}
