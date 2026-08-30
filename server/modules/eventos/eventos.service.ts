import { BadRequestError, NotFoundError } from '../../core/errors.js'
import { paginate, toOffset, type Paginated } from '../../core/pagination.js'
import { slugify } from '../../core/slug.js'
import { faltaParaPublicar } from './eventos.publish-rules.js'
import type { EventosRepository, EventoRow, EventoFields } from './eventos.repository.js'
import type { CreateEventoDto, UpdateEventoDto, ListEventosQuery, EventoDTO } from './dto/evento.dto.js'

const PG_UNIQUE_VIOLATION = '23505'

export class EventosService {
  constructor(
    private readonly repo: EventosRepository,
    private readonly publicBaseUrl: string,
  ) {}

  private toDTO = (row: EventoRow): EventoDTO => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    category: row.category,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at ? row.ends_at.toISOString() : null,
    locationName: row.location_name,
    locationAddress: row.location_address,
    coverMode: row.cover_mode,
    coverStyle: row.cover_style,
    accentColor: row.accent_color,
    secondaryColor: row.secondary_color,
    hostName: row.host_name,
    hostRole: row.host_role,
    hostPhotoMediaId: row.host_photo_media_id,
    artMediaId: row.art_media_id,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    status: row.status,
    slug: row.slug,
    publicUrl: row.slug && row.status === 'published'
      ? `${this.publicBaseUrl}/eventos/${row.slug}` : null,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
  })

  /**
   * Rascunho nasce podendo estar pela metade, mas `starts_at` e `location_name` são NOT NULL:
   * o que o formulário ainda não preencheu entra como "agora" e local em branco, e é a
   * publicação que cobra o preenchimento de verdade (faltaParaPublicar).
   */
  async create(dto: CreateEventoDto, userId: string): Promise<EventoDTO> {
    const fields: EventoFields = {
      ...dto,
      startsAt: dto.startsAt ?? new Date(),
      locationName: dto.locationName ?? '',
    }
    return this.toDTO(await this.repo.create(fields, userId))
  }

  async list(params: ListEventosQuery): Promise<Paginated<EventoDTO>> {
    const { rows, total } = await this.repo.list({
      limit: params.limit, offset: toOffset(params), status: params.status, periodo: params.periodo,
    })
    return paginate(rows.map((r) => this.toDTO(r)), total, params)
  }

  async getById(id: string): Promise<EventoDTO> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Evento não encontrado.')
    return this.toDTO(row)
  }

  async update(id: string, dto: UpdateEventoDto): Promise<EventoDTO> {
    const current = await this.repo.findById(id)
    if (!current) throw new NotFoundError('Evento não encontrado.')

    // Rascunho pode ficar incompleto; evento no ar, não — editar não pode quebrar a
    // página já divulgada. As regras são as mesmas da publicação.
    if (current.status === 'published') {
      const falta = faltaParaPublicar({ ...this.toDTO(current), ...comoDTO(dto) })
      if (falta.length) throw new BadRequestError('Evento publicado não pode ficar incompleto.', { missing: falta })
    }

    return this.toDTO((await this.repo.update(id, dto))!)
  }

  async remove(id: string): Promise<void> {
    await this.getById(id)
    await this.repo.delete(id)
  }

  async publish(id: string): Promise<EventoDTO> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Evento não encontrado.')

    const falta = faltaParaPublicar(this.toDTO(row))
    if (falta.length) throw new BadRequestError('Evento incompleto para publicação.', { missing: falta })

    // Slug imutável depois da 1ª publicação: preserva o link já divulgado.
    if (row.slug) return this.toDTO((await this.repo.setPublished(id, row.slug))!)
    return this.toDTO(await this.publicarComSlugUnico(id, row.title))
  }

  /** O índice único parcial é a fonte da verdade — a pré-checagem só evita a maioria das colisões. */
  private async publicarComSlugUnico(id: string, title: string): Promise<EventoRow> {
    const base = slugify(title)
    let candidato = await this.repo.uniqueSlug(base, id)
    for (;;) {
      try {
        return (await this.repo.setPublished(id, candidato))!
      } catch (err) {
        if ((err as { code?: string }).code !== PG_UNIQUE_VIOLATION) throw err
        candidato = await this.repo.uniqueSlug(base, id)
      }
    }
  }

  async unpublish(id: string): Promise<EventoDTO> {
    const updated = await this.repo.setUnpublished(id)
    if (!updated) throw new NotFoundError('Evento não encontrado.')
    return this.toDTO(updated)
  }

  async getPublishedBySlug(slug: string): Promise<EventoDTO | null> {
    const row = await this.repo.findPublishedBySlug(slug)
    return row ? this.toDTO(row) : null
  }

  /** Publicados que ainda vão acontecer, do mais próximo ao mais distante. */
  async listUpcomingPublished(): Promise<EventoDTO[]> {
    const rows = await this.repo.listUpcomingPublished()
    return rows.map((r) => this.toDTO(r))
  }
}

/** Traduz as datas do payload de edição para o formato do DTO, para conferir o que vai ficar gravado. */
function comoDTO(dto: UpdateEventoDto): Partial<EventoDTO> {
  const { startsAt, endsAt, ...resto } = dto
  return {
    ...resto,
    ...(startsAt !== undefined ? { startsAt: startsAt.toISOString() } : {}),
    ...(endsAt !== undefined ? { endsAt: endsAt ? endsAt.toISOString() : null } : {}),
  }
}
