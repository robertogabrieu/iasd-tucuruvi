import { getNextService, formatDiff, CULTOS, type ServiceSlot } from '../../src/components/Countdown'

// Reunião do Clube Antares: todo domingo às 9h de Brasília.
const REUNIAO_CLUBE: ServiceSlot[] = [{ day: 0, hour: 9, minute: 0, label: 'Reunião do Clube' }]

/** Instante absoluto a partir de um horário UTC legível. */
const utc = (iso: string) => Date.parse(iso)

/** Como o instante aparece no relógio de São Paulo, para conferir a conta. */
const emSaoPaulo = (ms: number) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms))

describe('getNextService — reunião do clube', () => {
  it('aponta para o próximo domingo às 9h de Brasília', () => {
    // Quinta-feira, 3 de setembro de 2026, meio-dia em São Paulo (15:00 UTC).
    const proximo = getNextService(REUNIAO_CLUBE, utc('2026-09-03T15:00:00Z'))
    expect(emSaoPaulo(proximo.at)).toBe('dom., 09:00')
    expect(proximo.label).toBe('Reunião do Clube')
  })

  it('vira para o domingo seguinte quando a reunião já passou', () => {
    // Domingo, 6 de setembro de 2026, 10h em São Paulo — uma hora depois da reunião.
    const proximo = getNextService(REUNIAO_CLUBE, utc('2026-09-06T13:00:00Z'))
    const dias = (proximo.at - utc('2026-09-06T13:00:00Z')) / 86_400_000
    expect(emSaoPaulo(proximo.at)).toBe('dom., 09:00')
    expect(dias).toBeGreaterThan(6) // o próximo, não o de hoje
  })

  it('ainda aponta para hoje quando faltam minutos', () => {
    // Domingo, 8h50 em São Paulo.
    const agora = utc('2026-09-06T11:50:00Z')
    const proximo = getNextService(REUNIAO_CLUBE, agora)
    expect(formatDiff(proximo.at - agora)).toEqual({ days: 0, hours: 0, minutes: 10, seconds: 0 })
  })

  it('não depende do fuso do aparelho: o resultado é o mesmo instante', () => {
    // Mesmo instante absoluto, descrito de duas formas. O retorno tem de ser idêntico.
    const a = getNextService(REUNIAO_CLUBE, utc('2026-09-03T15:00:00Z'))
    const b = getNextService(REUNIAO_CLUBE, new Date('2026-09-03T12:00:00-03:00').getTime())
    expect(a.at).toBe(b.at)
  })
})

describe('getNextService — cultos da igreja', () => {
  it('escolhe o culto mais próximo entre os três', () => {
    // Quarta-feira, 2 de setembro de 2026, 10h em São Paulo: o próximo é o culto de quarta, 20h.
    const proximo = getNextService(CULTOS, utc('2026-09-02T13:00:00Z'))
    expect(proximo.label).toBe('Culto de Quarta')
    expect(emSaoPaulo(proximo.at)).toBe('qua., 20:00')
  })

  it('depois do culto de quarta, o próximo é o de sábado', () => {
    // Quarta-feira, 21h em São Paulo.
    const proximo = getNextService(CULTOS, utc('2026-09-03T00:00:00Z'))
    expect(proximo.label).toBe('Culto de Sábado')
    expect(emSaoPaulo(proximo.at)).toBe('sáb., 09:30')
  })
})

describe('getNextService — reunião quinzenal do Antares Kids', () => {
  // Sábados alternados às 16h. Âncora: houve reunião em 12/09/2026.
  const REUNIAO_KIDS: ServiceSlot[] = [
    { day: 6, hour: 16, minute: 0, label: 'Reunião do Clube', biweeklyFrom: '2026-09-12' },
  ]

  const emSaoPauloComData = (ms: number) =>
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ms))

  it('pula o sábado de folga', () => {
    // Sexta, 4 de setembro. O sábado seguinte (dia 5) é de folga: a reunião é dia 12.
    const proximo = getNextService(REUNIAO_KIDS, utc('2026-09-04T15:00:00Z'))
    expect(emSaoPauloComData(proximo.at)).toBe('12/09, 16:00')
  })

  it('aponta para o próprio sábado quando é dia de reunião', () => {
    // Sábado, 12 de setembro, 10h da manhã em São Paulo.
    const proximo = getNextService(REUNIAO_KIDS, utc('2026-09-12T13:00:00Z'))
    expect(emSaoPauloComData(proximo.at)).toBe('12/09, 16:00')
  })

  it('depois da reunião, salta duas semanas e não uma', () => {
    // Sábado, 12 de setembro, 18h: a reunião das 16h já passou.
    const proximo = getNextService(REUNIAO_KIDS, utc('2026-09-12T21:00:00Z'))
    expect(emSaoPauloComData(proximo.at)).toBe('26/09, 16:00')
  })

  it('mantém a cadência meses depois da âncora', () => {
    // Quarta, 4 de novembro. Contando de 14 em 14 desde 12/09: 26/09, 10/10, 24/10, 07/11.
    const proximo = getNextService(REUNIAO_KIDS, utc('2026-11-04T15:00:00Z'))
    expect(emSaoPauloComData(proximo.at)).toBe('07/11, 16:00')
  })

  it('funciona para datas anteriores à âncora', () => {
    // Sexta, 21 de agosto. Voltando de 14 em 14 desde 12/09: 29/08, 15/08.
    const proximo = getNextService(REUNIAO_KIDS, utc('2026-08-21T15:00:00Z'))
    expect(emSaoPauloComData(proximo.at)).toBe('29/08, 16:00')
  })
})

describe('formatDiff', () => {
  it('quebra o intervalo em dias, horas, minutos e segundos', () => {
    const ms = ((2 * 24 + 3) * 60 * 60 + 4 * 60 + 5) * 1000
    expect(formatDiff(ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 })
  })

  it('não devolve valor negativo', () => {
    expect(formatDiff(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})
