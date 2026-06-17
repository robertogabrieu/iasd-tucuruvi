import type { ImageBlock as ImageBlockType } from '@/schemas/boletim'

/** Imagem única do boletim, servida por /media/:id. */
export default function ImageBlock({ block }: { block: ImageBlockType }) {
  const { mediaId, alt } = block.props
  return (
    <img
      src={`/media/${mediaId}`}
      alt={alt}
      loading="lazy"
      className="w-full max-w-full rounded-lg shadow-sm"
    />
  )
}
