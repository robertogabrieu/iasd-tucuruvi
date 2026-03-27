interface PhotoCardProps {
  src: string
  alt: string
  link?: string
  delay?: number
}

export default function PhotoCard({ src, alt, link, delay = 0 }: PhotoCardProps) {
  const card = (
    <div
      data-aos="zoom-in"
      data-aos-delay={delay}
      className="group overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:scale-[1.03]"
    >
      <div className="relative aspect-square">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
      </div>
    </div>
  )

  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer">
        {card}
      </a>
    )
  }

  return card
}
