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

// Layout em linhas/colunas: o conteúdo é uma lista ordenada de LINHAS; cada linha tem
// 1..4 COLUNAS; cada coluna guarda uma lista ordenada de BLOCOS.
export interface Column {
  id: string
  blocks: Block[]
}

export interface Row {
  id: string
  columns: Column[]
}

/** Cria um bloco vazio do tipo pedido, com id novo e props padrão sensatas. */
export function makeBlock(type: BlockType): Block {
  const id = crypto.randomUUID()
  switch (type) {
    case 'heading':
      return { id, type, props: { text: '', level: 2 } }
    case 'text':
      return { id, type, props: { doc: {} } }
    case 'image':
      return { id, type, props: { mediaId: '', alt: '' } }
    case 'gallery':
      return { id, type, props: { mediaIds: [] } }
    case 'video':
      return { id, type, props: { youtubeId: '' } }
  }
}

/** Cria uma coluna vazia, com id novo. */
export function makeColumn(): Column {
  return { id: crypto.randomUUID(), blocks: [] }
}

/** Cria uma linha com `columnCount` colunas vazias (limitado a 1..4). */
export function makeRow(columnCount = 1): Row {
  const n = Math.min(4, Math.max(1, columnCount))
  return { id: crypto.randomUUID(), columns: Array.from({ length: n }, makeColumn) }
}

/** Conteúdo "vazio": sem linhas, ou toda coluna de toda linha sem blocos. */
export function contentIsEmpty(rows: Row[]): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return true
  return rows.every((row) => row.columns.every((col) => col.blocks.length === 0))
}

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
