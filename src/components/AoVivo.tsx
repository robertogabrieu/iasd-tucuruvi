import { useState, useEffect } from 'react'
import SectionTitle from './SectionTitle'

const CHANNEL_ID = 'UCvtcRQ8TcPLZn5dP42bODFg'

export default function AoVivo() {
  const [isLive, setIsLive] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkLive() {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/channel/${CHANNEL_ID}/live&format=json`
        )
        if (res.ok) {
          const data = await res.json()
          const title = (data.title || '').toLowerCase()
          setIsLive(title.includes('ao vivo') || title.includes('live') || title.includes('\u{1F534}'))
        } else {
          setIsLive(false)
        }
      } catch {
        setIsLive(false)
      }
    }
    checkLive()
    const interval = setInterval(checkLive, 120_000)
    return () => clearInterval(interval)
  }, [])

  const title = isLive ? 'Ao Vivo' : 'Últimos Cultos'
  const subtitle = isLive ? 'Estamos transmitindo agora!' : 'Assista às nossas pregações'

  const uploadsPlaylistId = CHANNEL_ID.replace('UC', 'UU')
  const embedSrc = isLive
    ? `https://www.youtube.com/embed/live_stream?channel=${CHANNEL_ID}&autoplay=1`
    : `https://www.youtube.com/embed/videoseries?list=${uploadsPlaylistId}`

  return (
    <section id="ao-vivo" className="bg-iasd-dark py-20">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3" data-aos="fade-up">
            {isLive && (
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
              </span>
            )}
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-white">
              {title}
            </h2>
          </div>
          <div className="relative mt-2 inline-block">
            <p className="text-lg text-gray-300">{subtitle}</p>
            <div className="absolute inset-0 bg-iasd-dark animate-reveal-width" />
          </div>
        </div>

        <div data-aos="zoom-in" className="mx-auto max-w-4xl">
          <div className="relative aspect-video overflow-hidden rounded-lg shadow-2xl">
            <iframe
              src={embedSrc}
              title={isLive ? 'Transmissão ao vivo — IASD Tucuruvi' : 'Últimos cultos — IASD Tucuruvi'}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">
            Acompanhe também pelo nosso{' '}
            <a
              href="https://www.youtube.com/@IASDTucuruviOficial"
              target="_blank"
              rel="noopener noreferrer"
              className="text-iasd-accent hover:underline"
            >
              canal no YouTube
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
