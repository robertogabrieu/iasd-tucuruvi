import { randomUUID } from 'crypto'
import { sanitize } from '../../lib/sanitize.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors.js'
import { paginate, toOffset, type Paginated } from '../../core/pagination.js'
import { processImage } from './media.image.js'
import { mediaStorage } from './media.storage.js'
import type { MediaRepository, MediaRow } from './media.repository.js'
import type { ListMediaQuery } from './dto/media.dto.js'

/** Retorna true se a mídia estiver em uso (bloqueia exclusão). Plugado por outros módulos. */
export type MediaUsageChecker = (mediaId: string) => Promise<boolean>

export interface MediaDTO {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  url: string
  thumbnailUrl: string
  createdAt: Date
}

function toDTO(row: MediaRow): MediaDTO {
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes), // pg devolve bigint como string
    width: row.width,
    height: row.height,
    url: `/media/${row.id}`,
    thumbnailUrl: `/media/${row.id}/thumb`,
    createdAt: row.created_at,
  }
}

export class MediaService {
  constructor(
    private readonly repo: MediaRepository,
    private readonly usageCheckers: MediaUsageChecker[] = [],
  ) {}

  async upload(
    file: { buffer: Buffer; originalname: string } | undefined,
    userId: string,
  ): Promise<MediaDTO> {
    if (!file) throw new BadRequestError('Nenhum arquivo enviado.')

    const img = await processImage(file.buffer)

    const id = randomUUID()
    const filename = `${id}.${img.ext}`
    const thumbnailFilename = `${id}_thumb.webp`

    await mediaStorage.save(filename, img.original)
    await mediaStorage.save(thumbnailFilename, img.thumbnail)

    const originalName = sanitize(file.originalname).slice(0, 120) || 'imagem'

    const row = await this.repo.create({
      filename,
      originalName,
      mimeType: img.mime,
      sizeBytes: img.original.byteLength,
      width: img.width,
      height: img.height,
      thumbnailFilename,
      uploadedBy: userId,
    })
    return toDTO(row)
  }

  async list(params: ListMediaQuery): Promise<Paginated<MediaDTO>> {
    const { rows, total } = await this.repo.list({
      limit: params.limit,
      offset: toOffset(params),
      q: params.q,
    })
    return paginate(rows.map(toDTO), total, params)
  }

  async getRaw(id: string): Promise<MediaRow> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Mídia não encontrada.')
    return row
  }

  async delete(id: string): Promise<void> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Mídia não encontrada.')

    for (const check of this.usageCheckers) {
      if (await check(id)) {
        throw new ConflictError('Imagem em uso e não pode ser removida.')
      }
    }

    await this.repo.delete(id)
    await mediaStorage.remove(row.filename)
    await mediaStorage.remove(row.thumbnail_filename)
  }
}
