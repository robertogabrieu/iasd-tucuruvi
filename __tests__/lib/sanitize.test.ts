import { sanitize } from '@/lib/sanitize'

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>Hello')).toBe('Hello')
  })
  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello')
  })
  it('handles empty string', () => {
    expect(sanitize('')).toBe('')
  })
})
