interface RateLimitOptions {
  maxRequests: number
  windowMs: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export function rateLimit({ maxRequests, windowMs }: RateLimitOptions) {
  const store = new Map<string, RateLimitEntry>()

  return {
    check(ip: string): boolean {
      const now = Date.now()
      const entry = store.get(ip)

      if (!entry || now > entry.resetAt) {
        store.set(ip, { count: 1, resetAt: now + windowMs })
        return true
      }

      if (entry.count < maxRequests) {
        entry.count++
        return true
      }

      return false
    },
  }
}
