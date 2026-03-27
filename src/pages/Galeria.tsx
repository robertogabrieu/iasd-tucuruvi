import { useState, useEffect } from 'react'
import PhotoCard from '@/components/PhotoCard'
import SectionTitle from '@/components/SectionTitle'

interface FlickrPhoto {
  src: string
  alt: string
  link: string
}

export default function Galeria() {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/flickr/album?count=20')
      .then((res) => res.json())
      .then((data) => setPhotos(data))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="bg-iasd-light pt-24 pb-20">
      <div className="container mx-auto max-w-5xl px-4">
        <SectionTitle title="Galeria" subtitle="Nossos momentos" />
        {loading ? (
          <p className="text-center text-gray-500">Carregando fotos...</p>
        ) : photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((p, i) => (
              <PhotoCard key={i} src={p.src} alt={p.alt} link={p.link} delay={i * 50} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">Não foi possível carregar as fotos.</p>
        )}
        <div className="mt-10 text-center">
          <a
            href="https://www.flickr.com/photos/198977834@N03/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
          >
            Ver todas no Flickr
          </a>
        </div>
      </div>
    </main>
  )
}
