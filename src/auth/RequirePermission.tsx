import type { ReactNode } from 'react'
import { useAuth } from './AuthContext.js'

/** Esconde a tela quando falta a permissão. A barreira real é o backend (requirePermission/403). */
export function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { hasPermission } = useAuth()
  if (!hasPermission(perm)) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark mb-2">Sem acesso</h1>
        <p className="text-gray-700">Você não tem permissão para acessar esta área.</p>
      </div>
    )
  }
  return <>{children}</>
}
