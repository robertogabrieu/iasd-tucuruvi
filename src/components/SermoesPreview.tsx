import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SectionTitle from './SectionTitle'
import VideoCard from './VideoCard'

interface Video {
  videoId: string
  title: string
}

export default function SermoesPreview() {
  const [videos, setVideos] = useState<Video[]>([])

  useEffect(() => {
    fetch('/api/youtube/cultos?count=4')
      .then((res) => res.json())
      .then((data) => setVideos(data))
      .catch(() => setVideos([]))
  }, [])

  return (
    <section className="bg-white py-20">
      <div className="container mx-auto max-w-5xl px-4">
        <SectionTitle title="Sermões" subtitle="Mensagens que transformam" />
        {videos.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {videos.map((v, i) => (
              <VideoCard key={v.videoId} videoId={v.videoId} title={v.title} delay={i * 100} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">Sermões em breve.</p>
        )}
        <div className="mt-10 text-center" data-aos="fade-up">
          <Link
            to="/sermoes"
            className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
          >
            Ver todos os sermões
          </Link>
        </div>
      </div>
    </section>
  )
}
