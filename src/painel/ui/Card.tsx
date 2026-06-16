import type { ReactNode } from 'react'

type Props = {
  title?: string
  actions?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/** Superfície branca padrão (borda + rounded-xl + shadow-sm). Cabeçalho opcional. */
export default function Card({ title, actions, className = '', bodyClassName = '', children }: Props) {
  return (
    <section className={`bg-white border border-gray-200 rounded-xl shadow-sm p-6 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && <h2 className="font-heading font-bold text-iasd-dark">{title}</h2>}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
