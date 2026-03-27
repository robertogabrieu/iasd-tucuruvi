import VideoCard from '@/components/VideoCard'
import SectionTitle from '@/components/SectionTitle'

const allVideos = [
  { videoId: '0HCo6g9-MS0', title: 'Seja bem-vindo a IASD Tucuruvi (trailer)' },
  { videoId: 'zuvnNGyEM1Y', title: '70 ANOS DE IASD TUCURUVI (9h30) - 25/05/2024' },
  { videoId: 'ZV_UXcNNabM', title: '70 ANOS DE IASD TUCURUVI (17h00) - Especial Musical' },
  { videoId: 'MZbiBsdgzJc', title: 'Cantata de Natal - Jornada da Fé' },
  { videoId: 'Muq1Tyefq_c', title: 'Musical: EXPERIÊNCIA COM DEUS' },
  { videoId: 'mBPypmoo4yw', title: 'Cantata de Páscoa: VIVO ESTÁ' },
  { videoId: 'K1d4r_nIId4', title: 'CORAL ADVENTISTA DE TUCURUVI' },
  { videoId: '9Li0edw61HY', title: 'MUSICAL DE PÁSCOA "VIVO ESTÁ"' },
  { videoId: 'cawrd0aPDvU', title: '70 anos - Convite (Teaser 1)' },
  { videoId: '3hiORI0vaq4', title: '70 anos - Convite (Teaser 2)' },
  { videoId: 'Jg0WyvzXrxE', title: '70 anos - Convite (Depoimentos 2)' },
  { videoId: 'AKX-85v-r2s', title: '70 anos - Convite (Depoimentos 1)' },
]

export default function Sermoes() {
  return (
    <main className="bg-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        <SectionTitle title="Sermões" subtitle="Todas as mensagens" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {allVideos.map((v, i) => (
            <VideoCard key={v.videoId} videoId={v.videoId} title={v.title} delay={i * 50} />
          ))}
        </div>
      </div>
    </main>
  )
}
