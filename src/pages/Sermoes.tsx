import { useEffect, useState } from 'react'
import VideoCard from '@/components/VideoCard'
import SectionTitle from '@/components/SectionTitle'

interface Video {
  videoId: string
  title: string
}

export default function Sermoes() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/youtube/cultos?count=12')
      .then((res) => res.json())
      .then((data) => setVideos(data))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="bg-white pt-24 pb-20">
      <div className="container mx-auto max-w-5xl px-4">
        <SectionTitle title="Sermões" subtitle="Todos os cultos de sábado" />
        {loading ? (
          <p className="text-center text-gray-500">Carregando sermões...</p>
        ) : videos.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v, i) => (
              <VideoCard key={v.videoId} videoId={v.videoId} title={v.title} delay={i * 50} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">Não foi possível carregar os sermões.</p>
        )}
        <div className="mt-10 text-center">
          <a
            href="https://www.youtube.com/@IASDTucuruviOficial/streams"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
          >
            Ao Vivo no canal
          </a>
        </div>
      </div>
    </main>
  )
}
