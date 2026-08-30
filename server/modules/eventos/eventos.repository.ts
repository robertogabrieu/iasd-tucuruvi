import type { Pool } from 'pg'
import type { TipTapDoc } from './dto/evento.dto.js'

export interface EventoRow {
  id: string
  title: string
  summary: string | null
  description: TipTapDoc
  category: string | null
  starts_at: Date
  ends_at: Date | null
  location_name: string
  location_address: string | null
  cover_mode: 'foto' | 'arte'
  cover_style: 'classico' | 'vibrante' | 'sobrio'
  accent_color: string
  secondary_color: string
  host_name: string | null
  host_role: string | null
  host_photo_media_id: string | null
  art_media_id: string | null
  cta_label: string | null
  cta_url: string | null
  status: 'draft' | 'published'
  slug: string | null
  published_at: Date | null
  created_by: string | null
  created_at: Date
  updated_at: Date
}

/** Campos gravávies do evento, em camelCase; `undefined` = não mexe na coluna. */
export interface EventoFields {
  title?: string
  summary?: string | null
  description?: TipTapDoc
  category?: string | null
  startsAt?: Date
  endsAt?: Date | null
  locationName?: string
  locationAddress?: string | null
  coverMode?: 'foto' | 'arte'
  coverStyle?: 'classico' | 'vibrante' | 'sobrio'
  accentColor?: string
  secondaryColor?: string
  hostName?: string | null
  hostRole?: string | null
  hostPhotoMediaId?: string | null
  artMediaId?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
}

export type ListEventosFilters = {
  limit: number
  offset: number
  status?: 'draft' | 'published'
  periodo?: 'proximos' | 'passados'
}

/** Coluna do banco para cada campo do DTO, na ordem em que o INSERT as escreve. */
const COLUNA: Record<keyof EventoFields, string> = {
  title: 'title',
  summary: 'summary',
  description: 'description',
  category: 'category',
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  locationName: 'location_name',
  locationAddress: 'location_address',
  coverMode: 'cover_mode',
  coverStyle: 'cover_style',
  accentColor: 'accent_color',
  secondaryColor: 'secondary_color',
  hostName: 'host_name',
  hostRole: 'host_role',
  hostPhotoMediaId: 'host_photo_media_id',
  artMediaId: 'art_media_id',
  ctaLabel: 'cta_label',
  ctaUrl: 'cta_url',
}

/** `description` é jsonb: o valor vai serializado e o placeholder recebe cast. */
function valorDe(campo: keyof EventoFields, f: EventoFields): unknown {
  return campo === 'description' ? JSON.stringify(f.description) : f[campo]
}

function castDe(campo: keyof EventoFields): string {
  return campo === 'description' ? '::jsonb' : ''
}

function camposInformados(f: EventoFields): (keyof EventoFields)[] {
  return (Object.keys(COLUNA) as (keyof EventoFields)[]).filter((c) => f[c] !== undefined)
}

export class EventosRepository {
  constructor(private readonly pool: Pool) {}

  async create(f: EventoFields, createdBy: string | null): Promise<EventoRow> {
    const campos = camposInformados(f)
    const colunas = campos.map((c) => COLUNA[c])
    const valores = campos.map((c) => valorDe(c, f))
    const placeholders = campos.map((c, i) => `$${i + 1}${castDe(c)}`)
    colunas.push('created_by')
    valores.push(createdBy)
    placeholders.push(`$${valores.length}`)

    const r = await this.pool.query<EventoRow>(
      `INSERT INTO eventos (${colunas.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      valores,
    )
    return r.rows[0]
  }

  async findById(id: string): Promise<EventoRow | null> {
    const r = await this.pool.query<EventoRow>('SELECT * FROM eventos WHERE id = $1', [id])
    return r.rows[0] ?? null
  }

  async findPublishedBySlug(slug: string): Promise<EventoRow | null> {
    const r = await this.pool.query<EventoRow>(
      `SELECT * FROM eventos WHERE slug = $1 AND status = 'published'`, [slug],
    )
    return r.rows[0] ?? null
  }

  /** Publicados que ainda não começaram, do mais próximo ao mais distante. Sem paginação. */
  async listUpcomingPublished(): Promise<EventoRow[]> {
    const r = await this.pool.query<EventoRow>(
      `SELECT * FROM eventos
       WHERE status = 'published' AND starts_at >= now()
       ORDER BY starts_at ASC`,
    )
    return r.rows
  }

  async list({ limit, offset, status, periodo }: ListEventosFilters): Promise<{ rows: EventoRow[]; total: number }> {
    const where: string[] = []
    const params: unknown[] = []
    if (status) { params.push(status); where.push(`status = $${params.length}`) }
    if (periodo === 'proximos') where.push('starts_at >= now()')
    if (periodo === 'passados') where.push('starts_at < now()')
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    // Próximos sobem do mais perto para o mais longe; passados, do mais recente para o mais antigo.
    const ordem = periodo === 'passados' ? 'starts_at DESC' : 'starts_at ASC'

    const rows = await this.pool.query<EventoRow>(
      `SELECT * FROM eventos ${clause} ORDER BY ${ordem} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    )
    const count = await this.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM eventos ${clause}`, params,
    )
    return { rows: rows.rows, total: count.rows[0].count }
  }

  /** Atualiza somente os campos informados; sempre toca updated_at. */
  async update(id: string, f: EventoFields): Promise<EventoRow | null> {
    const campos = camposInformados(f)
    const sets = campos.map((c, i) => `${COLUNA[c]} = $${i + 1}${castDe(c)}`)
    const valores = campos.map((c) => valorDe(c, f))
    sets.push('updated_at = now()')
    valores.push(id)

    const r = await this.pool.query<EventoRow>(
      `UPDATE eventos SET ${sets.join(', ')} WHERE id = $${valores.length} RETURNING *`, valores,
    )
    return r.rows[0] ?? null
  }

  async setPublished(id: string, slug: string): Promise<EventoRow | null> {
    const r = await this.pool.query<EventoRow>(
      `UPDATE eventos SET status = 'published', slug = $1, published_at = now(), updated_at = now()
       WHERE id = $2 RETURNING *`, [slug, id],
    )
    return r.rows[0] ?? null
  }

  async setUnpublished(id: string): Promise<EventoRow | null> {
    // O slug é MANTIDO ao despublicar, como no boletim: preserva o link já divulgado e
    // faz a republicação reusar o mesmo endereço. A rota pública já filtra por status.
    const r = await this.pool.query<EventoRow>(
      `UPDATE eventos SET status = 'draft', updated_at = now() WHERE id = $1 RETURNING *`, [id],
    )
    return r.rows[0] ?? null
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM eventos WHERE id = $1', [id])
  }

  async slugExists(slug: string, ignoreId?: string): Promise<boolean> {
    const r = ignoreId
      ? await this.pool.query('SELECT 1 FROM eventos WHERE slug = $1 AND id <> $2 LIMIT 1', [slug, ignoreId])
      : await this.pool.query('SELECT 1 FROM eventos WHERE slug = $1 LIMIT 1', [slug])
    return r.rowCount! > 0
  }

  /** Resolve colisão com sufixo numérico: `vigilia`, `vigilia-2`, `vigilia-3`… */
  async uniqueSlug(base: string, ignoreId?: string): Promise<string> {
    let candidato = base
    let n = 1
    while (await this.slugExists(candidato, ignoreId)) {
      n++
      candidato = `${base}-${n}`
    }
    return candidato
  }

  /** True se a mídia é a foto do responsável ou a arte de algum evento. */
  async mediaInUse(mediaId: string): Promise<boolean> {
    const r = await this.pool.query(
      `SELECT 1 FROM eventos WHERE host_photo_media_id = $1 OR art_media_id = $1 LIMIT 1`, [mediaId],
    )
    return r.rowCount! > 0
  }
}
