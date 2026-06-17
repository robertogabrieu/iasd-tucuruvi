import { BadRequestError, NotFoundError } from '../../core/errors.js'
import { paginate, toOffset, type Paginated } from '../../core/pagination.js'
import { slugify } from './boletins.slug.js'
import type { BoletinsRepository, BoletimRow } from './boletins.repository.js'
import type { Row } from './dto/block.schema.js'
import type { CreateBoletimDto, UpdateBoletimDto, ListBoletinsQuery } from './dto/boletim.dto.js'

export interface BoletimDTO {
  id: string
  title: string
  summary: string | null
  coverMediaId: string | null
  content: Row[]
  status: 'draft' | 'published'
  slug: string | null
  publicUrl: string | null
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** Payload mínimo do último boletim para o menu público. */
export interface LatestBoletimDTO {
  title: string
  slug: string
  publicUrl: string
  publishedAt: Date
}

const PG_UNIQUE_VIOLATION = '23505'

export class BoletinsService {
  constructor(
    private readonly repo: BoletinsRepository,
    private readonly publicBaseUrl: string,
  ) {}

  private toDTO = (row: BoletimRow): BoletimDTO => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    coverMediaId: row.cover_media_id,
    content: row.content,
    status: row.status,
    slug: row.slug,
    publicUrl: row.slug && row.status === 'published'
      ? `${this.publicBaseUrl}/boletins/${row.slug}` : null,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })

  async create(dto: CreateBoletimDto, userId: string): Promise<BoletimDTO> {
    return this.toDTO(await this.repo.create(dto.title, userId))
  }

  async getById(id: string): Promise<BoletimDTO> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Boletim não encontrado.')
    return this.toDTO(row)
  }

  async getPublishedBySlug(slug: string): Promise<BoletimDTO | null> {
    const row = await this.repo.findPublishedBySlug(slug)
    return row ? this.toDTO(row) : null
  }

  /** Último boletim publicado (por data de publicação) — payload enxuto p/ o menu. Null se não houver. */
  async getLatestPublished(): Promise<LatestBoletimDTO | null> {
    const row = await this.repo.findLatestPublished()
    if (!row) return null
    return {
      title: row.title,
      slug: row.slug,
      publicUrl: `${this.publicBaseUrl}/boletins/${row.slug}`,
      publishedAt: row.published_at,
    }
  }

  async list(params: ListBoletinsQuery): Promise<Paginated<BoletimDTO>> {
    const { rows, total } = await this.repo.list({ limit: params.limit, offset: toOffset(params) })
    return paginate(rows.map((r) => this.toDTO(r)), total, params)
  }

  async update(id: string, dto: UpdateBoletimDto): Promise<BoletimDTO> {
    const current = await this.repo.findById(id)
    if (!current) throw new NotFoundError('Boletim não encontrado.')

    // Sugestão de capa: se não há capa (nem atual nem informada) e o conteúdo tem imagem, sugere a 1ª.
    let coverMediaId = dto.coverMediaId
    const content = dto.content
    if (coverMediaId === undefined && !current.cover_media_id && content) {
      const firstImg = firstImageMediaId(content)
      if (firstImg) coverMediaId = firstImg
    }

    const updated = await this.repo.update(id, {
      title: dto.title,
      summary: dto.summary,
      coverMediaId,
      content,
    })
    return this.toDTO(updated!)
  }

  async publish(id: string): Promise<BoletimDTO> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Boletim não encontrado.')

    // Bloqueio de publicação incompleta (CA-06 US-18): enumera o que falta.
    const missing: string[] = []
    if (!row.title?.trim()) missing.push('title')
    if (contentIsEmpty(row.content)) missing.push('content')
    if (!row.summary?.trim() && !row.cover_media_id) missing.push('summary/cover')
    if (missing.length) {
      throw new BadRequestError('Boletim incompleto para publicação.', { missing })
    }

    // Slug imutável após a 1ª publicação (CA-04 US-18): só gera se ainda não tem.
    if (row.slug) {
      return this.toDTO((await this.repo.setPublished(id, row.slug))!)
    }
    return this.toDTO(await this.publishWithUniqueSlug(id, row.title))
  }

  /** Gera slug único; o índice parcial é a fonte da verdade — retry em 23505. */
  private async publishWithUniqueSlug(id: string, title: string): Promise<BoletimRow> {
    const base = slugify(title)
    let candidate = base
    let n = 1
    // pré-checagem barata para evitar a maioria das colisões
    while (await this.repo.slugExists(candidate)) { n++; candidate = `${base}-${n}` }
    for (;;) {
      try {
        return (await this.repo.setPublished(id, candidate))!
      } catch (err) {
        if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
          n++; candidate = `${base}-${n}`; continue
        }
        throw err
      }
    }
  }

  async unpublish(id: string): Promise<BoletimDTO> {
    const updated = await this.repo.setUnpublished(id)
    if (!updated) throw new NotFoundError('Boletim não encontrado.')
    return this.toDTO(updated)
  }

  async delete(id: string): Promise<void> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Boletim não encontrado.')
    await this.repo.delete(id)
  }
}

/** Primeira mídia de imagem/galeria em qualquer bloco, varrendo linhas → colunas → blocos. */
function firstImageMediaId(content: Row[]): string | null {
  for (const row of content) {
    for (const col of row.columns) {
      for (const b of col.blocks) {
        if (b.type === 'image') return b.props.mediaId
        if (b.type === 'gallery' && b.props.mediaIds.length) return b.props.mediaIds[0]
      }
    }
  }
  return null
}

/** Conteúdo "vazio": sem linhas, ou toda coluna de toda linha sem blocos. */
function contentIsEmpty(content: Row[]): boolean {
  if (!Array.isArray(content) || content.length === 0) return true
  return content.every((row) => row.columns.every((col) => col.blocks.length === 0))
}
