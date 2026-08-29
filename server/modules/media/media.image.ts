import sharp from 'sharp'
import { BadRequestError } from '../../core/errors.js'

const ALLOWED = {
  jpeg: { ext: 'jpg', mime: 'image/jpeg' },
  png: { ext: 'png', mime: 'image/png' },
  webp: { ext: 'webp', mime: 'image/webp' },
} as const

export interface ProcessedImage {
  ext: string
  mime: string
  width: number
  height: number
  original: Buffer  // reencodado (sem EXIF/metadata)
  thumbnail: Buffer // WebP, lado maior ~400px
}

/**
 * Valida (magic bytes via sharp), reencoda descartando metadata e gera thumbnail.
 * Lança BadRequestError para formatos não suportados ou arquivo corrompido.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  let meta
  try {
    meta = await sharp(buffer).metadata()
  } catch {
    throw new BadRequestError('Arquivo de imagem inválido ou corrompido.')
  }

  const fmt = meta.format as keyof typeof ALLOWED | undefined
  if (!fmt || !(fmt in ALLOWED)) {
    throw new BadRequestError('Formato não suportado. Envie JPEG, PNG ou WebP.')
  }
  if (!meta.width || !meta.height) {
    throw new BadRequestError('Não foi possível ler as dimensões da imagem.')
  }

  const { ext, mime } = ALLOWED[fmt]

  // Reencode mantendo o formato; rotate() aplica orientação do EXIF e o pipeline
  // descarta o restante da metadata (não chamamos keepMetadata/withMetadata).
  const base = sharp(buffer).rotate()
  const original = await base.clone().toBuffer()
  const thumbnail = await base
    .clone()
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  return { ext, mime, width: meta.width, height: meta.height, original, thumbnail }
}
