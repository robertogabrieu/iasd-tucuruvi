import type { Pool } from 'pg'
import { ConflictError } from '../../core/errors.js'
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

export interface SessaoRow {
  id: string
  evento_id: string
  starts_at: Date
  ends_at: Date | null
  title: string | null
  description: string | null
}

export interface SessaoInput {
  startsAt: Date
  endsAt: Date | null
  title: string | null
  description: string | null
}

/**
 * Campos gravávies do evento, em camelCase; `undefined` = não mexe na coluna.
 * As datas não entram: são derivadas da programação em `substituirSessoes`.
 */
export interface EventoFields {
  title?: string
  summary?: string | null
  description?: TipTapDoc
  category?: string | null
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

/** Sessão do evento corrente de `eventos` que ainda não terminou; vai dentro de EXISTS. */
const SESSAO_PENDENTE = `SELECT 1 FROM evento_sessoes s
  WHERE s.evento_id = eventos.id AND coalesce(s.ends_at, s.starts_at) >= now()`

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
    // starts_at é NOT NULL e só se conhece depois da programação: now() é provisório até
    // substituirSessoes, chamada logo em seguida, gravar o valor derivado.
    colunas.push('starts_at')
    placeholders.push('now()')

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

  /** A programação de vários eventos de uma vez, em ordem cronológica. */
  async sessoesDe(eventoIds: string[]): Promise<Map<string, SessaoRow[]>> {
    const mapa = new Map<string, SessaoRow[]>()
    if (eventoIds.length === 0) return mapa
    const r = await this.pool.query<SessaoRow>(
      `SELECT * FROM evento_sessoes WHERE evento_id = ANY($1::uuid[]) ORDER BY starts_at ASC`,
      [eventoIds],
    )
    for (const row of r.rows) {
      const lista = mapa.get(row.evento_id) ?? []
      lista.push(row)
      mapa.set(row.evento_id, lista)
    }
    return mapa
  }

  /**
   * Substitui a programação inteira e recalcula as datas do evento, que são cache da
   * primeira e da última sessão (spec §4.3). Tudo numa transação: evento sem programação,
   * nem que por um instante, é estado que a listagem pública já enxergaria.
   */
  async substituirSessoes(
    eventoId: string, sessoes: SessaoInput[], expectedUpdatedAt?: Date,
  ): Promise<EventoRow> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      if (expectedUpdatedAt) {
        const atual = await client.query<{ updated_at: Date }>(
          'SELECT updated_at FROM eventos WHERE id = $1 FOR UPDATE', [eventoId],
        )
        if (atual.rows[0] && atual.rows[0].updated_at.getTime() !== expectedUpdatedAt.getTime()) {
          throw new ConflictError('Alguém salvou este evento antes de você. Recarregue a página.')
        }
      }

      await client.query('DELETE FROM evento_sessoes WHERE evento_id = $1', [eventoId])
      for (const s of sessoes) {
        await client.query(
          `INSERT INTO evento_sessoes (evento_id, starts_at, ends_at, title, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [eventoId, s.startsAt, s.endsAt, s.title, s.description],
        )
      }

      const ordenadas = [...sessoes].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      const primeira = ordenadas[0]
      const ultima = ordenadas[ordenadas.length - 1]

      const r = await client.query<EventoRow>(
        `UPDATE eventos SET starts_at = $1, ends_at = $2, updated_at = now()
         WHERE id = $3 RETURNING *`,
        [primeira.startsAt, ultima.endsAt, eventoId],
      )
      await client.query('COMMIT')
      return r.rows[0]
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  /**
   * Publicados que ainda têm horário por vir, ordenados pelo próximo horário pendente.
   * Ordenar por starts_at poria um evento que já começou à frente de tudo para sempre.
   */
  async listUpcomingPublished(): Promise<EventoRow[]> {
    const r = await this.pool.query<EventoRow>(
      `SELECT e.* FROM eventos e
       WHERE e.status = 'published'
         AND EXISTS (
           SELECT 1 FROM evento_sessoes s
           WHERE s.evento_id = e.id AND coalesce(s.ends_at, s.starts_at) >= now()
         )
       ORDER BY (
         SELECT min(s.starts_at) FROM evento_sessoes s
         WHERE s.evento_id = e.id AND coalesce(s.ends_at, s.starts_at) >= now()
       ) ASC, e.id ASC`,
    )
    return r.rows
  }

  async list({ limit, offset, status, periodo }: ListEventosFilters): Promise<{ rows: EventoRow[]; total: number }> {
    const where: string[] = []
    const params: unknown[] = []
    if (status) { params.push(status); where.push(`status = $${params.length}`) }
    // Mesmo critério da lista pública: o evento é "próximo" enquanto houver sessão por terminar.
    if (periodo === 'proximos') where.push(`EXISTS (${SESSAO_PENDENTE})`)
    if (periodo === 'passados') where.push(`NOT EXISTS (${SESSAO_PENDENTE})`)
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
