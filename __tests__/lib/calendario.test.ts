import {
  diaNaIgreja, eventosPorDia, mesDoDia, mesmoMes, nomeDoMes, rotuloDoDia, semanasDoMes, sessoesDoDia, somarMeses,
} from '@/lib/calendario'

describe('diaNaIgreja', () => {
  it('conta o dia no fuso de São Paulo, não no UTC', () => {
    // 23h de sábado em São Paulo já é domingo em UTC.
    expect(diaNaIgreja('2026-09-27T02:00:00Z')).toBe('2026-09-26')
  })
})

describe('somarMeses', () => {
  it('vira o ano para a frente e para trás', () => {
    expect(somarMeses({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 })
    expect(somarMeses({ ano: 2026, mes: 1 }, -1)).toEqual({ ano: 2025, mes: 12 })
  })

  it('compara pelo ano e pelo mês', () => {
    expect(mesmoMes(mesDoDia('2026-09-13'), { ano: 2026, mes: 9 })).toBe(true)
    expect(mesmoMes({ ano: 2026, mes: 9 }, { ano: 2027, mes: 9 })).toBe(false)
  })
})

describe('nomeDoMes', () => {
  it('escreve o mês por extenso com inicial maiúscula', () => {
    expect(nomeDoMes({ ano: 2026, mes: 9 })).toBe('Setembro de 2026')
  })
})

describe('semanasDoMes', () => {
  it('começa no dia da semana certo e completa a última semana', () => {
    // 1º de setembro de 2026 é uma terça-feira.
    const semanas = semanasDoMes({ ano: 2026, mes: 9 })
    expect(semanas[0]).toEqual([null, null, '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'])
    expect(semanas.at(-1)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', null, null, null])
    expect(semanas.every(s => s.length === 7)).toBe(true)
  })

  it('conhece fevereiro de ano bissexto', () => {
    expect(semanasDoMes({ ano: 2028, mes: 2 }).flat().filter(Boolean)).toHaveLength(29)
  })
})

describe('eventosPorDia', () => {
  const evento = (startsAt: string, endsAt: string | null = null) => ({ startsAt, endsAt })

  it('marca só o dia de início quando não há término', () => {
    const e = evento('2026-09-26T12:30:00Z')
    expect([...eventosPorDia([e]).keys()]).toEqual(['2026-09-26'])
  })

  it('marca todos os dias de um evento que atravessa o mês', () => {
    const e = evento('2026-09-30T12:00:00Z', '2026-10-02T20:00:00Z')
    expect([...eventosPorDia([e]).keys()]).toEqual(['2026-09-30', '2026-10-01', '2026-10-02'])
  })

  it('junta dois eventos no mesmo dia', () => {
    const a = evento('2026-09-26T12:00:00Z')
    const b = evento('2026-09-26T21:00:00Z')
    expect(eventosPorDia([a, b]).get('2026-09-26')).toEqual([a, b])
  })

  it('não deixa um término digitado errado encher o calendário', () => {
    const e = evento('2026-09-26T12:00:00Z', '2027-09-26T12:00:00Z')
    expect(eventosPorDia([e]).size).toBe(62)
  })

  describe('com programação', () => {
    const sessao = (startsAt: string, endsAt: string | null = null) => ({ startsAt, endsAt })

    it('marca só os dias que têm horário, sem pintar os dias vazios entre eles', () => {
      const e = {
        ...evento('2026-09-19T12:00:00Z', '2026-09-26T20:00:00Z'),
        sessions: [sessao('2026-09-19T12:00:00Z', '2026-09-19T15:00:00Z'), sessao('2026-09-26T12:00:00Z', '2026-09-26T20:00:00Z')],
      }
      expect([...eventosPorDia([e]).keys()]).toEqual(['2026-09-19', '2026-09-26'])
    })

    // O término do evento é o da última sessão, e fica vazio quando ela não tem hora de encerrar.
    it('marca todos os dias da programação mesmo sem término no evento', () => {
      const e = {
        ...evento('2026-09-19T12:00:00Z'),
        sessions: [sessao('2026-09-19T12:00:00Z'), sessao('2026-09-20T12:00:00Z')],
      }
      expect([...eventosPorDia([e]).keys()]).toEqual(['2026-09-19', '2026-09-20'])
    })

    it('lista o evento uma vez só no dia em que ele tem vários horários', () => {
      const e = {
        ...evento('2026-09-19T12:30:00Z', '2026-09-19T23:00:00Z'),
        sessions: [sessao('2026-09-19T12:30:00Z'), sessao('2026-09-19T20:00:00Z'), sessao('2026-09-19T23:00:00Z')],
      }
      expect(eventosPorDia([e]).get('2026-09-19')).toEqual([e])
    })

    it('marca os dois dias da vigília que vira a madrugada', () => {
      // 22h de sexta às 2h de sábado, em São Paulo.
      const e = { ...evento('2026-09-26T01:00:00Z'), sessions: [sessao('2026-09-26T01:00:00Z', '2026-09-26T05:00:00Z')] }
      expect([...eventosPorDia([e]).keys()]).toEqual(['2026-09-25', '2026-09-26'])
    })
  })
})

describe('sessoesDoDia', () => {
  const manha = { startsAt: '2026-09-19T12:30:00Z', endsAt: '2026-09-19T15:00:00Z' }
  const domingo = { startsAt: '2026-09-20T12:00:00Z', endsAt: null }
  const vigilia = { startsAt: '2026-09-20T01:00:00Z', endsAt: '2026-09-20T05:00:00Z' }

  it('separa os horários do dia pedido', () => {
    expect(sessoesDoDia([manha, domingo], '2026-09-20')).toEqual([domingo])
  })

  it('conta a vigília nos dois dias que ela ocupa', () => {
    expect(sessoesDoDia([vigilia], '2026-09-19')).toEqual([vigilia])
    expect(sessoesDoDia([vigilia], '2026-09-20')).toEqual([vigilia])
  })
})

describe('rotuloDoDia', () => {
  it('escreve o dia da semana e a data por extenso', () => {
    expect(rotuloDoDia('2026-09-19')).toBe('Sábado, 19 de setembro')
  })
})
