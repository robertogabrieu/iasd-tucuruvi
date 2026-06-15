import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch, ensureCsrf } from './auth-api.js'

interface User { id: string; name: string; email: string; roles?: string[] }
interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      const res = await apiFetch('/me')
      if (res.ok) setUser((await res.json()).user)
      setLoading(false)
    })()
  }, [])

  async function login(email: string, password: string) {
    const res = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Falha no login')
    }
    setUser((await res.json()).user)
  }

  async function logout() {
    await apiFetch('/logout', { method: 'POST' })
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
