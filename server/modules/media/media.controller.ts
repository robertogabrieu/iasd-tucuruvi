import type { Request, Response, NextFunction } from 'express'
import { listMediaQuery } from './dto/media.dto.js'
import type { MediaService } from './media.service.js'
import { mediaStorage } from './media.storage.js'
import { NotFoundError } from '../../core/errors.js'

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

  private send(res: Response, next: NextFunction, absPath: string) {
    // dotfiles: 'allow' porque o diretório de uploads em dev é '.uploads' (segmento com ponto);
    // sem isso o `send` recusa o caminho e responde 404. Os nomes de arquivo são uuids gerados
    // pelo servidor, então servir de dentro de MEDIA_DIR é seguro.
    res.sendFile(absPath, { dotfiles: 'allow' }, (err) => {
      if (err) {
        const e = err as NodeJS.ErrnoException & { status?: number }
        next(e.code === 'ENOENT' || e.status === 404
          ? new NotFoundError('Arquivo não encontrado.')
          : err)
      }
    })
  }

  serveOriginal = async (req: Request, res: Response, next: NextFunction) => {
    const row = await this.media.getRaw(String(req.params.id))
    res.type(row.mime_type)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    this.send(res, next, mediaStorage.absolutePath(row.filename))
  }

  serveThumb = async (req: Request, res: Response, next: NextFunction) => {
    const row = await this.media.getRaw(String(req.params.id))
    res.type('image/webp')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    this.send(res, next, mediaStorage.absolutePath(row.thumbnail_filename))
  }
}
