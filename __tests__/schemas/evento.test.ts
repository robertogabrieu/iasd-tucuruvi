import { createEventoSchema, updateEventoSchema, CATEGORIES } from '@/schemas/evento'
import { COR_PADRAO_DESTAQUE, COR_PADRAO_SECUNDARIA } from '@/lib/cores'

// Espelho client de server/modules/eventos/dto/evento.dto.ts. Estes casos são a rede que
// pega a duplicação saindo de sincronia: mudou a validação no servidor, um destes quebra.
describe('createEventoSchema', () => {
  it('aceita só o título e completa as cores com o padrão da igreja', () => {
    const r = createEventoSchema.parse({ title: 'Vigília de Oração' })
    expect(r.title).toBe('Vigília de Oração')
    expect(r.accentColor).toBe(COR_PADRAO_DESTAQUE)
    expect(r.secondaryColor).toBe(COR_PADRAO_SECUNDARIA)
  })

  it('recusa evento sem título', () => {
    expect(createEventoSchema.safeParse({}).success).toBe(false)
    expect(createEventoSchema.safeParse({ title: '   ' }).success).toBe(false)
  })

  it('recusa cor fora do formato #RRGGBB', () => {
    expect(createEventoSchema.safeParse({ title: 'X', accentColor: '#0055AA' }).success).toBe(true)
    expect(createEventoSchema.safeParse({ title: 'X', accentColor: 'azul' }).success).toBe(false)
    expect(createEventoSchema.safeParse({ title: 'X', accentColor: '#05A' }).success).toBe(false)
  })

  it('recusa link de ação sem http', () => {
    expect(createEventoSchema.safeParse({ title: 'X', ctaUrl: 'https://exemplo.org/inscricao' }).success).toBe(true)
    expect(createEventoSchema.safeParse({ title: 'X', ctaUrl: 'exemplo.org' }).success).toBe(false)
  })

  it('só aceita categoria da lista fechada', () => {
    expect(createEventoSchema.safeParse({ title: 'X', category: CATEGORIES[0] }).success).toBe(true)
    expect(createEventoSchema.safeParse({ title: 'X', category: 'Futebol' }).success).toBe(false)
  })

  it('só aceita os dois modos e os três estilos de capa', () => {
    expect(createEventoSchema.safeParse({ title: 'X', coverMode: 'foto', coverStyle: 'sobrio' }).success).toBe(true)
    expect(createEventoSchema.safeParse({ title: 'X', coverMode: 'video' }).success).toBe(false)
    expect(createEventoSchema.safeParse({ title: 'X', coverStyle: 'neon' }).success).toBe(false)
  })

  it('exige uuid nos ids de mídia', () => {
    expect(createEventoSchema.safeParse({ title: 'X', hostPhotoMediaId: 'abc' }).success).toBe(false)
    expect(createEventoSchema.safeParse({
      title: 'X',
      hostPhotoMediaId: '2f1c1a2e-0000-4000-8000-000000000001',
    }).success).toBe(true)
  })
})

describe('updateEventoSchema', () => {
  it('aceita alteração parcial, inclusive vazia', () => {
    expect(updateEventoSchema.parse({})).toEqual({})
    expect(updateEventoSchema.parse({ locationName: 'Salão social' })).toEqual({ locationName: 'Salão social' })
  })

  it('não completa as cores com o padrão — quem cria é que ganha o padrão', () => {
    expect(updateEventoSchema.parse({})).not.toHaveProperty('accentColor')
  })

  // Rascunho recém-criado volta do banco sem descrição; salvar sem escrever nada reenvia esse
  // objeto vazio, e ele não pode virar erro de validação.
  it('aceita a descrição vazia do rascunho e a normaliza', () => {
    expect(updateEventoSchema.parse({ description: {} }))
      .toEqual({ description: { type: 'doc', content: [] } })
  })

  it('continua recusando uma descrição que não é documento', () => {
    expect(() => updateEventoSchema.parse({ description: { type: 'paragrafo' } })).toThrow()
  })
})
