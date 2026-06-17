// Espelho client dos tipos de bloco do boletim.
// FONTE DA VERDADE: server/modules/boletins/dto/block.schema.ts — manter em sincronia.
// (Convenção do projeto: schemas Zod duplicados client/server.)

/** Documento TipTap/ProseMirror serializado em JSON. */
export type TipTapDoc = Record<string, unknown>

export interface HeadingBlock {
  id: string
  type: 'heading'
  props: { text: string; level: 2 | 3 }
}

export interface TextBlock {
  id: string
  type: 'text'
  props: { doc: TipTapDoc }
}

export interface ImageBlock {
  id: string
  type: 'image'
  props: { mediaId: string; alt: string }
}

export interface GalleryBlock {
  id: string
  type: 'gallery'
  props: { mediaIds: string[] }
}

export interface VideoBlock {
  id: string
  type: 'video'
  props: { youtubeId: string }
}

export type Block = HeadingBlock | TextBlock | ImageBlock | GalleryBlock | VideoBlock

export type BlockType = Block['type']

/** Extrai o videoId de uma URL do YouTube (watch, youtu.be, embed, shorts) ou aceita um id puro. */
export function extractYouTubeId(input: string): string | null {
  const s = input.trim()
  // já é um id puro (11 chars base64url)
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = s.match(p)
    if (m) return m[1]
  }
  return null
}
