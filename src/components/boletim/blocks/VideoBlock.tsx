import type { VideoBlock as VideoBlockType } from '@/schemas/boletim'

/** Vídeo do YouTube incorporado, responsivo (aspect-video). Padrão de AoVivo.tsx. */
export default function VideoBlock({ block }: { block: VideoBlockType }) {
  const { youtubeId } = block.props
  return (
    <div className="relative aspect-video overflow-hidden rounded-lg shadow-lg">
      <iframe
        src={`https://www.youtube.com/embed/${youtubeId}`}
        title="Vídeo do YouTube"
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  )
}
