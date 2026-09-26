import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@/lib/navigation'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import PhotoCard from '@/components/PhotoCard'
import SectionTitle from '@/components/SectionTitle'
import Countdown, { type ServiceSlot } from '@/components/Countdown'

interface FlickrPhoto {
  src: string
  alt: string
  link: string
}

// Sábados alternados às 16h. A âncora é uma reunião que de fato aconteceu:
// sem ela não há como saber qual das duas semanas é a certa.
const REUNIAO: ServiceSlot[] = [
  { day: 6, hour: 16, minute: 0, label: 'Reunião do Clube', biweeklyFrom: '2026-09-12' },
]

// Classes dos Aventureiros: uma por ano, dos 6 aos 9. Nome, idade, cor e lei
// são os oficiais; o hexadecimal é a leitura da cor nomeada no manual.
const CLASSES = [
  { nome: 'Abelhinhas Laboriosas', idade: 6, lei: 'Obediência', cor: '#7ec4e8' },
  { nome: 'Luminares', idade: 7, lei: 'Pureza', cor: '#f08a2c' },
  { nome: 'Edificadores', idade: 8, lei: 'Bondade', cor: '#1e3a6e' },
  { nome: 'Mãos Ajudadoras', idade: 9, lei: 'Reverência', cor: '#7a2233' },
]

const WHATSAPP_URL = 'https://wa.me/5511965673971'
const WHATSAPP_DISPLAY = '(11) 96567-3971'

const SOBRE_CLUBE = `Aventureiros é o clube da Igreja Adventista do Sétimo Dia para crianças de 6 a 9 anos, e é onde começa o caminho que segue nos Desbravadores. Nos encontros eles cantam, ouvem histórias da Bíblia, plantam, cozinham, montam coisas com as próprias mãos e conquistam especialidades que vão de astronomia a culinária.

A diferença para os clubes de criança maior é que aqui a família entra junto. Os pais participam das atividades, e boa parte do que a criança aprende no sábado à tarde continua em casa durante a semana. É esse o convite do Antares Kids.`

function WhatsAppIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export default function Aventureiros() {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const autoplay = useRef(Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true }))
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start', skipSnaps: false },
    [autoplay.current]
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [snapCount, setSnapCount] = useState(0)

  useEffect(() => {
    fetch('/api/flickr/aventureiros?count=12')
      .then((res) => res.json())
      .then((data) => setPhotos(data))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <main>
      {/* Hero */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-kids-ink">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url('/img/antares-kids-hero.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-kids-ink/75 via-kids-ink/55 to-kids-ink/95" />
        <div className="relative z-10 px-4 py-20 text-center">
          <img
            src="/img/antares-kids-logo.png"
            alt="Clube de Aventureiros Antares Kids"
            className="mx-auto h-48 w-auto drop-shadow-2xl"
            data-aos="zoom-in"
          />
          <h1
            className="mt-8 font-heading text-4xl font-bold text-white md:text-6xl"
            data-aos="fade-up"
          >
            Clube de Aventureiros
          </h1>
          <p
            className="mt-4 font-heading text-lg italic text-kids-red md:text-xl"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            Aventura, fé e família, dos 6 aos 9 anos
          </p>
          <div className="mt-8" data-aos="fade-up" data-aos-delay="150">
            <Countdown schedule={REUNIAO} variant="kids" />
          </div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-3 rounded-full bg-kids-red px-8 py-4 font-heading font-bold text-white shadow-lg shadow-kids-red/30 transition-transform hover:scale-105"
            data-aos="fade-up"
            data-aos-delay="200"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Fale conosco no WhatsApp
          </a>
        </div>
      </section>

      {/* Sobre */}
      <section className="bg-kids-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Sobre o Clube" subtitle="Onde tudo começa" variant="kids" />
          <div className="grid gap-8 md:grid-cols-2" data-aos="fade-up">
            {SOBRE_CLUBE.split('\n\n').map((para, i) => (
              <p key={i} className="leading-relaxed text-gray-700">
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Galeria */}
      <section className="bg-kids-sand py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Galeria" subtitle="Momentos do clube" variant="kids" />
          {loading ? (
            <p className="text-center text-gray-500">Carregando fotos...</p>
          ) : photos.length > 0 ? (
            <div className="relative" data-aos="fade-up">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="-ml-4 flex">
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

              <button
                type="button"
                onClick={scrollPrev}
                aria-label="Foto anterior"
                className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-kids-red text-white shadow-lg transition hover:bg-kids-red/90 md:-left-5"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={scrollNext}
                aria-label="Próxima foto"
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-kids-red text-white shadow-lg transition hover:bg-kids-red/90 md:-right-5"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {snapCount > 1 && (
                <div className="mt-6 flex justify-center gap-2">
                  {Array.from({ length: snapCount }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => scrollTo(i)}
                      aria-label={`Ir para slide ${i + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        i === selectedIndex ? 'w-6 bg-kids-red' : 'w-2 bg-kids-red/30'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500">Não foi possível carregar as fotos.</p>
          )}
          <div className="mt-10 text-center">
            <a
              href="https://www.flickr.com/photos/198977834@N03/albums/72177720326030830"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full border-2 border-kids-wine px-8 py-3 font-heading font-bold text-kids-wine transition-colors hover:bg-kids-wine hover:text-white"
            >
              Ver todas as fotos
            </a>
          </div>
        </div>
      </section>

      {/* Quem pode participar */}
      <section className="bg-kids-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Quem pode participar" subtitle="Venha fazer parte" variant="kids" />
          <div className="grid gap-6 md:grid-cols-3">
            <div
              className="rounded-2xl border border-kids-wine/10 bg-kids-cream p-8 text-center shadow-sm"
              data-aos="fade-up"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-kids-red/10 text-kids-wine">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6H4v-2a4 4 0 014-4h4a4 4 0 014 4v2h-1m-9-10a4 4 0 100-8 4 4 0 000 8zm10 0a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-kids-wine">Crianças</h3>
              <p className="mt-2 text-gray-600">De 6 a 9 anos</p>
            </div>

            <div
              className="rounded-2xl border border-kids-wine/10 bg-kids-cream p-8 text-center shadow-sm"
              data-aos="fade-up"
              data-aos-delay="100"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-kids-red/10 text-kids-wine">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-kids-wine">Com a família</h3>
              <p className="mt-2 text-gray-600">Os pais participam junto</p>
            </div>

            <div
              className="rounded-2xl border border-kids-wine/10 bg-kids-cream p-8 text-center shadow-sm"
              data-aos="fade-up"
              data-aos-delay="200"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-kids-red/10 text-kids-wine">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-kids-wine">Encontros</h3>
              <p className="mt-2 text-gray-600">Sábados alternados, 16h</p>
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-gray-500" data-aos="fade-up">
            Como os encontros são de duas em duas semanas, confirme a data do próximo pelo WhatsApp
            antes de vir pela primeira vez.
          </p>
        </div>
      </section>

      {/* O caminho do aventureiro */}
      <section className="bg-kids-ink py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle
            title="O caminho do aventureiro"
            subtitle="Uma classe por ano, dos 6 aos 9"
            variant="kids"
            light
          />
          <p className="mx-auto mb-12 max-w-2xl text-center text-gray-300" data-aos="fade-up">
            Cada idade tem sua classe, com uma cor e uma lei próprias. A criança entra na classe da
            idade dela e avança um degrau por ano, até seguir para os Desbravadores aos 10.
          </p>

          <ol className="relative grid gap-8 md:grid-cols-4 md:gap-4">
            {/* Fio que liga os marcos no desktop; no celular a trilha vira coluna. */}
            <div
              className="pointer-events-none absolute left-[12%] right-[12%] top-7 hidden h-px bg-white/20 md:block"
              aria-hidden
            />
            {CLASSES.map((classe, i) => (
              <li
                key={classe.nome}
                className="relative flex items-center gap-5 md:flex-col md:gap-3 md:text-center"
                data-aos="fade-up"
                data-aos-delay={i * 70}
              >
                {i < CLASSES.length - 1 && (
                  <div
                    className="pointer-events-none absolute left-7 top-14 -bottom-8 w-px -translate-x-1/2 bg-white/20 md:hidden"
                    aria-hidden
                  />
                )}
                <span
                  className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 bg-kids-ink font-heading text-lg font-bold text-white"
                  style={{ borderColor: classe.cor }}
                >
                  {classe.idade}
                </span>
                <div>
                  <h3 className="font-heading text-lg font-bold text-white">{classe.nome}</h3>
                  <p className="text-sm text-gray-400">
                    {classe.idade} anos · {classe.lei}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden bg-kids-sand py-20">
        <div className="container relative mx-auto max-w-3xl px-4">
          <div
            className="rounded-3xl border border-kids-red/30 bg-gradient-to-br from-kids-ink via-[#2a2028] to-kids-ink p-10 text-center shadow-xl"
            data-aos="fade-up"
          >
            <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">Fale conosco</h2>
            <p className="mx-auto mt-6 max-w-xl text-gray-300">
              Tire dúvidas, saiba a data do próximo encontro e inscreva seu filho ou filha pelo
              WhatsApp.
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
            <p className="mt-6 text-sm text-gray-400">
              Tem filho maior de 10 anos?{' '}
              <Link to="/desbravadores" className="font-medium text-kids-red underline underline-offset-2">
                Conheça o Clube de Desbravadores
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
