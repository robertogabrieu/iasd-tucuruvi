import Image from 'next/image'

interface PhotoCardProps {
  src: string
  alt: string
  delay?: number
}

export default function PhotoCard({ src, alt, delay = 0 }: PhotoCardProps) {
  return (
    <div
      data-aos="zoom-in"
      data-aos-delay={delay}
      className="group overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:scale-[1.03]"
    >
      <div className="relative aspect-square">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
      </div>
    </div>
  )
}
