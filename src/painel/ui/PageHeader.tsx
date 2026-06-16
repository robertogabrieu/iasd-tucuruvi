import type { ReactNode } from 'react'

type Props = { title: string; subtitle?: ReactNode; actions?: ReactNode }

/** Cabeçalho padrão de página do painel: título + subtítulo opcional + ações à direita. */
export default function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
