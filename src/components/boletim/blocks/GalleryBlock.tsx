import type { GalleryBlock as GalleryBlockType } from '@/schemas/boletim'

/** Galeria de imagens do boletim em grade responsiva. */
export default function GalleryBlock({ block }: { block: GalleryBlockType }) {
  const { mediaIds } = block.props
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {mediaIds.map(id => (
        <img
          key={id}
          src={`/media/${id}`}
          alt=""
          loading="lazy"
          className="aspect-square w-full rounded-lg object-cover shadow-sm"
        />
      ))}
    </div>
  )
}
