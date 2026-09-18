import { useState, useEffect } from 'react'
import SectionTitle from './SectionTitle'

const CHANNEL_ID = 'UCvtcRQ8TcPLZn5dP42bODFg'

export default function AoVivo() {
  const [isLive, setIsLive] = useState<boolean | null>(null)
  const [recentIds, setRecentIds] = useState<string[] | null>(null)

  useEffect(() => {
    fetch('/api/youtube/recentes?count=20')
      .then((res) => res.json())
      .then((data: { videoId: string }[]) => setRecentIds(data.map((v) => v.videoId)))
      .catch(() => setRecentIds([]))
  }, [])

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

  const title = isLive ? 'Ao Vivo' : 'Últimos Vídeos'
  const subtitle = isLive ? 'Estamos transmitindo agora!' : 'Confira nosso canal no YouTube'

  // A lista vem do servidor para não incluir lives agendadas. Se ela vier vazia (API fora do
  // ar), cai no player de envios do canal, que ao menos mostra algo.
  const uploadsPlaylistId = CHANNEL_ID.replace('UC', 'UU')
  let embedSrc: string | null
  if (isLive) {
    embedSrc = `https://www.youtube.com/embed/live_stream?channel=${CHANNEL_ID}&autoplay=1`
  } else if (recentIds === null) {
    embedSrc = null
  } else if (recentIds.length) {
    embedSrc = `https://www.youtube.com/embed/${recentIds[0]}?playlist=${recentIds.join(',')}`
  } else {
    embedSrc = `https://www.youtube.com/embed/videoseries?list=${uploadsPlaylistId}`
  }

  return (
    <section id="ao-vivo" className="scroll-mt-20 bg-iasd-dark py-20">
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
            {embedSrc && (
              <iframe
                src={embedSrc}
                title={isLive ? 'Transmissão ao vivo — IASD Tucuruvi' : 'Últimos vídeos — IASD Tucuruvi'}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            )}
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">
            Acompanhe também pelo nosso{' '}
            <a
              href="https://www.youtube.com/@IASDTucuruviOficial"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:underline"
            >
              canal no YouTube
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
