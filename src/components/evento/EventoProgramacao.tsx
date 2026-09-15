import { textoSobre } from '@/lib/cores'
import { agruparPorDia, faixaDeHorario } from '@/lib/programacao'
import type { SessaoDTO } from '@/schemas/evento'

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/**
 * A programação do evento, um bloco por dia: o quadrado da data na cor do evento e, ao lado,
 * os horários daquele dia. Evento de um horário só não mostra cartão nenhum: a data continua
 * no topo, como sempre foi.
 */
export default function EventoProgramacao({ sessoes, cor }: { sessoes: SessaoDTO[]; cor: string }) {
  if (sessoes.length < 2) return null
  const grupos = agruparPorDia(sessoes)

  return (
    <section id="programacao" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-heading font-bold text-iasd-dark">Programação</h2>
      <ol className="mt-5 space-y-3">
        {grupos.map(grupo => (
          <li key={grupo.dia} className="flex gap-4 rounded-xl bg-iasd-light p-3 sm:gap-5 sm:p-4">
            <QuadradoDaData dia={grupo.dia} cor={cor} />
            <div className="w-px shrink-0 bg-gray-300" aria-hidden="true" />
            <div className="min-w-0 flex-1 self-center">
              <h3 className="sr-only">{grupo.rotulo}</h3>
              <ul className="space-y-3">
                {grupo.sessoes.map(s => (
                  <li key={s.id}>
                    <p className="text-sm font-bold tabular-nums text-iasd-accent">
                      {faixaDeHorario(s.startsAt, s.endsAt)}
                    </p>
                    {s.title && (
                      <p className="font-heading font-bold leading-snug text-iasd-dark">{s.title}</p>
                    )}
                    {s.description && (
                      <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-gray-600">{s.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * O dia já chega como data civil de São Paulo ("2026-10-16"), então as partes saem do texto
 * direto — formatar de novo por fuso poderia empurrar a data para o dia vizinho.
 */
function QuadradoDaData({ dia, cor }: { dia: string; cor: string }) {
  const [ano, mes, numero] = dia.split('-').map(Number)
  const diaDaSemana = DIAS_DA_SEMANA[new Date(Date.UTC(ano, mes - 1, numero)).getUTCDay()]

  return (
    <div
      aria-hidden="true"
      className="flex h-20 w-20 shrink-0 flex-col items-center justify-center self-start rounded-lg font-heading uppercase shadow-sm"
      style={{ backgroundColor: cor, color: textoSobre(cor) }}
    >
      <span className="text-[11px] font-bold tracking-[0.16em] opacity-80">{diaDaSemana}</span>
      <span className="text-3xl font-bold leading-none">{numero}</span>
      <span className="text-xs font-bold tracking-wider">{MESES[mes - 1]}.</span>
    </div>
  )
}
