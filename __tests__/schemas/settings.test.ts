import { emailSettingsSchema } from '@/schemas/settings'

describe('emailSettingsSchema — remetente', () => {
  const validData = {
    authType: 'smtp' as const,
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    from: 'naoresponda@exemplo.com',
    to: 'contato@exemplo.com',
    authUser: 'naoresponda@exemplo.com',
    password: '',
  }

  it('accepts a bare address', () => {
    expect(emailSettingsSchema.safeParse(validData).success).toBe(true)
  })
  it('accepts a display name before the address', () => {
    const result = emailSettingsSchema.safeParse({ ...validData, from: 'IASD Tucuruvi <naoresponda@exemplo.com>' })
    expect(result.success).toBe(true)
  })
  it('rejects a display name with no address', () => {
    const result = emailSettingsSchema.safeParse({ ...validData, from: 'IASD Tucuruvi' })
    expect(result.success).toBe(false)
  })
  it('rejects a malformed address inside the angle brackets', () => {
    const result = emailSettingsSchema.safeParse({ ...validData, from: 'IASD Tucuruvi <sem-arroba>' })
    expect(result.success).toBe(false)
  })
  it('rejects a line break, which would inject headers', () => {
    const result = emailSettingsSchema.safeParse({ ...validData, from: 'IASD\nBcc: x@y.com <a@exemplo.com>' })
    expect(result.success).toBe(false)
  })
  it('still rejects a display name on the recipient', () => {
    const result = emailSettingsSchema.safeParse({ ...validData, to: 'Contato <contato@exemplo.com>' })
    expect(result.success).toBe(false)
  })
})
