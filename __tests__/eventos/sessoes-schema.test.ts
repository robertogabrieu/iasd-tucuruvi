import { sessionsSchema } from '../../server/modules/eventos/dto/evento.dto'

const umaSessao = (startsAt: string, endsAt: string | null = null) => ({
  startsAt, endsAt, title: null, description: null,
})

describe('sessionsSchema', () => {
  it('aceita uma programação de um horário', () => {
    expect(sessionsSchema.safeParse([umaSessao('2027-03-13T23:00:00.000Z')]).success).toBe(true)
  })

  it('recusa programação vazia', () => {
    const r = sessionsSchema.safeParse([])
    expect(r.success).toBe(false)
    expect(JSON.stringify(r)).toContain('pelo menos um horário')
  })

  it('recusa mais de vinte horários', () => {
    const muitos = Array.from({ length: 21 }, (_, i) =>
      umaSessao(`2027-11-${String(i + 1).padStart(2, '0')}T23:00:00.000Z`))
    expect(sessionsSchema.safeParse(muitos).success).toBe(false)
  })

  it('recusa dois horários no mesmo instante, dizendo qual', () => {
    const r = sessionsSchema.safeParse([
      umaSessao('2027-03-14T12:30:00.000Z'),
      umaSessao('2027-03-14T12:30:00.000Z'),
    ])
    expect(r.success).toBe(false)
    expect(JSON.stringify(r)).toContain('2º horário')
  })

  it('recusa término anterior ao início', () => {
    const r = sessionsSchema.safeParse([
      umaSessao('2027-03-14T12:30:00.000Z', '2027-03-14T11:00:00.000Z'),
    ])
    expect(r.success).toBe(false)
    expect(JSON.stringify(r)).toContain('término precisa ser depois do início')
  })
})
