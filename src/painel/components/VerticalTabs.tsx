import { useState, type ReactNode } from 'react'

export interface Tab { key: string; label: string; content: ReactNode }

/** Abas verticais extensíveis (US-14 CA-01). Novas abas entram só adicionando itens. */
export default function VerticalTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key)
  return (
    <div className="flex gap-6">
      <nav className="w-48 shrink-0 space-y-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActive(t.key)}
            className={`block w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
              active === t.key ? 'bg-iasd-dark text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="flex-1">{tabs.find(t => t.key === active)?.content}</div>
    </div>
  )
}
