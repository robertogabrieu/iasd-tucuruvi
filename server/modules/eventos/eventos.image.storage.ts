import { promises as fs } from 'fs'
import path from 'path'
import { config } from '../../core/config.js'
import { BadRequestError } from '../../core/errors.js'
import { mediaStorage } from '../media/media.storage.js'
import type { ImageKind } from './eventos.image.js'

/** As imagens geradas moram ao lado da biblioteca de mídia, no volume de uploads (spec §6.2). */
const EVENTOS_DIR = path.join(config.uploadsDir, 'eventos')

const SLUG_VALIDO = /^[a-z0-9][a-z0-9-]{0,120}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** As três extensões que a biblioteca de mídia aceita (media.image.ts). */
const EXTENSOES_DE_MIDIA = ['webp', 'png', 'jpg'] as const

const KINDS: ImageKind[] = ['card', 'story']

function caminho(slug: string, kind: ImageKind): string {
  if (!SLUG_VALIDO.test(slug)) throw new BadRequestError('Slug inválido.')
  return path.join(EVENTOS_DIR, `${slug}-${kind}.png`)
}

export const eventoImageStorage = {
  async save(slug: string, kind: ImageKind, data: Buffer): Promise<void> {
    await fs.mkdir(EVENTOS_DIR, { recursive: true })
    await fs.writeFile(caminho(slug, kind), data)
  },

  absolutePath(slug: string, kind: ImageKind): string {
    return caminho(slug, kind)
  },

  async exists(slug: string, kind: ImageKind): Promise<boolean> {
    try {
      await fs.access(caminho(slug, kind))
      return true
    } catch {
      return false
    }
  },

  /** Apaga os dois formatos de uma vez: eles nascem e morrem juntos. */
  async remove(slug: string): Promise<void> {
    for (const kind of KINDS) await fs.rm(caminho(slug, kind), { force: true })
  },
}

/**
 * Lê o arquivo original de uma mídia direto do disco, procurando pelas extensões possíveis.
 * A alternativa seria consultar a tabela `media` pelo nome do arquivo, o que obrigaria o
 * gerador de imagem a carregar o repositório de outro módulo só para descobrir uma extensão.
 * Devolve null quando a mídia sumiu — capa apagada não pode derrubar a geração da imagem.
 */
export async function lerMidiaOriginal(mediaId: string): Promise<Buffer | null> {
  if (!UUID.test(mediaId)) return null
  for (const ext of EXTENSOES_DE_MIDIA) {
    try {
      return await fs.readFile(mediaStorage.absolutePath(`${mediaId}.${ext}`))
    } catch {
      continue
    }
  }
  return null
}
