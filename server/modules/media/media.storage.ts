import { promises as fs } from 'fs'
import path from 'path'
import { config } from '../../core/config.js'
import { BadRequestError } from '../../core/errors.js'

const MEDIA_DIR = path.join(config.uploadsDir, 'media')

async function ensureDir(): Promise<void> {
  await fs.mkdir(MEDIA_DIR, { recursive: true })
}

function pathFor(filename: string): string {
  // Defesa extra contra path traversal: filename é sempre gerado pelo servidor (uuid),
  // mas normalizamos e garantimos que o resultado fica dentro de MEDIA_DIR.
  const resolved = path.resolve(MEDIA_DIR, path.basename(filename))
  if (resolved !== MEDIA_DIR && !resolved.startsWith(MEDIA_DIR + path.sep)) {
    throw new BadRequestError('Caminho de arquivo inválido.')
  }
  return resolved
}

export const mediaStorage = {
  async save(filename: string, data: Buffer): Promise<void> {
    await ensureDir()
    await fs.writeFile(pathFor(filename), data)
  },
  absolutePath(filename: string): string {
    return pathFor(filename)
  },
  async remove(filename: string): Promise<void> {
    await fs.rm(pathFor(filename), { force: true })
  },
}
