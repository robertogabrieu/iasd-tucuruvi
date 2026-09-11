import { slugify } from '../../server/core/slug'

describe('slugify', () => {
  it('remove acento e troca símbolo por hífen', () => {
    expect(slugify('Vigília de Oração dos Jovens!')).toBe('vigilia-de-oracao-dos-jovens')
  })

  it('corta o slug em 80 caracteres', () => {
    expect(slugify('a'.repeat(200))).toHaveLength(80)
  })

  it('devolve um valor utilizável quando não sobra nada', () => {
    expect(slugify('!!!')).toBe('item')
    expect(slugify('')).toBe('item')
  })
})
