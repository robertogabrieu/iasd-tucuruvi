/**
 * As contas da programação de um evento — resumo de uma linha, agrupamento por dia e
 * qual sessão vem a seguir. Tudo no fuso da igreja: o servidor roda em UTC, e um culto
 * de sexta às 21h cairia no sábado se a formatação usasse o fuso do processo.
 *
 * ESPELHO: src/lib/programacao.ts — manter em sincronia (mesma convenção de cores.ts).
 */

export const FUSO = 'America/Sao_Paulo'

/** O que a linha do "quando" comporta nas artes geradas, pela métrica de eventos.image.styles.ts. */
export const LIMITE_RESUMO = 36

export interface Sessao {
  id: string
  startsAt: string
  endsAt: string | null
  title: string | null
  description: string | null
}

export interface GrupoDeDia {
  /** O dia civil em São Paulo, como "2027-03-14" — chave de agrupamento e de React. */
  dia: string
  /** "Sexta, 13 de março" */
  rotulo: string
  sessoes: Sessao[]
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function fmt(opcoes: Intl.DateTimeFormatOptions, locale = 'pt-BR'): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { timeZone: FUSO, ...opcoes })
}

function comMaiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** O dia civil em São Paulo ("2027-03-14"), que é o que decide a que dia a sessão pertence. */
export function diaCivil(iso: string): string {
  return fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }, 'sv-SE').format(new Date(iso))
}

/** "9h30", "14h" — o relógio da igreja, sem minutos quando são zero. */
export function hora(iso: string): string {
  const texto = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  const [h, m] = texto.split(':')
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`
}

/** "19h30 às 22h00", e com a data junto quando a vigília vira a noite. */
export function faixaDeHorario(startsAt: string, endsAt: string | null): string {
  if (!endsAt) return hora(startsAt)
  const fim = diaCivil(endsAt) === diaCivil(startsAt)
    ? hora(endsAt)
    : `${fmt({ day: '2-digit', month: '2-digit' }).format(new Date(endsAt))}, ${hora(endsAt)}`
  return `${hora(startsAt)} às ${fim}`
}

function emOrdem(sessoes: Sessao[]): Sessao[] {
  return [...sessoes].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export function primeiraSessao(sessoes: Sessao[]): Sessao | null {
  return emOrdem(sessoes)[0] ?? null
}

export function ultimaSessao(sessoes: Sessao[]): Sessao | null {
  const ordenadas = emOrdem(sessoes)
  return ordenadas[ordenadas.length - 1] ?? null
}

/** O fim de uma sessão, com recuo para o início quando ninguém publicou hora de encerrar. */
function fimDe(s: Sessao): string {
  return s.endsAt ?? s.startsAt
}

export function proximaSessaoPendente(sessoes: Sessao[], agora: Date): Sessao | null {
  return emOrdem(sessoes).find(s => new Date(fimDe(s)).getTime() >= agora.getTime()) ?? null
}

export function agruparPorDia(sessoes: Sessao[]): GrupoDeDia[] {
  const grupos = new Map<string, GrupoDeDia>()
  for (const s of emOrdem(sessoes)) {
    const dia = diaCivil(s.startsAt)
    const grupo = grupos.get(dia) ?? {
      dia,
      rotulo: comMaiuscula(fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(s.startsAt))),
      sessoes: [],
    }
    grupo.sessoes.push(s)
    grupos.set(dia, grupo)
  }
  return [...grupos.values()]
}

function diaEMes(iso: string): { dia: number; mes: number } {
  const partes = diaCivil(iso).split('-').map(Number)
  return { mes: partes[1], dia: partes[2] }
}

function mesPorExtenso(iso: string): string {
  return fmt({ month: 'long' }).format(new Date(iso))
}

/**
 * O resumo de uma linha, montado em cascata: vale a forma mais informativa que cabe em
 * LIMITE_RESUMO. As horas ficam enquanto couberem — é o que faz alguém decidir se dá para ir,
 * e a arte gerada é o que a maioria vê, sem abrir o link.
 */
export function resumoDaProgramacao(sessoes: Sessao[]): string {
  const ordenadas = emOrdem(sessoes)
  if (ordenadas.length === 0) return ''

  const candidatas: string[] = []
  const dias = [...new Set(ordenadas.map(s => diaCivil(s.startsAt)))]
  const primeira = ordenadas[0]
  const ultima = ordenadas[ordenadas.length - 1]
  const quantas = `${ordenadas.length} horários`

  if (ordenadas.length === 1) {
    const dia = comMaiuscula(fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(primeira.startsAt)))
    candidatas.push(`${dia} · ${hora(primeira.startsAt)}`)
  } else if (dias.length === 1) {
    const dia = `${diaEMes(primeira.startsAt).dia} de ${mesPorExtenso(primeira.startsAt)}`
    const horas = ordenadas.map(s => hora(s.startsAt))
    if (ordenadas.length <= 3) {
      candidatas.push(`${dia} · ${horas.slice(0, -1).join(', ')} e ${horas[horas.length - 1]}`)
    }
    candidatas.push(`${dia} · ${quantas}`)
  } else {
    const a = diaEMes(primeira.startsAt)
    const b = diaEMes(ultima.startsAt)
    const ligacao = dias.length === 2 ? 'e' : 'a'
    if (a.mes === b.mes) {
      candidatas.push(`${a.dia} ${ligacao} ${b.dia} de ${mesPorExtenso(primeira.startsAt)} · ${quantas}`)
    } else {
      candidatas.push(
        `${a.dia} de ${MESES_CURTOS[a.mes - 1]} a ${b.dia} de ${MESES_CURTOS[b.mes - 1]} · ${quantas}`,
      )
    }
  }

  const escolhida = candidatas.find(c => c.length <= LIMITE_RESUMO) ?? candidatas[candidatas.length - 1]
  // Rede: nenhuma forma deveria chegar aqui, mas texto que estoura é desenhado por cima da foto.
  return escolhida.length <= LIMITE_RESUMO ? escolhida : `${escolhida.slice(0, LIMITE_RESUMO - 1)}…`
}
