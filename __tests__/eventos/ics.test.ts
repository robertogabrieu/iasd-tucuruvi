import { montarIcs } from '../../src/components/evento/evento-ics'
import type { EventoDTO } from '../../src/schemas/evento'

function evento(patch: Partial<EventoDTO> = {}): EventoDTO {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    title: 'Vigília de Oração dos Jovens',
    summary: 'Uma noite de louvor.',
    description: { type: 'doc', content: [] },
    category: 'Jovens',
    startsAt: '2026-09-26T22:30:00.000Z',
    endsAt: '2026-09-27T01:00:00.000Z',
    locationName: 'Salão principal',
    locationAddress: 'R. Cruz de Malta, 1201',
    coverMode: 'foto',
    coverStyle: 'classico',
    accentColor: '#0055AA',
    secondaryColor: '#003366',
    hostName: null,
    hostRole: null,
    hostPhotoMediaId: null,
    artMediaId: null,
    ctaLabel: null,
    ctaUrl: null,
    status: 'published',
    slug: 'vigilia-de-oracao-dos-jovens',
    publicUrl: 'https://iasdtucuruvi.org.br/eventos/vigilia-de-oracao-dos-jovens',
    publishedAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-10T15:00:00.000Z',
    sessions: [
      { id: 'sessao-1', startsAt: '2026-09-26T22:30:00.000Z', endsAt: '2026-09-27T01:00:00.000Z', title: null, description: null },
    ],
    ...patch,
  }
}

/** As linhas do arquivo, já desdobradas (o RFC 5545 quebra linha longa com CRLF + espaço). */
function linhas(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, '').split('\r\n')
}

describe('montarIcs', () => {
  it('devolve um calendário completo, com uma linha por propriedade', () => {
    const linhasDoArquivo = linhas(montarIcs(evento()))
    expect(linhasDoArquivo[0]).toBe('BEGIN:VCALENDAR')
    expect(linhasDoArquivo).toContain('VERSION:2.0')
    expect(linhasDoArquivo).toContain('BEGIN:VEVENT')
    expect(linhasDoArquivo).toContain('END:VEVENT')
    expect(linhasDoArquivo[linhasDoArquivo.length - 1]).toBe('END:VCALENDAR')
  })

  it('grava o início e o término no instante em UTC, não no relógio de quem baixa', () => {
    const linhasDoArquivo = linhas(montarIcs(evento()))
    expect(linhasDoArquivo).toContain('DTSTART:20260926T223000Z')
    expect(linhasDoArquivo).toContain('DTEND:20260927T010000Z')
  })

  it('omite o término quando o evento não tem hora de encerrar', () => {
    const texto = montarIcs(evento({
      endsAt: null,
      sessions: [{ id: 'sessao-1', startsAt: '2026-09-26T22:30:00.000Z', endsAt: null, title: null, description: null }],
    }))
    expect(texto).toContain('DTSTART:20260926T223000Z')
    expect(texto).not.toContain('DTEND')
  })

  it('escapa vírgula, ponto e vírgula, barra invertida e quebra de linha do título', () => {
    const texto = montarIcs(evento({ title: 'Louvor, oração; comunhão \\ fé\nna igreja' }))
    expect(linhas(texto)).toContain('SUMMARY:Louvor\\, oração\\; comunhão \\\\ fé\\nna igreja')
  })

  it('leva o local e o link da página do evento', () => {
    const linhasDoArquivo = linhas(montarIcs(evento()))
    expect(linhasDoArquivo).toContain('LOCATION:Salão principal\\, R. Cruz de Malta\\, 1201')
    expect(linhasDoArquivo).toContain('URL:https://iasdtucuruvi.org.br/eventos/vigilia-de-oracao-dos-jovens')
    expect(linhasDoArquivo).toContain('UID:11111111-2222-3333-4444-555555555555@iasdtucuruvi.org.br')
  })

  it('quebra linha longa do jeito que o RFC pede, sem perder o conteúdo', () => {
    const titulo = 'Semana de oração e comunhão da igreja inteira com um nome bem comprido de propósito'
    const texto = montarIcs(evento({ title: titulo }))
    expect(texto.split('\r\n').every(l => Buffer.byteLength(l, 'utf8') <= 75)).toBe(true)
    expect(linhas(texto)).toContain(`SUMMARY:${titulo}`)
  })

  it('gera um compromisso por horário', () => {
    const ics = montarIcs(evento({
      sessions: [
        { id: 'a', startsAt: '2027-03-13T23:00:00.000Z', endsAt: '2027-03-14T00:30:00.000Z', title: 'Abertura', description: null },
        { id: 'b', startsAt: '2027-03-14T12:30:00.000Z', endsAt: null, title: null, description: null },
      ],
    }))
    expect(linhas(ics).filter(l => l === 'BEGIN:VEVENT')).toHaveLength(2)
  })

  it('o identificador não depende da linha do banco, para não duplicar na agenda', () => {
    const comIds = (a: string, b: string) => evento({
      sessions: [
        { id: a, startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: null, description: null },
        { id: b, startsAt: '2027-03-14T12:30:00.000Z', endsAt: null, title: null, description: null },
      ],
    })
    const uids = (ics: string) => linhas(ics).filter(l => l.startsWith('UID:'))
    // A programação é apagada e regravada a cada salvamento: os ids mudam, o convite não pode mudar.
    expect(uids(montarIcs(comIds('a', 'b')))).toEqual(uids(montarIcs(comIds('x', 'y'))))
  })

  it('o primeiro horário mantém o identificador que o evento já tinha', () => {
    const ics = montarIcs(evento({
      sessions: [{ id: 'a', startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: null, description: null }],
    }))
    expect(linhas(ics)).toContain('UID:11111111-2222-3333-4444-555555555555@iasdtucuruvi.org.br')
  })

  it('o nome do horário entra no título do compromisso', () => {
    const ics = montarIcs(evento({
      sessions: [{ id: 'a', startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: 'Abertura', description: null }],
    }))
    expect(linhas(ics)).toContain('SUMMARY:Vigília de Oração dos Jovens — Abertura')
  })

  it('o contador de versão sobe quando o evento é salvo de novo', () => {
    const sequencia = (ics: string) => Number(linhas(ics).find(l => l.startsWith('SEQUENCE:'))!.slice('SEQUENCE:'.length))
    const antes = sequencia(montarIcs(evento({ updatedAt: '2026-09-10T15:00:00.000Z' })))
    const depois = sequencia(montarIcs(evento({ updatedAt: '2026-09-11T09:30:00.000Z' })))
    expect(depois).toBeGreaterThan(antes)
  })
})
