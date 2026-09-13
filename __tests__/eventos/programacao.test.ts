import {
  LIMITE_RESUMO, agruparPorDia, faixaDeHorario, primeiraSessao,
  proximaSessaoPendente, resumoDaProgramacao, ultimaSessao, type Sessao,
} from '../../src/lib/programacao'

let n = 0
function sessao(startsAt: string, endsAt: string | null = null, title: string | null = null): Sessao {
  return { id: `s${++n}`, startsAt, endsAt, title, description: null }
}

// Horários em UTC; 19h30 em São Paulo é 22h30 UTC.
const SEX_20H = '2027-03-13T23:00:00.000Z'
const SEX_2130 = '2027-03-14T00:30:00.000Z'
const SAB_930 = '2027-03-14T12:30:00.000Z'
const SAB_1630 = '2027-03-14T19:30:00.000Z'

describe('primeira, última e próxima', () => {
  it('devolve a primeira e a última em ordem cronológica, mesmo fora de ordem na entrada', () => {
    const lista = [sessao(SAB_1630), sessao(SEX_20H), sessao(SAB_930)]
    expect(primeiraSessao(lista)!.startsAt).toBe(SEX_20H)
    expect(ultimaSessao(lista)!.startsAt).toBe(SAB_1630)
  })

  it('devolve nulo para programação vazia', () => {
    expect(primeiraSessao([])).toBeNull()
    expect(ultimaSessao([])).toBeNull()
  })

  it('a próxima pendente ignora o que já terminou e mantém o que está acontecendo', () => {
    const lista = [sessao(SEX_20H, SEX_2130), sessao(SAB_930), sessao(SAB_1630)]
    // Sábado de manhã, 10h de São Paulo: a de 9h30 não tem término, então já passou.
    expect(proximaSessaoPendente(lista, new Date('2027-03-14T13:00:00.000Z'))!.startsAt).toBe(SAB_1630)
    // Sexta 21h: a de 20h ainda está acontecendo, porque termina 21h30.
    expect(proximaSessaoPendente(lista, new Date('2027-03-14T00:00:00.000Z'))!.startsAt).toBe(SEX_20H)
    // Depois de tudo.
    expect(proximaSessaoPendente(lista, new Date('2027-03-15T00:00:00.000Z'))).toBeNull()
  })
})

describe('resumoDaProgramacao', () => {
  it('um horário mantém o dia da semana e a hora', () => {
    expect(resumoDaProgramacao([sessao('2026-09-26T22:30:00.000Z')]))
      .toBe('Sábado, 26 de setembro · 19h30')
  })

  it('até três no mesmo dia mostram as horas', () => {
    const lista = [
      sessao('2026-09-26T12:30:00.000Z'), // 9h30
      sessao('2026-09-26T17:00:00.000Z'), // 14h
      sessao('2026-09-26T22:30:00.000Z'), // 19h30
    ]
    expect(resumoDaProgramacao(lista)).toBe('26 de setembro · 9h30, 14h e 19h30')
  })

  it('quatro ou mais no mesmo dia trocam as horas pela contagem', () => {
    const lista = ['09:00', '12:00', '15:00', '18:00'].map(h => sessao(`2026-09-26T${h}:00.000Z`))
    expect(resumoDaProgramacao(lista)).toBe('26 de setembro · 4 horários')
  })

  it('dois dias do mesmo mês usam "e"', () => {
    expect(resumoDaProgramacao([sessao(SEX_20H), sessao(SAB_930), sessao(SAB_1630)]))
      .toBe('13 e 14 de março · 3 horários')
  })

  it('três ou mais dias do mesmo mês usam "a"', () => {
    const lista = [
      sessao('2027-03-13T23:00:00.000Z'),
      sessao('2027-03-14T23:00:00.000Z'),
      sessao('2027-03-15T23:00:00.000Z'),
    ]
    expect(resumoDaProgramacao(lista)).toBe('13 a 15 de março · 3 horários')
  })

  it('meses diferentes abreviam o mês', () => {
    const lista = [
      sessao('2027-02-27T23:00:00.000Z'),
      sessao('2027-03-01T23:00:00.000Z'),
      sessao('2027-03-02T23:00:00.000Z'),
    ]
    expect(resumoDaProgramacao(lista)).toBe('27 de fev a 2 de mar · 3 horários')
  })

  it('nenhuma forma passa do limite que cabe na arte', () => {
    const casos: Sessao[][] = [
      [sessao('2026-09-26T22:30:00.000Z')],
      [sessao('2026-09-26T12:30:00.000Z'), sessao('2026-09-26T17:00:00.000Z'), sessao('2026-09-26T22:30:00.000Z')],
      [sessao(SEX_20H), sessao(SAB_930), sessao(SAB_1630)],
      [sessao('2027-02-27T23:00:00.000Z'), sessao('2027-03-02T23:00:00.000Z')],
      Array.from({ length: 20 }, (_, i) => sessao(`2027-11-${String(i + 1).padStart(2, '0')}T23:00:00.000Z`)),
    ]
    for (const caso of casos) {
      expect(resumoDaProgramacao(caso).length).toBeLessThanOrEqual(LIMITE_RESUMO)
    }
  })

  it('programação vazia devolve texto vazio', () => {
    expect(resumoDaProgramacao([])).toBe('')
  })
})

describe('fuso da igreja', () => {
  it('sessão das 21h de sexta não vira sábado', () => {
    // 21h em São Paulo = 00h UTC do dia seguinte.
    const noturna = [sessao('2027-03-14T00:00:00.000Z')]
    expect(resumoDaProgramacao(noturna)).toBe('Sábado, 13 de março · 21h')
    expect(agruparPorDia(noturna)[0].rotulo).toBe('Sábado, 13 de março')
  })
})

describe('agruparPorDia', () => {
  it('junta os horários do mesmo dia, em ordem, e mantém os dias em ordem', () => {
    const grupos = agruparPorDia([sessao(SAB_1630), sessao(SEX_20H), sessao(SAB_930)])
    expect(grupos.map(g => g.rotulo)).toEqual(['Sábado, 13 de março', 'Domingo, 14 de março'])
    expect(grupos[1].sessoes.map(s => s.startsAt)).toEqual([SAB_930, SAB_1630])
  })
})

describe('faixaDeHorario', () => {
  it('mostra só o início quando não há término', () => {
    expect(faixaDeHorario(SAB_930, null)).toBe('9h30')
  })

  it('mostra início e fim quando há término no mesmo dia', () => {
    expect(faixaDeHorario(SEX_20H, SEX_2130)).toBe('20h às 21h30')
  })
})
