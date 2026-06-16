import type { ReactNode } from 'react'

/** Estado vazio centralizado: ícone opcional + título + descrição + ação opcional. */
export default function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      {icon && <div className="mx-auto mb-3 w-12 h-12 text-gray-300 flex items-center justify-center">{icon}</div>}
      <h2 className="text-lg font-heading font-bold text-iasd-dark">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
