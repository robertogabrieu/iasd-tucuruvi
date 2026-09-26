import { useCallback, useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import PhotoCard from '@/components/PhotoCard'
import SectionTitle from '@/components/SectionTitle'

interface FlickrPhoto {
  src: string
  alt: string
  link: string
}

const WHATSAPP_URL = 'https://wa.me/5511941277521'
const WHATSAPP_DISPLAY = '(11) 94127-7521'

const FLICKR_ALBUM_URL =
  'https://www.flickr.com/photos/198977834@N03/albums/72177720335761024'

const SOBRE_CLUBE = `O Clube Vida e Saúde é o jeito que a Igreja Adventista encontrou de cuidar de gente inteira — corpo, mente e espírito. É uma iniciativa do Departamento de Saúde, aberta a todos: quem é da igreja e quem é do bairro, profissional da área e quem nunca estudou o assunto.

A proposta é prática e preventiva: hábitos que cabem no dia a dia, atividades abertas à comunidade e conteúdo sério sobre alimentação, movimento, descanso e mente. E deixa claro desde o começo que nada disso substitui o acompanhamento médico.`

// Os oito remédios naturais, com as práticas dos estudos oficiais do Departamento de
// Saúde. São um conjunto, não uma sequência: por isso ícone, e não número.
const REMEDIOS = [
  {
    nome: 'Água',
    icone: 'M12 2.5c0 0 6 6.6 6 10.6a6 6 0 11-12 0c0-4 6-10.6 6-10.6z',
    texto:
      'Transporta nutrientes, regula a temperatura e ajuda o corpo a se limpar. A falta dela é a primeira causa de cansaço ao longo do dia.',
    pratica: 'Dois litros por dia — de seis a oito copos, no calor e no frio.',
  },
  {
    nome: 'Ar puro',
    icone: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
    texto:
      'É o oxigênio que renova o sangue e chega a cada célula. Perto de árvores o ar é melhor: são elas que filtram o que respiramos.',
    pratica:
      'Respiração funda de 5 a 10 minutos pela manhã; quem trabalha sentado, 2 minutos a cada duas horas.',
  },
  {
    nome: 'Luz solar',
    icone:
      'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    texto:
      'É o que faz o corpo produzir vitamina D, que fortalece os ossos. O sol também mexe com o ânimo e ajuda em quadros de desânimo ligados ao inverno.',
    pratica: 'Vinte minutos por dia, antes das 10h ou depois das 16h. Sem esperar bronzear.',
  },
  {
    nome: 'Exercício',
    icone: 'M13 10V3L4 14h7v7l9-11h-7z',
    texto:
      'Melhora a circulação, ajuda a dormir, segura o estresse e produz as substâncias ligadas ao bem-estar. Corpo parado atrofia.',
    pratica: 'Caminhar, nadar ou pedalar de 3 a 5 vezes por semana, começando por 20 minutos.',
  },
  {
    nome: 'Alimentação',
    icone: 'M12 21V11M12 11c0-4 3-7 8-7 0 5-3 8-8 7zM12 14c0-3-2-5-6-5 0 4 2 6 6 5z',
    texto:
      'O que decide é a qualidade, não a quantidade: barriga cheia não quer dizer bem alimentado. Verduras, legumes e frutas todos os dias.',
    pratica: 'Café da manhã reforçado, almoço para repor, jantar leve e antes das 21h.',
  },
  {
    nome: 'Descanso',
    icone: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
    texto:
      'É dormindo que a memória se fixa, a defesa do corpo se refaz e o cansaço do dia vai embora. Quem dorme mal come mais e rende menos.',
    pratica: 'De 6 a 8 horas, em horário parecido todo dia — inclusive no fim de semana.',
  },
  {
    nome: 'Temperança',
    icone:
      'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
    texto:
      'É o equilíbrio: largar de vez o que faz mal e usar com medida o que faz bem. Vale para o cigarro e a bebida, e vale para o trabalho que não tem hora de acabar.',
    pratica: 'Reconhecer onde a vida saiu do prumo e se afastar do que puxa para lá.',
  },
  {
    nome: 'Confiança em Deus',
    icone:
      'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    texto:
      'No material do clube, este é o primeiro de todos — o que dá sentido aos outros sete. "O coração alegre serve de bom remédio", diz Provérbios 17:22.',
    pratica: 'Um tempo a sós por dia, longe da correria, para ler e orar.',
  },
]

const CANAIS = [
  {
    tipo: 'Revista',
    nome: 'Vida e Saúde',
    texto:
      'A revista de saúde mais antiga do Brasil, publicada desde 1939 pela editora da igreja. Artigos, receitas vegetarianas e podcasts, com acesso livre no site.',
    url: 'https://www.vidaesaude.com.br/',
    display: 'vidaesaude.com.br',
  },
  {
    tipo: 'Programa de TV',
    nome: 'Vida e Saúde na Novo Tempo',
    texto:
      'No ar desde 2009, de segunda a sexta às 16h, com reprise às 8h30. Entrevistas com profissionais de saúde e receitas preparadas no estúdio.',
    url: 'https://www.novotempo.com/programa/vidaesaude/',
    display: 'novotempo.com',
  },
  {
    tipo: 'Vídeos',
    nome: 'Vida e Saúde no YouTube',
    texto:
      'Os programas completos e os quadros avulsos, para assistir na hora que der. É o material que os clubes usam nos encontros pelo Brasil.',
    url: 'https://www.youtube.com/@VidaeSaudeNT',
    display: 'youtube.com/@VidaeSaudeNT',
  },
]

function WhatsAppIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

/**
 * O feed do Flickr traz como título o nome do arquivo da câmera ("_MG_8396"), que não
 * descreve nada para quem usa leitor de tela. Nesses casos, troca por uma legenda.
 */
function legendaDaFoto(titulo: string, indice: number, total: number) {
  const nomeDeArquivo = /^[_a-z]*\d+$/i.test(titulo.trim())
  return nomeDeArquivo || !titulo.trim()
    ? `Clube Vida e Saúde, foto ${indice + 1} de ${total}`
    : titulo
}

export default function VidaESaude() {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const autoplay = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })
  )
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start', skipSnaps: false },
    [autoplay.current]
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [snapCount, setSnapCount] = useState(0)

  useEffect(() => {
    fetch('/api/flickr/vidasaude?count=12')
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
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-vidasaude-ink">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url('/img/vidasaude-hero.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-vidasaude-ink/80 via-vidasaude-ink/60 to-vidasaude-ink/95" />
        <div className="relative z-10 px-4 py-20 text-center">
          <img
            src="/img/vidasaude-logo.png"
            alt="Clube Vida e Saúde"
            className="mx-auto w-72 max-w-full drop-shadow-2xl md:w-96"
            data-aos="zoom-in"
          />
          <h1
            className="mt-8 font-heading text-4xl font-bold text-white md:text-6xl"
            data-aos="fade-up"
          >
            Clube Vida e Saúde
          </h1>
          <p
            className="mt-4 font-heading text-lg italic text-vidasaude-gold md:text-xl"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            Cuidar do corpo também é adorar a Deus
          </p>
          <p
            className="mx-auto mt-6 max-w-xl text-gray-300"
            data-aos="fade-up"
            data-aos-delay="150"
          >
            O cuidado com a saúde como parte da missão da igreja: prevenção, bons hábitos e
            qualidade de vida, para quem é daqui e para o bairro.
          </p>
          <a
            href="#contato"
            className="mt-8 inline-flex items-center gap-3 rounded-full bg-vidasaude-red px-8 py-4 font-heading font-bold text-vidasaude-ink shadow-lg shadow-vidasaude-red/30 transition-transform hover:scale-105"
            data-aos="fade-up"
            data-aos-delay="200"
          >
            Quero participar
          </a>
        </div>
      </section>

      {/* Sobre */}
      <section className="bg-vidasaude-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Sobre o Clube" subtitle="Cuidar de gente inteira" variant="vidasaude" />
          <div className="grid gap-8 md:grid-cols-2" data-aos="fade-up">
            {SOBRE_CLUBE.split('\n\n').map((para, i) => (
              <p key={i} className="leading-relaxed text-gray-700">
                {para}
              </p>
            ))}
          </div>
          <div className="mt-10 text-center" data-aos="fade-up">
            <span className="inline-block rounded-full bg-vidasaude-red px-6 py-2 font-heading text-sm font-bold text-vidasaude-ink">
              Iniciativa oficial do Departamento de Saúde da Igreja Adventista
            </span>
          </div>
        </div>
      </section>

      {/* Galeria */}
      <section id="galeria" className="scroll-mt-20 bg-vidasaude-sand py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Galeria" subtitle="Momentos do clube" variant="vidasaude" />
          {loading ? (
            <p className="text-center text-gray-500">Carregando fotos...</p>
          ) : photos.length > 0 ? (
            <div className="relative" data-aos="fade-up">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex -ml-4">
                  {photos.map((p, i) => (
                    <div
                      key={i}
                      className="min-w-0 shrink-0 grow-0 basis-full pl-4 sm:basis-1/2 lg:basis-1/3"
                    >
                      <PhotoCard
                        src={p.src}
                        alt={legendaDaFoto(p.alt, i, photos.length)}
                        link={p.link}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={scrollPrev}
                aria-label="Foto anterior"
                className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-vidasaude-red text-vidasaude-ink shadow-lg transition hover:bg-vidasaude-red/90 md:-left-5"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={scrollNext}
                aria-label="Próxima foto"
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-vidasaude-red text-vidasaude-ink shadow-lg transition hover:bg-vidasaude-red/90 md:-right-5"
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
                        i === selectedIndex ? 'w-6 bg-vidasaude-red' : 'w-2 bg-vidasaude-red/30'
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
              href={FLICKR_ALBUM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full border-2 border-vidasaude-red px-8 py-3 font-heading font-bold text-vidasaude-ink transition-colors hover:bg-vidasaude-red"
            >
              Ver todas as fotos
            </a>
          </div>
        </div>
      </section>

      {/* A proposta do clube */}
      <section className="bg-vidasaude-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="A proposta do clube" subtitle="Prática, não teoria" variant="vidasaude" />
          <div className="grid gap-6 md:grid-cols-3">
            <div
              className="rounded-2xl border border-vidasaude-ink/10 bg-vidasaude-cream p-8 text-center shadow-sm"
              data-aos="fade-up"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-vidasaude-red/20 text-vidasaude-ink">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-vidasaude-ink">
                Os oito remédios naturais
              </h3>
              <p className="mt-2 text-gray-600">
                Água, ar puro, luz solar, exercício, alimentação, descanso, temperança e confiança
                em Deus. É a base da mensagem de saúde adventista.
              </p>
              <a
                href="#remedios"
                className="mt-3 inline-block font-heading text-sm font-bold text-vidasaude-red underline underline-offset-4"
              >
                Ver o que é cada um
              </a>
            </div>

            <div
              className="rounded-2xl border border-vidasaude-ink/10 bg-vidasaude-cream p-8 text-center shadow-sm"
              data-aos="fade-up"
              data-aos-delay="100"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-vidasaude-red/20 text-vidasaude-ink">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-vidasaude-ink">Oficinas e feiras</h3>
              <p className="mt-2 text-gray-600">
                Culinária saudável, horta em casa, aferição e orientação na Feira Vida e Saúde: o
                repertório de atividades que um clube pode levar ao bairro.
              </p>
            </div>

            <div
              className="rounded-2xl border border-vidasaude-ink/10 bg-vidasaude-cream p-8 text-center shadow-sm"
              data-aos="fade-up"
              data-aos-delay="200"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-vidasaude-red/20 text-vidasaude-ink">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6H4v-2a4 4 0 014-4h4a4 4 0 014 4v2h-1m-9-10a4 4 0 100-8 4 4 0 000 8zm10 0a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
              </div>
              <h3 className="font-heading text-xl font-bold text-vidasaude-ink">Ações na comunidade</h3>
              <p className="mt-2 text-gray-600">
                Caminhadas, corridas e atividades abertas a quem mora por perto. Aqui em Tucuruvi,
                é o Maranata 360 — logo abaixo nesta página.
              </p>
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-gray-500" data-aos="fade-up">
            Todo mundo é bem-vindo: membro da igreja ou não, com formação em saúde ou sem nenhuma.
            Para saber o que está acontecendo por aqui, fale com a gente no WhatsApp.
          </p>
        </div>
      </section>

      {/* Os oito remédios naturais */}
      <section id="remedios" className="scroll-mt-20 bg-vidasaude-sand py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle
            title="Os oito remédios naturais"
            subtitle="A base da mensagem de saúde adventista"
            variant="vidasaude"
          />
          <p className="mx-auto mb-12 max-w-2xl text-center text-gray-700" data-aos="fade-up">
            São oito coisas simples, ao alcance de qualquer pessoa e de graça. A igreja fala delas
            há mais de 170 anos, e cada uma vem com uma prática que cabe no dia de hoje.
          </p>

          <div className="grid gap-6 md:grid-cols-2 md:gap-x-10">
            {REMEDIOS.map((remedio, i) => (
              <article
                key={remedio.nome}
                className="flex items-start gap-5 border-t border-vidasaude-ink/10 pt-6"
                data-aos="fade-up"
                data-aos-delay={(i % 2) * 80}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-vidasaude-red/20 text-vidasaude-red">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={remedio.icone} />
                  </svg>
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-vidasaude-ink">{remedio.nome}</h3>
                  <p className="mt-1.5 text-[0.9375rem] text-gray-700">{remedio.texto}</p>
                  <p className="mt-3 border-l-[3px] border-vidasaude-gold pl-3 font-heading text-sm font-semibold text-vidasaude-ink">
                    {remedio.pratica}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-gray-500" data-aos="fade-up">
            Nenhum deles substitui acompanhamento médico — o próprio manual do clube faz questão de
            dizer que a medicina tradicional não está sendo dispensada aqui.
          </p>
        </div>
      </section>

      {/* Onde acompanhar */}
      <section className="bg-vidasaude-ink py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle
            title="Onde acompanhar"
            subtitle="Conteúdo oficial, o ano inteiro"
            variant="vidasaude"
            light
          />
          <p className="mx-auto mb-12 max-w-2xl text-center text-gray-300" data-aos="fade-up">
            A própria igreja mantém três canais de saúde abertos a qualquer pessoa, com artigos,
            receitas e programas novos toda semana.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {CANAIS.map((canal, i) => (
              <a
                key={canal.url}
                href={canal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-7 transition hover:-translate-y-0.5 hover:border-vidasaude-gold/50 hover:bg-white/10"
                data-aos="fade-up"
                data-aos-delay={i * 100}
              >
                <span className="font-heading text-xs font-bold uppercase tracking-widest text-vidasaude-gold">
                  {canal.tipo}
                </span>
                <span className="font-heading text-lg font-bold text-white">{canal.nome}</span>
                <span className="text-[0.9375rem] text-gray-300">{canal.texto}</span>
                <span className="mt-auto break-words pt-3 text-[0.8125rem] font-semibold text-vidasaude-red">
                  {canal.display}
                </span>
              </a>
            ))}
          </div>

          <p className="mt-12 text-center text-gray-400" data-aos="fade-up">
            Os oito remédios naturais, receita a receita — sem precisar esperar a próxima atividade.
          </p>
        </div>
      </section>


      {/* Vida por Vidas — identidade do projeto, em fundo branco */}
      <section id="vida-por-vidas" className="scroll-mt-20 bg-white py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="grid items-center gap-10 lg:grid-cols-[5fr_7fr] lg:gap-14">
            <div className="text-center" data-aos="fade-right">
              <img
                src="/img/vidaporvidas-logo.png"
                alt="Vida por Vidas"
                className="mx-auto w-80 max-w-full"
              />
              <p className="mt-5 font-heading text-[0.8125rem] font-bold uppercase tracking-wider text-gray-500">
                Projeto do Ministério Jovem
              </p>
            </div>

            <div data-aos="fade-left">
              <p className="font-heading text-xs font-bold uppercase tracking-widest text-vidaporvidas-red">
                Doação de sangue
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold text-vidaporvidas-ink md:text-4xl">
                Uma doação, até quatro vidas
              </h2>
              <p className="mt-4 leading-relaxed text-gray-700">
                O Vida por Vidas existe desde 2005 e virou uma das maiores campanhas de doação de
                sangue da América do Sul: são voluntários em oito países e mais de 1,2 milhão de
                doadores até aqui. A conta que a campanha faz é simples — uma bolsa de sangue pode
                atender até quatro pessoas.
              </p>
              <p className="mt-4 leading-relaxed text-gray-700">
                Além do sangue, o projeto cadastra doadores de medula óssea e trabalha para que quem
                doou uma vez volte a doar. Nada disso depende de estrutura: depende de gente
                aparecendo no hemocentro no dia combinado.
              </p>

              <ul className="mt-7 flex flex-wrap gap-x-10 gap-y-4 border-t border-vidaporvidas-ink/10 pt-6">
                {[
                  { valor: '2005', rotulo: 'Desde' },
                  { valor: '8', rotulo: 'Países' },
                  { valor: '1,2 mi', rotulo: 'Doadores' },
                ].map((item) => (
                  <li key={item.rotulo} className="flex flex-col">
                    <span className="font-heading text-3xl font-extrabold leading-none tabular-nums text-vidaporvidas-red">
                      {item.valor}
                    </span>
                    <span className="font-heading text-[0.7rem] font-bold uppercase tracking-widest text-gray-500">
                      {item.rotulo}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-3 rounded-full bg-vidaporvidas-red px-8 py-4 font-heading font-bold text-white transition-transform hover:scale-105"
              >
                <WhatsAppIcon className="h-5 w-5" />
                Quero doar na próxima
              </a>
              <p className="mt-4 text-[0.8125rem] text-gray-500">
                Para doar: de 16 a 69 anos, pelo menos 50 kg, ter dormido seis horas, estar
                alimentado e levar documento com foto. Menor de 18 precisa de autorização do
                responsável, e quem passou dos 60 só doa se já tiver doado antes. A triagem no
                hemocentro confirma na hora.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Maranata 360 entre edições: data, vagas, distâncias e a arte da edição que passou
          saem daqui — o que continua valendo é que a corrida existe e volta. */}
      <section id="maranata" className="relative scroll-mt-20 overflow-hidden bg-maranata-ink py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-maranata-ink via-maranata-navy/60 to-maranata-ink" />
        <div className="container relative mx-auto max-w-3xl px-4 text-center" data-aos="fade-up">
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-maranata-orange">
            Nossa corrida anual
          </p>
          <h2 className="mt-3 font-heading text-4xl font-extrabold uppercase italic text-white md:text-5xl">
            Maranata 360
          </h2>
          <p className="mt-2 font-heading text-lg font-bold text-white/70">
            Mais que uma corrida, uma missão!
          </p>

          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-maranata-orange/40 bg-maranata-orange/10 p-6">
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-maranata-orange">
              Até a próxima
            </p>
            <p className="mt-2 font-heading text-2xl font-bold text-white">A III Edição vem aí</p>
            <p className="mt-3 text-sm text-gray-300">
              Chame no WhatsApp para saber quando abrem as inscrições.
            </p>
          </div>

          <a
            href="#galeria"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-maranata-orange px-8 py-3 font-heading font-bold text-white transition-transform hover:scale-105"
          >
            Ver os registros
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </a>
        </div>
      </section>

      {/* Fale conosco */}
      <section id="contato" className="relative scroll-mt-20 overflow-hidden bg-vidasaude-ink py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-vidasaude-ink via-[#134048] to-vidasaude-ink" />
        <div className="container relative mx-auto max-w-3xl px-4">
          <div
            className="rounded-3xl border border-vidasaude-gold/30 bg-white/10 p-10 text-center backdrop-blur-lg"
            data-aos="fade-up"
          >
            <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">Fale conosco</h2>
            <p className="mx-auto mt-6 max-w-xl text-gray-300">
              Chame no WhatsApp para saber como participar e o que está acontecendo por aqui. Não
              precisa ser da igreja nem entender de saúde para começar.
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
