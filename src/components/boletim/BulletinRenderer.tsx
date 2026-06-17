import type { Block } from '@/schemas/boletim'
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

/**
 * Renderizador compartilhado do conteúdo do boletim (pré-visualização do editor + página pública).
 * Mantém largura/espaçamento consistentes com o site.
 */
export default function BulletinRenderer({ content }: { content: Block[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {content.map(block => (
        <div key={block.id}>{renderBlock(block)}</div>
      ))}
    </div>
  )
}
