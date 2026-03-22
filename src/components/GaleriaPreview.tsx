import Link from 'next/link'
import SectionTitle from './SectionTitle'
import PhotoCard from './PhotoCard'
import { getFlickrAlbumPhotos } from '@/lib/flickr'

export default async function GaleriaPreview() {
  const photos = await getFlickrAlbumPhotos(6)

  return (
    <section className="bg-iasd-light py-20">
      <div className="container mx-auto max-w-5xl px-4">
        <SectionTitle title="Galeria" subtitle="Momentos especiais" />
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {photos.map((p, i) => (
              <PhotoCard key={i} src={p.src} alt={p.alt} link={p.link} delay={i * 80} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">Fotos em breve.</p>
        )}
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
