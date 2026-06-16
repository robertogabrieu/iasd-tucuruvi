import type { Pool } from 'pg'

export interface MediaRow {
  id: string
  filename: string
  original_name: string
  mime_type: string
  size_bytes: number
  width: number
  height: number
  thumbnail_filename: string
  uploaded_by: string | null
  created_at: Date
}

export interface CreateMediaInput {
  id: string
  filename: string
  originalName: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  thumbnailFilename: string
  uploadedBy: string
}

export class MediaRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: CreateMediaInput): Promise<MediaRow> {
    const r = await this.pool.query<MediaRow>(
      `INSERT INTO media
         (id, filename, original_name, mime_type, size_bytes, width, height, thumbnail_filename, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [data.id, data.filename, data.originalName, data.mimeType, data.sizeBytes,
       data.width, data.height, data.thumbnailFilename, data.uploadedBy],
    )
    return r.rows[0]
  }

  async list(
    { limit, offset, q }: { limit: number; offset: number; q?: string },
  ): Promise<{ rows: MediaRow[]; total: number }> {
    const where = q ? `WHERE original_name ILIKE $3` : ''
    const params = q ? [limit, offset, `%${q}%`] : [limit, offset]
    const rows = await this.pool.query<MediaRow>(
      `SELECT * FROM media ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params,
    )
    const countParams = q ? [`%${q}%`] : []
    const count = await this.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM media ${q ? 'WHERE original_name ILIKE $1' : ''}`,
      countParams,
    )
    return { rows: rows.rows, total: count.rows[0].count }
  }

  async findById(id: string): Promise<MediaRow | null> {
    const r = await this.pool.query<MediaRow>('SELECT * FROM media WHERE id = $1', [id])
    return r.rows[0] ?? null
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM media WHERE id = $1', [id])
  }
}
