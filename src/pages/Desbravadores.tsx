import { useEffect, useState } from 'react'
import PhotoCard from '@/components/PhotoCard'
import SectionTitle from '@/components/SectionTitle'

interface FlickrPhoto {
  src: string
  alt: string
  link: string
}

const WHATSAPP_URL = 'https://wa.me/5511965673971'
const WHATSAPP_DISPLAY = '(11) 96567-3971'
const FOUNDED_YEAR = 1961
const CLUB_AGE = new Date().getFullYear() - FOUNDED_YEAR

const LOREM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`

function WhatsAppIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export default function Desbravadores() {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/flickr/antares?count=12')
      .then((res) => res.json())
      .then((data) => setPhotos(data))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="pt-16">
      {/* Hero */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-antares-ink">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url('/img/antares-hero.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-antares-ink/70 via-antares-ink/50 to-antares-ink/90" />
        <div className="relative z-10 px-4 py-20 text-center">
          <img
            src="/img/antares-logo.png"
            alt="Clube de Desbravadores Antares"
            className="mx-auto h-48 w-48 drop-shadow-2xl"
            data-aos="zoom-in"
          />
          <h1
            className="mt-8 font-heading text-4xl font-bold text-white md:text-6xl"
            data-aos="fade-up"
          >
            Clube de Desbravadores Antares
          </h1>
          <p
            className="mt-4 font-heading text-lg italic text-antares-gold md:text-xl"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            {CLUB_AGE} anos formando líderes para Cristo
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-3 rounded-full bg-antares-red px-8 py-4 font-heading font-bold text-white shadow-lg shadow-antares-red/30 transition-transform hover:scale-105"
            data-aos="fade-up"
            data-aos-delay="200"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Fale conosco no WhatsApp
          </a>
        </div>
      </section>

      {/* Sobre */}
      <section className="bg-antares-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Sobre o Clube" subtitle="Nossa história" variant="antares" />
          <div className="grid gap-8 md:grid-cols-2" data-aos="fade-up">
            {LOREM.split('\n\n').map((para, i) => (
              <p key={i} className="text-gray-700 leading-relaxed">
                {para}
              </p>
            ))}
          </div>
          <div className="mt-10 text-center" data-aos="fade-up">
            <span className="inline-block rounded-full bg-antares-red px-6 py-2 font-heading text-sm font-bold text-white">
              Fundado em {FOUNDED_YEAR}
            </span>
          </div>
        </div>
      </section>

      {/* Quem pode participar */}
      <section className="bg-antares-sand py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Quem pode participar" subtitle="Venha fazer parte" variant="antares" />
          <div className="grid gap-6 md:grid-cols-3">
            <div
              className="rounded-2xl border border-antares-red/10 bg-antares-cream p-8 text-center shadow-sm"
              data-aos="fade-up"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-antares-red/10 text-antares-red">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6H4v-2a4 4 0 014-4h4a4 4 0 014 4v2h-1m-9-10a4 4 0 100-8 4 4 0 000 8zm10 0a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-antares-red">Crianças e adolescentes</h3>
              <p className="mt-2 text-gray-600">De 10 a 15 anos</p>
            </div>

            <div
              className="rounded-2xl border border-antares-red/10 bg-antares-cream p-8 text-center shadow-sm"
              data-aos="fade-up"
              data-aos-delay="100"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-antares-red/10 text-antares-red">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-antares-red">Liderança</h3>
              <p className="mt-2 text-gray-600">Jovens acima de 15 anos batizados na IASD</p>
            </div>

            <div
              className="rounded-2xl border border-antares-red/10 bg-antares-cream p-8 text-center shadow-sm"
              data-aos="fade-up"
              data-aos-delay="200"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-antares-red/10 text-antares-red">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-antares-red">Encontros</h3>
              <p className="mt-2 text-gray-600">Domingos às 9h</p>
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-gray-500" data-aos="fade-up">
            Algumas datas podem ter alterações por conta de feriados, treinamentos ou eventos especiais.
            Confirme a próxima reunião pelo WhatsApp.
          </p>
        </div>
      </section>

      {/* Galeria */}
      <section className="bg-antares-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Galeria" subtitle="Momentos do clube" variant="antares" />
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
              className="inline-block rounded-full border-2 border-antares-red px-8 py-3 font-heading font-bold text-antares-red transition-colors hover:bg-antares-red hover:text-white"
            >
              Ver mais no Flickr
            </a>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden bg-antares-ink py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-antares-ink via-[#2a2520] to-antares-ink" />
        <div className="container relative mx-auto max-w-3xl px-4">
          <div
            className="rounded-3xl border border-antares-gold/30 bg-white/10 p-10 text-center backdrop-blur-lg"
            data-aos="fade-up"
          >
            <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">
              Fale conosco
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-gray-300">
              Tire dúvidas, saiba valores e inscreva seu filho(a) pelo WhatsApp.
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
