import type { ReactNode } from 'react'

/** Etiqueta pequena (ex.: papéis de um usuário). `onRemove` mostra um × clicável. */
export default function Chip({ children, onRemove, removeLabel }: { children: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-iasd-light border border-gray-200 rounded-full px-3 py-1 text-sm text-iasd-dark">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={removeLabel} className="text-gray-500 hover:text-red-600">✕</button>
      )}
    </span>
  )
}
