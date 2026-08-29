import { BadRequestError, NotFoundError } from '../../core/errors.js'
import { paginate, toOffset, type Paginated } from '../../core/pagination.js'
import { slugify } from './boletins.slug.js'
import { cloneContentWithNewIds, stripContent, contentHasEmptyMedia } from './boletins.template.utils.js'
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
  isTemplate: boolean
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
    isTemplate: row.is_template,
    publicUrl: row.slug && row.status === 'published'
      ? `${this.publicBaseUrl}/boletins/${row.slug}` : null,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })

  async create(dto: CreateBoletimDto, userId: string): Promise<BoletimDTO> {
    if (dto.templateId) return this.createFromTemplate(dto.templateId, dto.title, userId)
    return this.toDTO(await this.repo.create(dto.title, userId))
  }

  async createFromTemplate(templateId: string, title: string, userId: string): Promise<BoletimDTO> {
    const tpl = await this.repo.findById(templateId)
    if (!tpl || !tpl.is_template) throw new NotFoundError('Template não encontrado.')
    return this.toDTO(await this.repo.insertWithContent({
      title, content: cloneContentWithNewIds(tpl.content), isTemplate: false, createdBy: userId,
    }))
  }

  async duplicate(id: string, userId: string): Promise<BoletimDTO> {
    const src = await this.repo.findById(id)
    if (!src) throw new NotFoundError('Boletim não encontrado.')
    return this.toDTO(await this.repo.insertWithContent({
      title: `Cópia de ${src.title}`, content: cloneContentWithNewIds(src.content),
      isTemplate: false, createdBy: userId,
    }))
  }

  async saveAsTemplate(boletimId: string, name: string, clearContent: boolean, userId: string): Promise<BoletimDTO> {
    const src = await this.repo.findById(boletimId)
    if (!src) throw new NotFoundError('Boletim não encontrado.')
    const content = clearContent ? stripContent(src.content) : cloneContentWithNewIds(src.content)
    return this.toDTO(await this.repo.insertWithContent({ title: name, content, isTemplate: true, createdBy: userId }))
  }

  async createBlankTemplate(name: string, userId: string): Promise<BoletimDTO> {
    return this.toDTO(await this.repo.insertWithContent({ title: name, content: [], isTemplate: true, createdBy: userId }))
  }

  async listTemplates(params: ListBoletinsQuery): Promise<Paginated<BoletimDTO>> {
    const { rows, total } = await this.repo.listTemplates({ limit: params.limit, offset: toOffset(params) })
    return paginate(rows.map((r) => this.toDTO(r)), total, params)
  }

  async listTemplateOptions(): Promise<{ id: string; title: string }[]> {
    return this.repo.listTemplateOptions()
  }

  async getTemplateById(id: string): Promise<BoletimDTO> {
    const row = await this.repo.findById(id)
    if (!row || !row.is_template) throw new NotFoundError('Template não encontrado.')
    return this.toDTO(row)
  }

  async updateTemplate(id: string, dto: UpdateBoletimDto): Promise<BoletimDTO> {
    const current = await this.repo.findById(id)
    if (!current || !current.is_template) throw new NotFoundError('Template não encontrado.')
    // Não delega para update(), que rejeita is_template (guarda das rotas genéricas). Usa o
    // núcleo compartilhado direto. Template é sempre rascunho, então a revalidação de mídia
    // de "publicado" nunca se aplica; updateBoletimDto não carrega status/slug (CHECK preservado).
    return this.applyUpdate(id, dto, current)
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.getTemplateById(id)
    await this.repo.delete(id)
  }

  async getById(id: string): Promise<BoletimDTO> {
    const row = await this.repo.findById(id)
    // Templates NÃO são acessíveis pelas rotas genéricas /boletins/:id (que exigem só
    // boletim:write): o ciclo de vida de template passa por getTemplateById/updateTemplate/
    // deleteTemplate, gated por boletim:templates:manage. Tratamos template como inexistente aqui.
    if (!row || row.is_template) throw new NotFoundError('Boletim não encontrado.')
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
    const { rows, total } = await this.repo.list({ limit: params.limit, offset: toOffset(params), status: params.status })
    return paginate(rows.map((r) => this.toDTO(r)), total, params)
  }

  async update(id: string, dto: UpdateBoletimDto): Promise<BoletimDTO> {
    const current = await this.repo.findById(id)
    // Ver getById: rota genérica não edita template (esse fluxo é updateTemplate).
    if (!current || current.is_template) throw new NotFoundError('Boletim não encontrado.')

    const nextContent = dto.content ?? current.content
    if (current.status === 'published' && contentHasEmptyMedia(nextContent)) {
      throw new BadRequestError('Boletim publicado não pode ficar com mídia vazia.', { missing: ['media'] })
    }

    return this.applyUpdate(id, dto, current)
  }

  /** Núcleo do update (sugestão de capa + persistência), sem as guardas de rota. Compartilhado
   *  por update() (boletim, com guardas) e updateTemplate() (template, já validado). */
  private async applyUpdate(id: string, dto: UpdateBoletimDto, current: BoletimRow): Promise<BoletimDTO> {
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
    if (row.is_template) throw new BadRequestError('Templates não podem ser publicados.')
    if (contentHasEmptyMedia(row.content)) missing.push('media')
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
    // Ver getById: rota genérica não opera sobre template (é sempre rascunho; no-op que
    // ainda assim vazaria o conteúdo na resposta). Trata como inexistente.
    if (!updated || updated.is_template) throw new NotFoundError('Boletim não encontrado.')
    return this.toDTO(updated)
  }

  async delete(id: string): Promise<void> {
    const row = await this.repo.findById(id)
    // Ver getById: rota genérica não exclui template (esse fluxo é deleteTemplate).
    if (!row || row.is_template) throw new NotFoundError('Boletim não encontrado.')
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
