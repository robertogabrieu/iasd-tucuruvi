import { useState, useEffect } from 'react'
import PhotoCard from '@/components/PhotoCard'
import SectionTitle from '@/components/SectionTitle'

interface FlickrPhoto {
  src: string
  alt: string
  link: string
}

const FLICKR = 'https://www.flickr.com/photos/198977834@N03'

// A primeira aba é a que abre a página. Cada botão abre no Flickr o mesmo álbum da aba.
const ABAS = [
  { chave: 'igreja', rotulo: 'Igreja', flickr: `${FLICKR}/albums/72177720318202645` },
  { chave: 'vidasaude', rotulo: 'Vida e Saúde', flickr: `${FLICKR}/albums/72177720335761024` },
  { chave: 'desbravadores', rotulo: 'Desbravadores', flickr: `${FLICKR}/albums/72177720318400790` },
  { chave: 'aventureiros', rotulo: 'Aventureiros', flickr: `${FLICKR}/albums/72177720326030830` },
] as const

type Chave = (typeof ABAS)[number]['chave']

export default function Galeria() {
  const [abaAtual, setAbaAtual] = useState<Chave>('igreja')
  // Guarda o que cada aba já trouxe, para voltar a ela sem esperar de novo.
  const [fotosPorAba, setFotosPorAba] = useState<Partial<Record<Chave, FlickrPhoto[]>>>({})

  const fotos = fotosPorAba[abaAtual]
  const aba = ABAS.find((a) => a.chave === abaAtual)!

  useEffect(() => {
    if (fotos) return
    fetch(`/api/flickr/galeria/${abaAtual}`)
      .then((res) => res.json())
      .then((data: FlickrPhoto[]) => setFotosPorAba((antes) => ({ ...antes, [abaAtual]: data })))
      .catch(() => setFotosPorAba((antes) => ({ ...antes, [abaAtual]: [] })))
  }, [abaAtual, fotos])

  return (
    <main className="bg-iasd-light pt-8 pb-20">
      <div className="container mx-auto max-w-5xl px-4">
        <SectionTitle title="Galeria" subtitle="Nossos momentos" />
        <div role="tablist" aria-label="Álbuns" className="mb-8 flex flex-wrap justify-center gap-3">
          {ABAS.map((a) => {
            const ativa = a.chave === abaAtual
            return (
              <button
                key={a.chave}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setAbaAtual(a.chave)}
                className={`rounded-full border-2 border-iasd-dark px-6 py-2 font-heading font-bold transition-colors ${
                  ativa ? 'bg-iasd-dark text-white' : 'text-iasd-dark hover:bg-iasd-dark hover:text-white'
                }`}
              >
                {a.rotulo}
              </button>
            )
          })}
        </div>
        {!fotos ? (
          <p className="text-center text-gray-500">Carregando fotos...</p>
        ) : fotos.length > 0 ? (
          <div role="tabpanel" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {fotos.map((p, i) => (
              // Atraso só dentro da linha: com 60 fotos, contar desde a primeira deixava as
              // últimas aparecendo segundos depois.
              <PhotoCard key={`${abaAtual}-${i}`} src={p.src} alt={p.alt} link={p.link} delay={(i % 4) * 50} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">Não foi possível carregar as fotos.</p>
        )}
        <div className="mt-10 text-center">
          <a
            href={aba.flickr}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
          >
            Ver todas as fotos
          </a>
        </div>
      </div>
    </main>
  )
}
