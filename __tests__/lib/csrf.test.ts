import { generateCsrfToken, validateCsrfToken } from '@/lib/csrf'

describe('csrf', () => {
  const secret = 'test-secret-key-32-chars-long!!!'

  it('generates a non-empty token', () => {
    const token = generateCsrfToken(secret)
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
  })
  it('validates a correct token', () => {
    const token = generateCsrfToken(secret)
    expect(validateCsrfToken(token, secret)).toBe(true)
  })
  it('rejects a tampered token', () => {
    expect(validateCsrfToken('invalid-token', secret)).toBe(false)
  })
})
