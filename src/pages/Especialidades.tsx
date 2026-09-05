import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AREAS, MESTRADOS, TOTAL_ESPECIALIDADES } from '@/data/especialidades'

const MANUAL_OFICIAL = 'https://www.adventistas.org/pt/desbravadores/especialidades/'

/** Sem acento e em minúsculas: buscar por "biblia" tem de achar "Bíblia". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export default function Especialidades() {
  const [busca, setBusca] = useState('')
  const [areaAtiva, setAreaAtiva] = useState<string | null>(null)

  const termo = normalizar(busca.trim())

  const areasVisiveis = useMemo(() => {
    return AREAS.map((area) => ({
      ...area,
      itens: termo ? area.itens.filter((i) => normalizar(i.nome).includes(termo)) : area.itens,
    }))
      .filter((area) => area.itens.length > 0)
      .filter((area) => !areaAtiva || area.codigo === areaAtiva)
  }, [termo, areaAtiva])

  const mestradosVisiveis = useMemo(() => {
    if (areaAtiva) return []
    return termo ? MESTRADOS.filter((m) => normalizar(m.nome).includes(termo)) : MESTRADOS
  }, [termo, areaAtiva])

  const encontradas = areasVisiveis.reduce((soma, a) => soma + a.itens.length, 0)
  const semResultado = encontradas === 0 && mestradosVisiveis.length === 0

  function limpar() {
    setBusca('')
    setAreaAtiva(null)
  }

  return (
    <main className="bg-antares-cream">
      <section className="border-b border-antares-red/10 bg-antares-ink pb-16 pt-28">
        <div className="container mx-auto max-w-5xl px-4 text-center">
          <p className="font-heading text-sm font-bold uppercase tracking-widest text-antares-gold">
            Clube de Desbravadores Antares
          </p>
          <h1 className="mt-3 font-heading text-4xl font-bold text-white md:text-5xl">
            Especialidades
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-gray-300">
            São {TOTAL_ESPECIALIDADES} especialidades, de primeiros socorros a astronomia, de
            panificação a nós e amarras. O desbravador escolhe as que quer conquistar e leva o
            distintivo na faixa.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto max-w-5xl px-4">
          {/* Busca */}
          <div className="mx-auto max-w-xl">
            <label htmlFor="busca" className="sr-only">
              Buscar especialidade
            </label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                id="busca"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar especialidade"
                className="w-full rounded-full border border-antares-red/20 bg-white py-3 pl-12 pr-4 text-gray-800 shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-antares-red"
              />
            </div>
          </div>

          {/* Áreas */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setAreaAtiva(null)}
              aria-pressed={areaAtiva === null}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                areaAtiva === null
                  ? 'border-antares-red bg-antares-red text-white'
                  : 'border-antares-red/25 text-antares-red hover:bg-antares-red/5'
              }`}
            >
              Todas
            </button>
            {AREAS.map((area) => (
              <button
                key={area.codigo}
                type="button"
                onClick={() => setAreaAtiva(area.codigo === areaAtiva ? null : area.codigo)}
                aria-pressed={area.codigo === areaAtiva}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  area.codigo === areaAtiva
                    ? 'border-antares-red bg-antares-red text-white'
                    : 'border-antares-red/25 text-antares-red hover:bg-antares-red/5'
                }`}
              >
                {area.nome}
                <span className="ml-1.5 text-xs opacity-60">{area.itens.length}</span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-gray-500" aria-live="polite">
            {termo || areaAtiva
              ? `${encontradas} ${encontradas === 1 ? 'especialidade' : 'especialidades'}`
              : `${TOTAL_ESPECIALIDADES} especialidades em ${AREAS.length} áreas`}
          </p>

          {/* Resultado */}
          {semResultado ? (
            <div className="mx-auto mt-16 max-w-md text-center">
              <p className="font-heading text-xl font-bold text-antares-red">
                Nenhuma especialidade encontrada
              </p>
              <p className="mt-2 text-gray-600">
                Não achamos nada para “{busca.trim()}”. Tente outra palavra ou veja a lista completa.
              </p>
              <button
                type="button"
                onClick={limpar}
                className="mt-6 rounded-full border-2 border-antares-red px-6 py-2 font-heading font-bold text-antares-red transition-colors hover:bg-antares-red hover:text-white"
              >
                Ver todas
              </button>
            </div>
          ) : (
            <div className="mt-12 space-y-12">
              {areasVisiveis.map((area) => (
                <div key={area.codigo}>
                  <h2 className="font-heading text-2xl font-bold text-antares-red">{area.nome}</h2>
                  <ul className="mt-4 grid gap-x-8 gap-y-1 border-t border-antares-red/10 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    {area.itens.map((item) => (
                      <li key={item.nome} className="py-1 text-gray-700">
                        {item.nome}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {mestradosVisiveis.length > 0 && (
                <div className="rounded-2xl bg-antares-sand p-8">
                  <h2 className="font-heading text-2xl font-bold text-antares-red">Mestrados</h2>
                  <p className="mt-2 max-w-2xl text-gray-600">
                    Não são especialidades avulsas. Um mestrado se conquista somando várias
                    especialidades da mesma área, e é o reconhecimento de quem foi fundo num assunto.
                  </p>
                  <ul className="mt-5 grid gap-x-8 gap-y-1 border-t border-antares-red/10 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    {mestradosVisiveis.map((m) => (
                      <li key={m.nome} className="py-1 text-gray-700">
                        {m.nome}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Fonte e volta */}
          <div className="mt-16 border-t border-antares-red/10 pt-8 text-center">
            <p className="mx-auto max-w-2xl text-sm text-gray-500">
              Os requisitos de cada especialidade estão no Manual de Especialidades da Divisão
              Sul-Americana, que não é reproduzido aqui.{' '}
              <a
                href={MANUAL_OFICIAL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-antares-red underline underline-offset-2"
              >
                Ver no site oficial dos Desbravadores
              </a>
              .
            </p>
            <Link
              to="/desbravadores"
              className="mt-8 inline-block rounded-full border-2 border-antares-red px-8 py-3 font-heading font-bold text-antares-red transition-colors hover:bg-antares-red hover:text-white"
            >
              Voltar para o clube
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
