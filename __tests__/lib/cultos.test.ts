import { cultosDoDia } from '@/lib/cultos'

function eventoComSessao(startsAt: string) {
  return { sessions: [{ startsAt, endsAt: null }] }
}

describe('cultosDoDia', () => {
  it('marca no sábado o Culto Divino e a Escola Sabatina, em ordem de horário', () => {
    // 19 de setembro de 2026 é um sábado.
    expect(cultosDoDia('2026-09-19', [])).toEqual([
      { nome: 'Culto Divino', hora: '9h30' },
      { nome: 'Escola Sabatina', hora: '11h10' },
    ])
  })

  it('não marca nada no dia da semana sem culto', () => {
    // 17 de setembro de 2026 é uma quinta.
    expect(cultosDoDia('2026-09-17', [])).toEqual([])
  })

  it('cede o horário ao evento que começa na mesma hora do culto', () => {
    // 9h30 em São Paulo é 12h30 em UTC.
    const especial = eventoComSessao('2026-09-19T12:30:00Z')

    expect(cultosDoDia('2026-09-19', [especial])).toEqual([{ nome: 'Escola Sabatina', hora: '11h10' }])
  })

  it('mantém o culto quando o evento do dia começa em outro horário', () => {
    const tarde = eventoComSessao('2026-09-19T18:00:00Z')

    expect(cultosDoDia('2026-09-19', [tarde])).toHaveLength(2)
  })

  it('compara o horário no fuso da igreja, não no UTC', () => {
    // Domingo 20/09 às 19h em São Paulo é segunda 22h em UTC.
    const noDomingo = eventoComSessao('2026-09-20T22:00:00Z')

    expect(cultosDoDia('2026-09-20', [noDomingo])).toEqual([])
  })
})
