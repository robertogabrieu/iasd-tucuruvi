import type { ReactNode } from 'react'

/**
 * Faixa de filtros de uma listagem. O botão de limpar ocupa o mesmo lugar sempre e só troca de
 * visibilidade: elemento que aparece e desloca o resto faz a pessoa errar o clique.
 */
export default function FilterBar(
  { children, active = false, onClear }: { children: ReactNode; active?: boolean; onClear?: () => void },
) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <div className="flex items-end gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 flex-1">{children}</div>
        <button
          type="button"
          onClick={onClear}
          className={`text-sm text-gray-500 hover:text-iasd-accent transition-colors shrink-0 pb-2 ${active ? '' : 'invisible'}`}
        >
          Limpar
        </button>
      </div>
    </section>
  )
}
