import { rateLimit } from '../../server/lib/rate-limit'

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    const limiter = rateLimit({ maxRequests: 3, windowMs: 60_000 })
    expect(limiter.check('127.0.0.1')).toBe(true)
    expect(limiter.check('127.0.0.1')).toBe(true)
    expect(limiter.check('127.0.0.1')).toBe(true)
  })
  it('blocks requests over the limit', () => {
    const limiter = rateLimit({ maxRequests: 2, windowMs: 60_000 })
    limiter.check('127.0.0.1')
    limiter.check('127.0.0.1')
    expect(limiter.check('127.0.0.1')).toBe(false)
  })
  it('tracks IPs independently', () => {
    const limiter = rateLimit({ maxRequests: 1, windowMs: 60_000 })
    expect(limiter.check('1.1.1.1')).toBe(true)
    expect(limiter.check('2.2.2.2')).toBe(true)
    expect(limiter.check('1.1.1.1')).toBe(false)
  })
})
