import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch, ensureCsrf } from './auth-api.js'

interface User { id: string; name: string; email: string; roles?: string[]; permissions?: string[] }
interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (key: string) => boolean
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Busca o usuário completo (inclui roles e permissions) — única fonte para o gating de UI.
  async function refreshMe() {
    const res = await apiFetch('/me')
    setUser(res.ok ? (await res.json()).user : null)
  }

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      await refreshMe()
      setLoading(false)
    })()
  }, [])

  async function login(email: string, password: string) {
    const res = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Falha no login')
    }
    // O /login só devolve dados básicos; rebuscamos /me para trazer roles+permissions
    // antes de navegar, senão o gating esconderia tudo até um reload.
    await refreshMe()
  }

  async function logout() {
    await apiFetch('/logout', { method: 'POST' })
    setUser(null)
  }

  const hasPermission = (key: string) => !!user?.permissions?.includes(key)

  return <Ctx.Provider value={{ user, loading, login, logout, hasPermission }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
