import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/navigation'
import SectionTitle from './SectionTitle'
import CartaoDeEvento from './evento/CartaoDeEvento'
import { textoSobre } from '@/lib/cores'
import {
  diaNaIgreja, eventosPorDia, mesDoDia, mesmoMes, nomeDoMes, semanasDoMes, somarMeses, type Mes,
} from '@/lib/calendario'
import type { EventoDTO } from '@/schemas/evento'

const DIAS_DA_SEMANA = [
  ['D', 'Domingo'], ['S', 'Segunda'], ['T', 'Terça'], ['Q', 'Quarta'],
  ['Q', 'Quinta'], ['S', 'Sexta'], ['S', 'Sábado'],
] as const

export default function ProximosEventos() {
  const [eventos, setEventos] = useState<EventoDTO[]>([])
  const hoje = diaNaIgreja(new Date())
  const [mes, setMes] = useState<Mes>(() => mesDoDia(hoje))

  useEffect(() => {
    fetch('/api/eventos')
      .then(res => (res.ok ? res.json() : null))
      .then(body => setEventos(body?.eventos ?? []))
      .catch(() => setEventos([]))
  }, [])

  const porDia = useMemo(() => eventosPorDia(eventos), [eventos])

  // Na home, calendário em branco é só espaço: a seção existe quando há o que anunciar, e a
  // página de eventos continua explicando o vazio para quem chega pelo menu.
  if (eventos.length === 0) return null

  // A lista vem do mais perto ao mais distante, então o último evento diz até onde vale avançar.
  const primeiroMes = mesDoDia(hoje)
  const ultimoMes = mesDoDia(diaNaIgreja(eventos[eventos.length - 1].startsAt))

  return (
    <section id="eventos" className="scroll-mt-20 bg-white py-20">
      <div className="container mx-auto max-w-5xl px-4">
        <SectionTitle title="Próximos eventos" subtitle="O que vem por aí na nossa igreja" />
        <div className="grid gap-6 md:grid-cols-3">
          <div data-aos="fade-up" className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <BotaoDoMes
                rotulo="Mês anterior"
                desenho="M15 18l-6-6 6-6"
                desativado={mesmoMes(mes, primeiroMes)}
                onClick={() => setMes(somarMeses(mes, -1))}
              />
              <h3 className="font-heading text-xl font-bold text-iasd-dark">{nomeDoMes(mes)}</h3>
              <BotaoDoMes
                rotulo="Próximo mês"
                desenho="M9 18l6-6-6-6"
                desativado={mesmoMes(mes, ultimoMes)}
                onClick={() => setMes(somarMeses(mes, 1))}
              />
            </div>
            <div className="grid grid-cols-7 gap-1">
              {DIAS_DA_SEMANA.map(([letra, nome]) => (
                <abbr
                  key={nome}
                  title={nome}
                  className="pb-2 text-center font-heading text-xs font-bold text-gray-500 no-underline"
                >
                  {letra}
                </abbr>
              ))}
            </div>
            {/* Ao lado dos dois cartões o quadro fica mais alto que as semanas: elas repartem a sobra. */}
            <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1">
              {semanasDoMes(mes).flat().map((dia, i) =>
                dia ? (
                  <CasaDoDia key={dia} dia={dia} hoje={hoje} eventos={porDia.get(dia) ?? []} />
                ) : (
                  <div key={`fora-${i}`} />
                ),
              )}
            </div>
          </div>
          <div className="flex flex-col gap-6">
            {eventos.slice(0, 2).map(evento => (
              <CartaoDeEvento key={evento.id} evento={evento} />
            ))}
          </div>
        </div>
        <div className="mt-10 text-center" data-aos="fade-up">
          <Link
            to="/eventos"
            className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
          >
            Ver todos os eventos
          </Link>
        </div>
      </div>
    </section>
  )
}

// Some sem sair do lugar: o nome do mês não pula de posição quando se chega ao limite.
function BotaoDoMes({ rotulo, desenho, desativado, onClick }: {
  rotulo: string
  desenho: string
  desativado: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={desativado}
      onClick={onClick}
      className="rounded-full p-2 text-iasd-dark transition-colors hover:bg-iasd-light disabled:invisible"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={desenho} />
      </svg>
    </button>
  )
}

function CasaDoDia({ dia, hoje, eventos }: { dia: string; hoje: string; eventos: EventoDTO[] }) {
  const casa = 'flex min-h-14 flex-col rounded-lg p-1 sm:min-h-20'
  const numero = (
    <span
      className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm ${
        dia === hoje ? 'bg-iasd-dark font-bold text-white' : dia < hoje ? 'text-gray-300' : 'text-gray-700'
      }`}
    >
      {Number(dia.slice(8))}
    </span>
  )

  if (eventos.length === 0) return <div className={casa}>{numero}</div>

  // Com dois eventos no dia, escolher um deles por quem clica esconderia o outro: vai para a lista.
  const destino = eventos.length === 1 ? `/eventos/${eventos[0].slug}` : '/eventos'
  const titulos = eventos.map(e => e.title).join(' · ')

  return (
    <Link
      to={destino}
      title={titulos}
      aria-label={`${Number(dia.slice(8))}: ${titulos}`}
      className={`${casa} bg-iasd-light transition-colors hover:bg-blue-100`}
    >
      {numero}
      {/* No celular não cabe título: a cor de cada evento marca o dia. */}
      <span className="mt-1 flex justify-center gap-1 lg:hidden">
        {eventos.slice(0, 3).map(e => (
          <span key={e.id} className="h-2 w-2 rounded-full" style={{ backgroundColor: e.accentColor }} />
        ))}
      </span>
      <span className="mt-1 hidden flex-col gap-0.5 lg:flex">
        {eventos.slice(0, 2).map(e => (
          <span
            key={e.id}
            className="truncate rounded px-1 text-[11px] font-semibold leading-4"
            style={{ backgroundColor: e.accentColor, color: textoSobre(e.accentColor) }}
          >
            {e.title}
          </span>
        ))}
      </span>
    </Link>
  )
}
