import { diaCivil, hora } from '@/lib/programacao'

export interface HorarioDeCulto {
  /** 0 = domingo. */
  diaDaSemana: number
  hora: number
  minuto: number
  nome: string
  /** Como a seção "Horários de Culto" apresenta o dia. */
  rotulo: string
}

/** Os horários fixos da igreja: a seção da home e o calendário leem daqui. */
export const HORARIOS_DE_CULTO: HorarioDeCulto[] = [
  { diaDaSemana: 6, hora: 9, minuto: 30, nome: 'Culto Divino', rotulo: 'Sábado — Culto Divino' },
  { diaDaSemana: 6, hora: 11, minuto: 10, nome: 'Escola Sabatina', rotulo: 'Sábado — Escola Sabatina' },
  { diaDaSemana: 0, hora: 19, minuto: 0, nome: 'Culto', rotulo: 'Domingo — Culto' },
  { diaDaSemana: 3, hora: 20, minuto: 0, nome: 'Culto', rotulo: 'Quarta-feira — Culto' },
]

export interface CultoDoDia {
  nome: string
  /** "9h30", "19h" — no mesmo formato dos horários dos eventos. */
  hora: string
}

function horaDoCulto({ hora: h, minuto }: HorarioDeCulto): string {
  return minuto === 0 ? `${h}h` : `${h}h${String(minuto).padStart(2, '0')}`
}

/**
 * Os cultos fixos que acontecem no dia. Evento que começa na mesma hora de um culto costuma ser
 * um culto especial no lugar dele, então o culto fixo sai e fica só o evento.
 */
export function cultosDoDia(
  dia: string,
  eventosDoDia: { sessions: { startsAt: string }[] }[],
): CultoDoDia[] {
  const diaDaSemana = new Date(`${dia}T12:00:00Z`).getUTCDay()
  const ocupados = new Set(
    eventosDoDia
      .flatMap(e => e.sessions)
      .filter(s => diaCivil(s.startsAt) === dia)
      .map(s => hora(s.startsAt)),
  )
  return HORARIOS_DE_CULTO
    .filter(c => c.diaDaSemana === diaDaSemana)
    .sort((a, b) => a.hora * 60 + a.minuto - (b.hora * 60 + b.minuto))
    .map(c => ({ nome: c.nome, hora: horaDoCulto(c) }))
    .filter(c => !ocupados.has(c.hora))
}
