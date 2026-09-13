import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors.js'
import { paginate, toOffset, type Paginated } from '../../core/pagination.js'
import { slugify } from '../../core/slug.js'
import { faltaParaPublicar } from './eventos.publish-rules.js'
import { renderEventoImage, type ImageKind } from './eventos.image.js'
import { eventoImageStorage } from './eventos.image.storage.js'
import type { EventosRepository, EventoRow, EventoFields, SessaoRow } from './eventos.repository.js'
import type { CreateEventoDto, UpdateEventoDto, ListEventosQuery, EventoDTO } from './dto/evento.dto.js'

const PG_UNIQUE_VIOLATION = '23505'

export class EventosService {
  constructor(
    private readonly repo: EventosRepository,
    private readonly publicBaseUrl: string,
  ) {}

  private toDTO = (row: EventoRow, sessoes: SessaoRow[] = []): EventoDTO => ({
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
    updatedAt: row.updated_at.toISOString(),
    sessions: sessoes.map((s) => ({
      id: s.id,
      startsAt: s.starts_at.toISOString(),
      endsAt: s.ends_at ? s.ends_at.toISOString() : null,
      title: s.title,
      description: s.description,
    })),
  })

  /** Uma consulta de sessões para a lista inteira, não uma por evento. */
  private async comSessoes(rows: EventoRow[]): Promise<EventoDTO[]> {
    const mapa = await this.repo.sessoesDe(rows.map((r) => r.id))
    return rows.map((r) => this.toDTO(r, mapa.get(r.id) ?? []))
  }

  private async comSessao(row: EventoRow): Promise<EventoDTO> {
    return (await this.comSessoes([row]))[0]
  }

  /**
   * Rascunho nasce podendo estar pela metade: sem horário nenhum e com local em branco. É a
   * publicação que cobra o preenchimento de verdade (faltaParaPublicar).
   */
  async create(dto: CreateEventoDto, userId: string): Promise<EventoDTO> {
    const { sessions, ...campos } = dto
    const fields: EventoFields = { ...campos, locationName: campos.locationName ?? '' }
    const row = await this.repo.create(fields, userId)
    if (!sessions?.length) return this.toDTO(row, [])
    const atualizado = await this.repo.substituirSessoes(row.id, sessions)
    return this.toDTO(atualizado, (await this.repo.sessoesDe([row.id])).get(row.id) ?? [])
  }

  async list(params: ListEventosQuery): Promise<Paginated<EventoDTO>> {
    const { rows, total } = await this.repo.list({
      limit: params.limit, offset: toOffset(params), status: params.status, periodo: params.periodo,
    })
    return paginate(await this.comSessoes(rows), total, params)
  }

  async getById(id: string): Promise<EventoDTO> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Evento não encontrado.')
    return this.comSessao(row)
  }

  async update(id: string, dto: UpdateEventoDto): Promise<EventoDTO> {
    const current = await this.repo.findById(id)
    if (!current) throw new NotFoundError('Evento não encontrado.')

    // Conferido antes de qualquer gravação: toda gravação toca updated_at, então conferir
    // depois recusaria a própria edição. Sem isso, a substituição integral da programação
    // faria quem salva por último apagar os horários de quem salvou antes.
    if (dto.expectedUpdatedAt && current.updated_at.getTime() !== new Date(dto.expectedUpdatedAt).getTime()) {
      throw new ConflictError('Alguém salvou este evento antes de você. Recarregue a página.')
    }

    const sessoesAtuais = (await this.repo.sessoesDe([id])).get(id) ?? []

    // Rascunho pode ficar incompleto; evento no ar, não — editar não pode quebrar a
    // página já divulgada. As regras são as mesmas da publicação, sobre a programação
    // efetiva: a do pedido quando vier, a do banco quando o pedido não mexer nela.
    if (current.status === 'published') {
      const falta = faltaParaPublicar({ ...this.toDTO(current, sessoesAtuais), ...comoDTO(dto) })
      if (falta.length) throw new BadRequestError('Evento publicado não pode ficar incompleto.', { missing: falta })
    }

    const { sessions, expectedUpdatedAt, ...campos } = dto
    let row = (await this.repo.update(id, campos))!
    let sessoes = sessoesAtuais
    if (sessions) {
      row = await this.repo.substituirSessoes(id, sessions)
      sessoes = (await this.repo.sessoesDe([id])).get(id) ?? []
    }
    const atualizado = this.toDTO(row, sessoes)
    await this.regerarImagens(atualizado)
    return atualizado
  }

  async remove(id: string): Promise<void> {
    const evento = await this.getById(id)
    await this.repo.delete(id)
    if (evento.slug) await eventoImageStorage.remove(evento.slug)
  }

  async publish(id: string): Promise<EventoDTO> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Evento não encontrado.')

    const falta = faltaParaPublicar(await this.comSessao(row))
    if (falta.length) throw new BadRequestError('Evento incompleto para publicação.', { missing: falta })

    // Slug imutável depois da 1ª publicação: preserva o link já divulgado.
    const publicado = row.slug
      ? await this.comSessao((await this.repo.setPublished(id, row.slug))!)
      : await this.comSessao(await this.publicarComSlugUnico(id, row.title))
    await this.regerarImagens(publicado)
    return publicado
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
    if (updated.slug) await eventoImageStorage.remove(updated.slug)
    return this.comSessao(updated)
  }

  /**
   * Caminho absoluto da imagem de compartilhamento, gerada na hora quando o arquivo não existe.
   * É o que faz um evento antigo sobreviver a uma limpeza de disco (spec §6.2).
   */
  async imagePathBySlug(slug: string, kind: ImageKind): Promise<string> {
    const evento = await this.getPublishedBySlug(slug)
    if (!evento) throw new NotFoundError('Evento não encontrado.')
    if (!(await eventoImageStorage.exists(slug, kind))) {
      await eventoImageStorage.save(slug, kind, await renderEventoImage(evento, kind))
    }
    return eventoImageStorage.absolutePath(slug, kind)
  }

  /**
   * As imagens são derivadas do evento: se a geração falhar, publicar e salvar continuam
   * valendo, porque a rota pública regenera sob demanda. Por isso o erro é registrado, não
   * propagado — o contrário deixaria o líder sem publicar por causa de uma foto corrompida.
   */
  private async regerarImagens(e: EventoDTO): Promise<void> {
    if (e.status !== 'published' || !e.slug) return
    try {
      for (const kind of ['card', 'story'] as const) {
        await eventoImageStorage.save(e.slug, kind, await renderEventoImage(e, kind))
      }
    } catch (err) {
      console.error('[eventos] falha ao gerar as imagens de compartilhamento de', e.slug, err)
    }
  }

  async getPublishedBySlug(slug: string): Promise<EventoDTO | null> {
    const row = await this.repo.findPublishedBySlug(slug)
    return row ? this.comSessao(row) : null
  }

  /** Publicados que ainda vão acontecer, do mais próximo ao mais distante. */
  async listUpcomingPublished(): Promise<EventoDTO[]> {
    const rows = await this.repo.listUpcomingPublished()
    return this.comSessoes(rows)
  }
}

/**
 * Traduz o payload de edição para o formato do DTO, para conferir o que vai ficar gravado.
 * Sessão do pedido ainda não tem id (o banco dá um novo ao regravar): vale a posição.
 * Sem `sessions` no pedido, a chave não entra — e a programação do banco continua valendo.
 */
function comoDTO(dto: UpdateEventoDto): Partial<EventoDTO> {
  const { sessions, expectedUpdatedAt, ...resto } = dto
  if (!sessions) return resto
  return {
    ...resto,
    sessions: sessions.map((s, i) => ({
      id: String(i),
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
      title: s.title,
      description: s.description,
    })),
  }
}
