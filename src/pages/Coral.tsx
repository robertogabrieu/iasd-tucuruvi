import { useCallback, useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import PhotoCard from '@/components/PhotoCard'
import VideoCard from '@/components/VideoCard'
import SectionTitle from '@/components/SectionTitle'

interface FlickrPhoto {
  src: string
  alt: string
  link: string
}

interface Video {
  videoId: string
  title: string
}

const WHATSAPP_URL = 'https://wa.me/5599999999999'
const WHATSAPP_DISPLAY = '(99) 99999-9999'

const LOREM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`

function WhatsAppIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function CarouselArrows({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  onPrev: () => void
  onNext: () => void
  prevLabel: string
  nextLabel: string
}) {
  const cls =
    'absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-coral-red text-black shadow-lg transition hover:bg-coral-gold'
  return (
    <>
      <button type="button" onClick={onPrev} aria-label={prevLabel} className={`${cls} left-2 md:-left-5`}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button type="button" onClick={onNext} aria-label={nextLabel} className={`${cls} right-2 md:-right-5`}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </>
  )
}

function Dots({ count, current, onSelect }: { count: number; current: number; onSelect: (i: number) => void }) {
  if (count <= 1) return null
  return (
    <div className="mt-6 flex justify-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Ir para slide ${i + 1}`}
          className={`h-2 rounded-full transition-all ${
            i === current ? 'w-6 bg-coral-red' : 'w-2 bg-coral-red/30'
          }`}
        />
      ))}
    </div>
  )
}

function useCarouselState(emblaApi: ReturnType<typeof useEmblaCarousel>[1]) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [snapCount, setSnapCount] = useState(0)

  useEffect(() => {
    if (!emblaApi) return
    setSnapCount(emblaApi.scrollSnapList().length)
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap())
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', () => {
      setSnapCount(emblaApi.scrollSnapList().length)
      onSelect()
    })
  }, [emblaApi])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi])

  return { selectedIndex, snapCount, scrollPrev, scrollNext, scrollTo }
}

export default function Coral() {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(true)
  const [videos, setVideos] = useState<Video[]>([])
  const [videosLoading, setVideosLoading] = useState(true)

  const photosAutoplay = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })
  )
  const videosAutoplay = useRef(
    Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true })
  )

  const [photosRef, photosApi] = useEmblaCarousel(
    { loop: true, align: 'start', skipSnaps: false },
    [photosAutoplay.current]
  )
  const [videosRef, videosApi] = useEmblaCarousel(
    { loop: true, align: 'start', skipSnaps: false },
    [videosAutoplay.current]
  )

  const photosState = useCarouselState(photosApi)
  const videosState = useCarouselState(videosApi)

  useEffect(() => {
    fetch('/api/flickr/coral?count=12')
      .then((res) => res.json())
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setPhotosLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/youtube/coral?count=8')
      .then((res) => res.json())
      .then(setVideos)
      .catch(() => setVideos([]))
      .finally(() => setVideosLoading(false))
  }, [])

  return (
    <main className="pt-16">
      {/* Hero */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-coral-ink">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url('/img/coral-hero.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-coral-ink/70 via-coral-ink/50 to-coral-ink/90" />
        <div className="relative z-10 px-4 py-20 text-center">
          <h1
            className="font-heading text-4xl font-bold uppercase tracking-wide text-coral-red md:text-6xl"
            data-aos="fade-up"
          >
            Coral Adventista
            <br />
            de Tucuruvi
          </h1>
          <p
            className="mx-auto mt-4 max-w-xl font-heading text-lg italic text-coral-gold md:text-xl"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            Louvando ao Senhor em uma só voz
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-3 rounded-full bg-coral-red px-8 py-4 font-heading font-bold text-black shadow-lg shadow-coral-red/30 transition-transform hover:scale-105"
            data-aos="fade-up"
            data-aos-delay="200"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Fale conosco no WhatsApp
          </a>
        </div>
      </section>

      {/* Sobre */}
      <section className="bg-coral-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Sobre o Coral" subtitle="Nossa história" variant="coral" />
          <div className="grid gap-8 md:grid-cols-2" data-aos="fade-up">
            {LOREM.split('\n\n').map((para, i) => (
              <p key={i} className="text-gray-700 leading-relaxed">
                {para}
              </p>
            ))}
          </div>
          <div className="mt-10 text-center" data-aos="fade-up">
            <span className="inline-block rounded-full bg-coral-red px-6 py-2 font-heading text-sm font-bold text-black">
              Ensaios aos sábados às 15h
            </span>
          </div>
        </div>
      </section>

      {/* Apresentações (YouTube carousel) */}
      <section className="bg-coral-sand py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Apresentações" subtitle="Ouça o Coral" variant="coral" />
          {videosLoading ? (
            <p className="text-center text-gray-500">Carregando vídeos...</p>
          ) : videos.length > 0 ? (
            <div className="relative" data-aos="fade-up">
              <div className="overflow-hidden" ref={videosRef}>
                <div className="flex -ml-4">
                  {videos.map((v) => (
                    <div
                      key={v.videoId}
                      className="min-w-0 shrink-0 grow-0 basis-full pl-4 sm:basis-1/2 lg:basis-1/3"
                    >
                      <VideoCard videoId={v.videoId} title={v.title} />
                    </div>
                  ))}
                </div>
              </div>
              <CarouselArrows
                onPrev={videosState.scrollPrev}
                onNext={videosState.scrollNext}
                prevLabel="Vídeo anterior"
                nextLabel="Próximo vídeo"
              />
              <Dots
                count={videosState.snapCount}
                current={videosState.selectedIndex}
                onSelect={videosState.scrollTo}
              />
            </div>
          ) : (
            <p className="text-center text-gray-500">Nenhum vídeo disponível.</p>
          )}
          <div className="mt-10 text-center">
            <a
              href="https://www.youtube.com/playlist?list=PLwnLJcWxPcgT2DW5ep21JvCN9Yu1uiFan"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full border-2 border-coral-red px-8 py-3 font-heading font-bold text-coral-red transition-colors hover:bg-coral-red hover:text-black"
            >
              Ver playlist completa
            </a>
          </div>
        </div>
      </section>

      {/* Galeria */}
      <section className="bg-coral-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Galeria" subtitle="Momentos do coral" variant="coral" />
          {photosLoading ? (
            <p className="text-center text-gray-500">Carregando fotos...</p>
          ) : photos.length > 0 ? (
            <div className="relative" data-aos="fade-up">
              <div className="overflow-hidden" ref={photosRef}>
                <div className="flex -ml-4">
                  {photos.map((p, i) => (
                    <div
                      key={i}
                      className="min-w-0 shrink-0 grow-0 basis-full pl-4 sm:basis-1/2 lg:basis-1/3"
                    >
                      <PhotoCard src={p.src} alt={p.alt} link={p.link} />
                    </div>
                  ))}
                </div>
              </div>
              <CarouselArrows
                onPrev={photosState.scrollPrev}
                onNext={photosState.scrollNext}
                prevLabel="Foto anterior"
                nextLabel="Próxima foto"
              />
              <Dots
                count={photosState.snapCount}
                current={photosState.selectedIndex}
                onSelect={photosState.scrollTo}
              />
            </div>
          ) : (
            <p className="text-center text-gray-500">Não foi possível carregar as fotos.</p>
          )}
          <div className="mt-10 text-center">
            <a
              href="https://www.flickr.com/photos/198977834@N03/albums/72177720310651390/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full border-2 border-coral-red px-8 py-3 font-heading font-bold text-coral-red transition-colors hover:bg-coral-red hover:text-black"
            >
              Ver álbum no Flickr
            </a>
          </div>
        </div>
      </section>

      {/* Fale conosco */}
      <section className="relative overflow-hidden bg-coral-ink py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-coral-ink via-[#1a1614] to-coral-ink" />
        <div className="container relative mx-auto max-w-3xl px-4">
          <div
            className="rounded-3xl border border-coral-red/40 bg-white/5 p-10 text-center backdrop-blur-lg"
            data-aos="fade-up"
          >
            <h2 className="font-heading text-3xl font-bold text-coral-red md:text-4xl">
              Fale conosco
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-gray-300">
              Quer cantar com a gente ou agendar uma apresentação? Fale com o Coral pelo WhatsApp.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#25D366] px-8 py-4 font-heading text-lg font-bold text-white transition-transform hover:scale-105"
            >
              <WhatsAppIcon />
              {WHATSAPP_DISPLAY}
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
