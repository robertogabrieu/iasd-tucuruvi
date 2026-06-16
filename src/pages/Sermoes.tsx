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
    fetch('/api/youtube/cultos?count=15')
      .then((res) => res.json())
      .then((data) => setVideos(data))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="bg-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        <SectionTitle title="Sermões" subtitle="Todos os cultos de sábado" />
        {loading ? (
          <p className="text-center text-gray-500">Carregando sermões...</p>
        ) : videos.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((v, i) => (
              <VideoCard key={v.videoId} videoId={v.videoId} title={v.title} delay={i * 50} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">Não foi possível carregar os sermões.</p>
        )}
      </div>
    </main>
  )
}
