import { useState, useEffect } from 'react'

export interface ServiceSlot {
  /** Dia da semana, 0 = domingo. */
  day: number
  hour: number
  minute: number
  label: string
  /**
   * Para encontros de duas em duas semanas: a data (`AAAA-MM-DD`) de um
   * encontro que de fato aconteceu. Sem essa âncora não há como saber qual
   * das duas semanas é a certa, e a contagem erraria em metade delas.
   */
  biweeklyFrom?: string
}

/** Fuso da igreja. A conta não pode depender do relógio de quem abre a página. */
const TIME_ZONE = 'America/Sao_Paulo'

export const CULTOS: ServiceSlot[] = [
  { day: 6, hour: 9, minute: 30, label: 'Culto de Sábado' },
  { day: 0, hour: 19, minute: 0, label: 'Culto de Domingo' },
  { day: 3, hour: 20, minute: 0, label: 'Culto de Quarta' },
]

const zoneFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Data e hora de parede em São Paulo para um instante. */
function wallClockInZone(utcMs: number) {
  const parts: Record<string, number> = {}
  for (const p of zoneFormat.formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value)
  }
  // Alguns ambientes devolvem 24 em vez de 0 para a meia-noite.
  return { ...parts, hour: parts.hour % 24 } as {
    year: number; month: number; day: number; hour: number; minute: number; second: number
  }
}

/** Quanto o fuso está adiantado/atrasado em relação ao UTC naquele instante. */
function zoneOffsetMs(utcMs: number): number {
  const w = wallClockInZone(utcMs)
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - utcMs
}

/**
 * Instante absoluto de um horário de parede em São Paulo. A segunda passada
 * existe para a virada de horário de verão, caso ele volte a existir: o
 * deslocamento correto é o do instante de chegada, não o do de partida.
 */
function zonedToUtc(year: number, monthIndex: number, day: number, hour: number, minute: number): number {
  const naive = Date.UTC(year, monthIndex, day, hour, minute)
  const primeira = naive - zoneOffsetMs(naive)
  return naive - zoneOffsetMs(primeira)
}

/** Próximo horário da agenda, em milissegundos absolutos. */
export function getNextService(schedule: ServiceSlot[], nowMs: number = Date.now()) {
  const hoje = wallClockInZone(nowMs)
  const diaDaSemana = new Date(Date.UTC(hoje.year, hoje.month - 1, hoje.day)).getUTCDay()

  let proximo: { label: string; at: number } | null = null

  for (const s of schedule) {
    const faltam = (s.day - diaDaSemana + 7) % 7
    // Date.UTC normaliza dia fora do mês, então somar não estoura a virada.
    let dia = hoje.day + faltam
    let at = zonedToUtc(hoje.year, hoje.month - 1, dia, s.hour, s.minute)
    if (at <= nowMs) {
      dia += 7
      at = zonedToUtc(hoje.year, hoje.month - 1, dia, s.hour, s.minute)
    }

    if (s.biweeklyFrom) {
      // Semanas inteiras entre a âncora e o candidato. Se der ímpar, este é o
      // sábado "de folga": o encontro é no seguinte. Somar 7 dias mantém o dia
      // da semana, e recalcular (em vez de somar milissegundos) preserva a
      // hora de parede caso o horário de verão volte a existir.
      const [ano, mes, diaAncora] = s.biweeklyFrom.split('-').map(Number)
      const ancora = zonedToUtc(ano, mes - 1, diaAncora, s.hour, s.minute)
      const semanas = Math.round((at - ancora) / 604_800_000)
      if (Math.abs(semanas % 2) === 1) {
        dia += 7
        at = zonedToUtc(hoje.year, hoje.month - 1, dia, s.hour, s.minute)
      }
    }

    if (!proximo || at < proximo.at) proximo = { label: s.label, at }
  }

  return proximo!
}

export function formatDiff(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds }
}

interface CountdownProps {
  /** Agenda a contar. Default: os cultos da igreja. */
  schedule?: ServiceSlot[]
  /** Paleta do realce. Uma por página de departamento. */
  variant?: 'iasd' | 'antares' | 'kids'
}

export default function Countdown({ schedule = CULTOS, variant = 'iasd' }: CountdownProps) {
  const [next, setNext] = useState(() => getNextService(schedule))
  const [diff, setDiff] = useState(() => formatDiff(next.at - Date.now()))

  useEffect(() => {
    setNext(getNextService(schedule))
  }, [schedule])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = next.at - now

      if (remaining <= 0) {
        const updated = getNextService(schedule, now)
        setNext(updated)
        setDiff(formatDiff(updated.at - now))
      } else {
        setDiff(formatDiff(remaining))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [next, schedule])

  const blocks = [
    { value: diff.days, label: 'dias' },
    { value: diff.hours, label: 'horas' },
    { value: diff.minutes, label: 'min' },
    { value: diff.seconds, label: 'seg' },
  ]

  const borda =
    variant === 'antares' ? 'border-antares-gold/30' :
    variant === 'kids' ? 'border-kids-red/40' :
    'border-white/15'
  const destaque =
    variant === 'antares' ? 'text-antares-gold' :
    variant === 'kids' ? 'text-kids-red' :
    'text-white'

  return (
    <div className={`mx-auto inline-block rounded-2xl border ${borda} bg-white/10 px-8 py-5 backdrop-blur-sm`}>
      <p className="text-sm font-medium text-white/80">
        Próximo — <span className={`font-bold ${destaque}`}>{next.label}</span>
      </p>
      <div className="mt-3 flex justify-center gap-4">
        {blocks.map((b) => (
          <div key={b.label} className="min-w-[3.5rem]">
            <span className="block font-heading text-3xl font-bold text-white md:text-4xl">
              {String(b.value).padStart(2, '0')}
            </span>
            <span className="text-xs font-medium text-white/60">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
