import { z } from 'zod'

/** Extrai o videoId de uma URL do YouTube (watch, youtu.be, embed, shorts). */
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

const youtubeId = z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Vídeo do YouTube inválido.')

const headingBlock = z.object({
  id: z.string(),
  type: z.literal('heading'),
  props: z.object({ text: z.string().max(200), level: z.union([z.literal(2), z.literal(3)]) }),
})

const textBlock = z.object({
  id: z.string(),
  type: z.literal('text'),
  // doc do TipTap/ProseMirror — validação permissiva (objeto). O conteúdo é renderizado
  // por mapeamento de nós no client, nunca como HTML cru.
  props: z.object({ doc: z.record(z.string(), z.unknown()) }),
})

const imageBlock = z.object({
  id: z.string(),
  type: z.literal('image'),
  props: z.object({ mediaId: z.string().uuid(), alt: z.string().max(200).default('') }),
})

const galleryBlock = z.object({
  id: z.string(),
  type: z.literal('gallery'),
  props: z.object({ mediaIds: z.array(z.string().uuid()).min(1).max(30) }),
})

const videoBlock = z.object({
  id: z.string(),
  type: z.literal('video'),
  props: z.object({ youtubeId }),
})

export const blockSchema = z.discriminatedUnion('type', [
  headingBlock, textBlock, imageBlock, galleryBlock, videoBlock,
])
export type Block = z.infer<typeof blockSchema>

// Layout em linhas/colunas: o conteúdo é uma lista ordenada de LINHAS; cada linha tem
// 1..4 COLUNAS; cada coluna guarda uma lista ordenada de BLOCOS (tipos acima, inalterados).
export const columnSchema = z.object({ id: z.string(), blocks: z.array(blockSchema) })
export const rowSchema = z.object({ id: z.string(), columns: z.array(columnSchema).min(1).max(4) })
export const contentSchema = z.array(rowSchema)
export type Column = z.infer<typeof columnSchema>
export type Row = z.infer<typeof rowSchema>
