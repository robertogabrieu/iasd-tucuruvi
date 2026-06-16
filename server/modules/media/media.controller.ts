import type { Request, Response } from 'express'
import { listMediaQuery } from './dto/media.dto.js'
import type { MediaService } from './media.service.js'
import { mediaStorage } from './media.storage.js'

export class MediaController {
  constructor(private readonly media: MediaService) {}

  upload = async (req: Request, res: Response) => {
    const dto = await this.media.upload(req.file, req.user!.id)
    res.status(201).json({ media: dto })
  }

  list = async (req: Request, res: Response) => {
    const params = listMediaQuery.parse(req.query)
    res.json(await this.media.list(params))
  }

  remove = async (req: Request, res: Response) => {
    await this.media.delete(String(req.params.id))
    res.status(204).end()
  }

  // --- Público (sem auth) ---

  serveOriginal = async (req: Request, res: Response) => {
    const row = await this.media.getRaw(String(req.params.id))
    res.type(row.mime_type)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.sendFile(mediaStorage.absolutePath(row.filename))
  }

  serveThumb = async (req: Request, res: Response) => {
    const row = await this.media.getRaw(String(req.params.id))
    res.type('image/webp')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.sendFile(mediaStorage.absolutePath(row.thumbnail_filename))
  }
}
