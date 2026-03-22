import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PhotoCard from '@/components/PhotoCard'
import SectionTitle from '@/components/SectionTitle'
import { getFlickrAlbumPhotos } from '@/lib/flickr'

export const metadata: Metadata = {
  title: 'Galeria — IASD Tucuruvi',
  description: 'Confira as fotos da Igreja Adventista do Tucuruvi.',
}

export default async function GaleriaPage() {
  const photos = await getFlickrAlbumPhotos(20)

  return (
    <>
      <Header />
      <main className="bg-iasd-light pt-24 pb-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Galeria" subtitle="Nossos momentos" />
          {photos.length > 0 ? (
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
      <Footer />
    </>
  )
}
