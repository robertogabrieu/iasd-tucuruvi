import type { ReactNode } from 'react'

type Color = 'gray' | 'green' | 'red' | 'amber' | 'blue'

const colors: Record<Color, string> = {
  gray: 'bg-gray-200 text-gray-600',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-iasd-light text-iasd-dark',
}

export function Badge({ color = 'gray', children }: { color?: Color; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 ${colors[color]}`}>{children}</span>
}

/** Badge de status de conta de usuário. */
export function StatusBadge({ status }: { status: 'active' | 'disabled' }) {
  const active = status === 'active'
  return (
    <Badge color={active ? 'green' : 'gray'}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
      {active ? 'Ativo' : 'Desativado'}
    </Badge>
  )
}
