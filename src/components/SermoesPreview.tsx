import Link from 'next/link'
import SectionTitle from './SectionTitle'
import VideoCard from './VideoCard'

const videos = [
  { videoId: '0HCo6g9-MS0', title: 'Seja bem-vindo a IASD Tucuruvi (trailer)' },
  { videoId: 'zuvnNGyEM1Y', title: '70 ANOS DE IASD TUCURUVI (9h30) - 25/05/2024' },
  { videoId: 'MZbiBsdgzJc', title: 'Cantata de Natal - Jornada da Fé' },
  { videoId: 'Muq1Tyefq_c', title: 'Musical: EXPERIÊNCIA COM DEUS' },
]

export default function SermoesPreview() {
  return (
    <section className="bg-white py-20">
      <div className="container mx-auto px-4">
        <SectionTitle title="Sermões" subtitle="Mensagens que transformam" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {videos.map((v, i) => (
            <VideoCard key={v.videoId} videoId={v.videoId} title={v.title} delay={i * 100} />
          ))}
        </div>
        <div className="mt-10 text-center" data-aos="fade-up">
          <Link
            href="/sermoes"
            className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
          >
            Ver todos os sermões
          </Link>
        </div>
      </div>
    </section>
  )
}
