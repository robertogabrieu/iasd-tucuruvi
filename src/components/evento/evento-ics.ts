import type { EventoDTO } from '@/schemas/evento'

/** O RFC 5545 limita a linha a 75 octetos; o que passa disso continua na linha seguinte. */
const LIMITE_DE_OCTETOS = 75

const DOMINIO = 'iasdtucuruvi.org.br'

/** "2026-09-26T22:30:00.000Z" vira "20260926T223000Z" — o instante, não o relógio de quem baixa. */
function instanteUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Vírgula, ponto e vírgula, barra invertida e quebra de linha têm sentido próprio no formato. */
function escapar(valor: string): string {
  return valor
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Quebra a linha longa como o formato pede: a continuação começa com um espaço, que também
 * conta no limite. A conta é em octetos, e não em caracteres, porque "ã" ocupa dois — e o
 * corte é feito entre caracteres, para não partir um acento ao meio.
 */
function dobrar(linha: string): string {
  const codificador = new TextEncoder()
  const partes: string[] = []
  let atual = ''
  let octetos = 0

  for (const caractere of linha) {
    const tamanho = codificador.encode(caractere).length
    if (octetos + tamanho > LIMITE_DE_OCTETOS) {
      partes.push(atual)
      atual = ''
      octetos = 1
    }
    atual += caractere
    octetos += tamanho
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

/**
 * O convite de calendário do evento, montado no navegador a partir do que a página já
 * carregou (spec §8.3): é texto simples e não há rota no servidor para isso. Leva um
 * compromisso por horário, para cada um ganhar o lembrete próprio na agenda de quem baixa.
 *
 * O término sai do compromisso quando o horário não tem hora de encerrar — inventar uma
 * duração poria no calendário de quem baixa um horário que ninguém publicou.
 */
export function montarIcs(evento: EventoDTO): string {
  const local = [evento.locationName, evento.locationAddress].filter(Boolean).join(', ')
  const agora = instanteUtc(new Date().toISOString())
  // O contador é o que faz o calendário aceitar a alteração de um compromisso que já tem,
  // por isso acompanha o último salvamento, e não a publicação.
  const sequencia = Math.floor(new Date(evento.updatedAt).getTime() / 1000)
  const sessoes = [...evento.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const compromissos = sessoes.flatMap((sessao, posicao) => [
    'BEGIN:VEVENT',
    // Calculado, nunca o id da sessão: a programação é regravada a cada salvamento, e um
    // identificador novo faria a agenda de quem já baixou ganhar um compromisso repetido.
    `UID:${evento.id}${posicao === 0 ? '' : `-${posicao + 1}`}@${DOMINIO}`,
    `SEQUENCE:${sequencia}`,
    `DTSTAMP:${agora}`,
    `DTSTART:${instanteUtc(sessao.startsAt)}`,
    ...(sessao.endsAt ? [`DTEND:${instanteUtc(sessao.endsAt)}`] : []),
    `SUMMARY:${escapar(sessao.title ? `${evento.title} — ${sessao.title}` : evento.title)}`,
    ...(evento.summary ? [`DESCRIPTION:${escapar(evento.summary)}`] : []),
    ...(local ? [`LOCATION:${escapar(local)}`] : []),
    ...(evento.publicUrl ? [`URL:${evento.publicUrl}`] : []),
    'END:VEVENT',
  ])

  const propriedades: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//IASD Tucuruvi//Eventos//PT-BR`,
    'CALSCALE:GREGORIAN',
    ...compromissos,
    'END:VCALENDAR',
  ]

  return propriedades.map(dobrar).join('\r\n')
}
