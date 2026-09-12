import { faltaParaPublicar } from '../../server/modules/eventos/eventos.publish-rules'
import type { EventoDTO } from '../../server/modules/eventos/dto/evento.dto'

const base: EventoDTO = {
  id: '2f1c1a2e-0000-4000-8000-000000000001',
  title: 'Vigília de Oração dos Jovens',
  summary: 'Uma noite de oração',
  description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Venha participar.' }] }] },
  category: 'Jovens',
  startsAt: '2026-09-12T22:30:00.000Z',
  endsAt: '2026-09-13T02:00:00.000Z',
  locationName: 'Igreja Adventista do Tucuruvi',
  locationAddress: 'R. Cruz de Malta, 1201',
  coverMode: 'foto',
  coverStyle: 'classico',
  accentColor: '#0055AA',
  secondaryColor: '#003366',
  hostName: 'Pr. João',
  hostRole: 'Pastor distrital',
  hostPhotoMediaId: '2f1c1a2e-0000-4000-8000-000000000002',
  artMediaId: null,
  ctaLabel: 'Confirmar presença',
  ctaUrl: 'https://exemplo.org/inscricao',
  status: 'draft',
  slug: null,
  publicUrl: null,
  publishedAt: null,
  updatedAt: '2026-09-12T12:00:00.000Z',
  sessions: [
    { id: 's1', startsAt: '2026-09-12T22:30:00.000Z', endsAt: '2026-09-13T02:00:00.000Z', title: null, description: null },
  ],
}

const evento = (campos: Partial<EventoDTO> = {}): EventoDTO => ({ ...base, ...campos })

describe('faltaParaPublicar', () => {
  it('não acusa nada quando o evento está completo', () => {
    expect(faltaParaPublicar(base)).toEqual([])
  })

  it('acusa a foto que falta no modo foto', () => {
    const msgs = faltaParaPublicar({ ...base, hostPhotoMediaId: null })
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatch(/foto/i)
  })

  it('acusa o nome e a função do responsável que faltam no modo foto', () => {
    const msgs = faltaParaPublicar({ ...base, hostName: null, hostRole: '  ' })
    expect(msgs).toHaveLength(2)
  })

  it('acusa a arte que falta no modo arte', () => {
    const msgs = faltaParaPublicar({ ...base, coverMode: 'arte', hostPhotoMediaId: null, artMediaId: null })
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatch(/arte/i)
  })

  it('não cobra foto do responsável no modo arte', () => {
    const evento = { ...base, coverMode: 'arte' as const, hostPhotoMediaId: null, hostName: null, hostRole: null, artMediaId: base.hostPhotoMediaId }
    expect(faltaParaPublicar(evento)).toEqual([])
  })

  it('acusa término anterior ao início', () => {
    const msgs = faltaParaPublicar(evento({
      sessions: [{ id: 's1', startsAt: '2026-09-12T22:30:00.000Z', endsAt: '2026-09-12T20:00:00.000Z', title: null, description: null }],
    }))
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatch(/t[ée]rmino/i)
  })

  it('acusa descrição vazia', () => {
    expect(faltaParaPublicar({ ...base, description: { type: 'doc', content: [] } })).toHaveLength(1)
    expect(faltaParaPublicar({ ...base, description: {} as EventoDTO['description'] })).toHaveLength(1)
    expect(faltaParaPublicar({ ...base, description: { type: 'doc', content: [{ type: 'paragraph' }] } })).toHaveLength(1)
  })

  it('acusa os obrigatórios em branco', () => {
    const msgs = faltaParaPublicar({ ...base, title: '   ', locationName: '' })
    expect(msgs).toHaveLength(2)
  })

  it('acusa o botão de ação pela metade', () => {
    expect(faltaParaPublicar({ ...base, ctaUrl: null })).toHaveLength(1)
    expect(faltaParaPublicar({ ...base, ctaLabel: null })).toHaveLength(1)
    expect(faltaParaPublicar({ ...base, ctaLabel: null, ctaUrl: null })).toEqual([])
  })

  it('cobra a programação quando não há nenhum horário', () => {
    expect(faltaParaPublicar(evento({ sessions: [] })))
      .toContain('Informe pelo menos um horário para o evento.')
  })

  it('não cobra nada quando há um horário', () => {
    const comHorario = evento({
      sessions: [{ id: 's1', startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: null, description: null }],
    })
    expect(faltaParaPublicar(comHorario)).not.toContain('Informe pelo menos um horário para o evento.')
  })

  it('diz qual horário tem término antes do início', () => {
    const torto = evento({
      sessions: [
        { id: 's1', startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: null, description: null },
        { id: 's2', startsAt: '2027-03-14T12:30:00.000Z', endsAt: '2027-03-14T11:00:00.000Z', title: null, description: null },
      ],
    })
    expect(faltaParaPublicar(torto)).toContain('No 2º horário, o término precisa ser depois do início.')
  })
})
