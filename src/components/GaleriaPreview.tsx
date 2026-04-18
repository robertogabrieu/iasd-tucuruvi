import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SectionTitle from './SectionTitle'
import PhotoCard from './PhotoCard'

interface FlickrPhoto {
  src: string
  alt: string
  link: string
}

export default function GaleriaPreview() {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])

  useEffect(() => {
    fetch('/api/flickr/album?count=6&random=1')
      .then((res) => res.json())
      .then((data) => setPhotos(data))
      .catch(() => setPhotos([]))
  }, [])

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
            to="/galeria"
            className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
          >
            Ver todas as fotos
          </Link>
        </div>
      </div>
    </section>
  )
}
