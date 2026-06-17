import type { Block, Row } from '@/schemas/boletim'
import HeadingBlock from './blocks/HeadingBlock'
import TextBlock from './blocks/TextBlock'
import ImageBlock from './blocks/ImageBlock'
import GalleryBlock from './blocks/GalleryBlock'
import VideoBlock from './blocks/VideoBlock'

function renderBlock(block: Block) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock block={block} />
    case 'text':
      return <TextBlock block={block} />
    case 'image':
      return <ImageBlock block={block} />
    case 'gallery':
      return <GalleryBlock block={block} />
    case 'video':
      return <VideoBlock block={block} />
    default: {
      // Exaustividade: novo tipo de bloco sem branch acima vira erro de tipo.
      const _exhaustive: never = block
      return _exhaustive
    }
  }
}

// Grade responsiva por número de colunas. Classes listadas LITERALMENTE (sem montar
// strings dinâmicas) para o purge do Tailwind não removê-las. Colunas empilham no mobile.
const GRID_BY_COUNT: Record<number, string> = {
  1: 'grid grid-cols-1',
  2: 'grid grid-cols-1 md:grid-cols-2',
  3: 'grid grid-cols-1 md:grid-cols-3',
  4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
}

/**
 * Renderizador compartilhado do conteúdo do boletim (pré-visualização + página pública).
 * O conteúdo é uma lista de linhas; cada linha vira uma grade responsiva de N colunas.
 */
export default function BulletinRenderer({ content }: { content: Row[] }) {
  return (
    <div className="w-full space-y-8">
      {content.map(row => {
        const count = Math.min(4, Math.max(1, row.columns.length))
        return (
          <div key={row.id} className={`${GRID_BY_COUNT[count]} gap-6`}>
            {row.columns.map(col => (
              <div key={col.id} className="space-y-6">
                {col.blocks.map(block => (
                  <div key={block.id}>{renderBlock(block)}</div>
                ))}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
