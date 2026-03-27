interface VideoCardProps {
  videoId: string
  title: string
  delay?: number
}

export default function VideoCard({ videoId, title, delay = 0 }: VideoCardProps) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      data-aos="zoom-in"
      data-aos-delay={delay}
      className="group block overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:scale-[1.03]"
    >
      <div className="relative aspect-video">
        <img
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <svg className="h-12 w-12 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <div className="bg-iasd-dark p-3">
        <p className="text-sm font-medium text-white line-clamp-2 min-h-[2.5rem]">{title}</p>
      </div>
    </a>
  )
}
