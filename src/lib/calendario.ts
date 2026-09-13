/**
 * O calendário fala no dia da igreja, em São Paulo: um evento às 22h de sábado não pode cair
 * no domingo só porque quem abre o site está com o computador em outro fuso.
 */
const FUSO = 'America/Sao_Paulo'

const formatoDoDia = new Intl.DateTimeFormat('sv-SE', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
})

/**
 * Um evento cadastrado com o término errado (um ano em vez de um dia) não pode encher o
 * calendário de marcações: nenhuma programação da igreja passa de dois meses.
 */
const DIAS_NO_MAXIMO = 62

const UM_DIA = 24 * 60 * 60 * 1000

/** Mês do calendário; `mes` vai de 1 a 12. */
export interface Mes {
  ano: number
  mes: number
}

/** "2026-09-26" — o dia, no fuso da igreja, em que o instante cai. */
export function diaNaIgreja(instante: Date | string): string {
  return formatoDoDia.format(new Date(instante))
}

export function mesDoDia(dia: string): Mes {
  const [ano, mes] = dia.split('-').map(Number)
  return { ano, mes }
}

export function somarMeses({ ano, mes }: Mes, quantos: number): Mes {
  const total = ano * 12 + (mes - 1) + quantos
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 }
}

export function mesmoMes(a: Mes, b: Mes): boolean {
  return a.ano === b.ano && a.mes === b.mes
}

/** "Setembro de 2026". */
export function nomeDoMes({ ano, mes }: Mes): string {
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(ano, mes - 1, 1)))
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

/** As semanas do mês, de domingo a sábado; `null` ocupa as casas que ficam fora do mês. */
export function semanasDoMes({ ano, mes }: Mes): (string | null)[][] {
  const diaDaSemanaDoPrimeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay()
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const casas: (string | null)[] = [
    ...Array<null>(diaDaSemanaDoPrimeiro).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => `${ano}-${doisDigitos(mes)}-${doisDigitos(i + 1)}`),
  ]
  while (casas.length % 7 !== 0) casas.push(null)

  const semanas: (string | null)[][] = []
  for (let i = 0; i < casas.length; i += 7) semanas.push(casas.slice(i, i + 7))
  return semanas
}

/** Liga cada dia aos eventos que acontecem nele; evento de vários dias marca todos eles. */
export function eventosPorDia<T extends { startsAt: string; endsAt: string | null }>(
  eventos: T[],
): Map<string, T[]> {
  const porDia = new Map<string, T[]>()
  for (const evento of eventos) {
    const inicio = diaNaIgreja(evento.startsAt)
    const fim = evento.endsAt ? diaNaIgreja(evento.endsAt) : inicio
    let instante = Date.parse(`${inicio}T00:00:00Z`)
    for (let i = 0; i < DIAS_NO_MAXIMO; i++) {
      const dia = new Date(instante).toISOString().slice(0, 10)
      if (i > 0 && dia > fim) break
      porDia.set(dia, [...(porDia.get(dia) ?? []), evento])
      instante += UM_DIA
    }
  }
  return porDia
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0')
}
