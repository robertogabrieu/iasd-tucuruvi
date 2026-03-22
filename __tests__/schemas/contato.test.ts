import { contatoSchema } from '@/schemas/contato'

describe('contatoSchema', () => {
  const validData = {
    nome: 'Maria Silva',
    telefone: '11999998888',
    email: 'maria@email.com',
    horario: 'Manhã',
    honeypot: '',
  }

  it('accepts valid data', () => {
    const result = contatoSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })
  it('rejects empty name', () => {
    const result = contatoSchema.safeParse({ ...validData, nome: '' })
    expect(result.success).toBe(false)
  })
  it('rejects invalid email', () => {
    const result = contatoSchema.safeParse({ ...validData, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })
  it('rejects short phone', () => {
    const result = contatoSchema.safeParse({ ...validData, telefone: '123' })
    expect(result.success).toBe(false)
  })
  it('detects bot via honeypot', () => {
    const result = contatoSchema.safeParse({ ...validData, honeypot: 'bot-filled-this' })
    expect(result.success).toBe(false)
  })
})
