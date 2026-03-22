import Link from 'next/link'
import SectionTitle from './SectionTitle'
import PhotoCard from './PhotoCard'

const photos = [
  { src: '/img/placeholder-1.svg', alt: 'IASD Tucuruvi' },
  { src: '/img/placeholder-2.svg', alt: 'IASD Tucuruvi' },
  { src: '/img/placeholder-3.svg', alt: 'IASD Tucuruvi' },
  { src: '/img/placeholder-4.svg', alt: 'IASD Tucuruvi' },
  { src: '/img/placeholder-5.svg', alt: 'IASD Tucuruvi' },
  { src: '/img/placeholder-6.svg', alt: 'IASD Tucuruvi' },
]

export default function GaleriaPreview() {
  return (
    <section className="bg-iasd-light py-20">
      <div className="container mx-auto max-w-5xl px-4">
        <SectionTitle title="Galeria" subtitle="Momentos especiais" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {photos.map((p, i) => (
            <PhotoCard key={i} src={p.src} alt={p.alt} delay={i * 80} />
          ))}
        </div>
        <div className="mt-10 text-center" data-aos="fade-up">
          <Link
            href="/galeria"
            className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
          >
            Ver todas as fotos
          </Link>
        </div>
      </div>
    </section>
  )
}
