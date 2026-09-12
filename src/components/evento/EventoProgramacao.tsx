import { agruparPorDia, faixaDeHorario } from '@/lib/programacao'
import type { SessaoDTO } from '@/schemas/evento'

/**
 * A programação do evento, agrupada por dia. Evento de um horário só não mostra cartão
 * nenhum: a data continua no topo, como sempre foi.
 */
export default function EventoProgramacao({ sessoes }: { sessoes: SessaoDTO[] }) {
  if (sessoes.length < 2) return null
  const grupos = agruparPorDia(sessoes)

  return (
    <section id="programacao" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-heading font-bold text-iasd-dark">Programação</h2>
      <div className="mt-5 space-y-7">
        {grupos.map(grupo => (
          <div key={grupo.dia}>
            <p className="font-heading text-base font-bold text-iasd-dark">{grupo.rotulo}</p>
            <ul className="mt-2 divide-y divide-gray-100 border-t border-gray-100">
              {grupo.sessoes.map(s => (
                <li key={s.id} className="grid gap-1.5 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
                  <p className="text-sm font-bold tabular-nums text-iasd-accent">{faixaDeHorario(s.startsAt, s.endsAt)}</p>
                  <div className="min-w-0">
                    {s.title && <p className="text-sm font-medium text-gray-800">{s.title}</p>}
                    {s.description && (
                      <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{s.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
