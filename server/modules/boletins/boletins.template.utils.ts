import { randomUUID } from 'node:crypto'
import type { Row } from './dto/block.schema.js'

/** Cópia profunda do conteúdo regenerando TODO id (linha/coluna/bloco) — árvores independentes. */
export function cloneContentWithNewIds(content: Row[]): Row[] {
  return content.map((row) => ({
    id: randomUUID(),
    columns: row.columns.map((col) => ({
      id: randomUUID(),
      // structuredClone garante cópia profunda das props (ex.: gallery.mediaIds[] não compartilha referência).
      blocks: col.blocks.map((b) => ({ ...structuredClone(b), id: randomUUID() })),
    })),
  }))
}

/** Esvazia o conteúdo mantendo a estrutura (mantém o texto dos títulos). Regenera ids. */
export function stripContent(content: Row[]): Row[] {
  return cloneContentWithNewIds(content).map((row) => ({
    ...row,
    columns: row.columns.map((col) => ({
      ...col,
      blocks: col.blocks.map((b) => {
        switch (b.type) {
          case 'heading': return b // mantém text + level (rótulo da seção)
          case 'text': return { ...b, props: { doc: { type: 'doc', content: [{ type: 'paragraph' }] } } }
          case 'image': return { ...b, props: { mediaId: '', alt: '' } }
          case 'gallery': return { ...b, props: { mediaIds: [] } }
          case 'video': return { ...b, props: { youtubeId: '' } }
          default: { const _exhaustive: never = b; return _exhaustive } // novo tipo de bloco vira erro de compilação
        }
      }),
    })),
  }))
}

/** True se algum bloco de mídia/vídeo está vazio (placeholder) — usado para bloquear publicação. */
export function contentHasEmptyMedia(content: Row[]): boolean {
  return content.some((row) =>
    row.columns.some((col) =>
      col.blocks.some((b) =>
        (b.type === 'image' && b.props.mediaId === '') ||
        (b.type === 'gallery' && b.props.mediaIds.length === 0) ||
        (b.type === 'video' && b.props.youtubeId === ''),
      ),
    ),
  )
}
