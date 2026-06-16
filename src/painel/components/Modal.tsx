import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Portal para o body: o <main> do painel é scroll container (overflow), o que ancoraria
  // um `fixed` no seu content-box e deixaria uma faixa no topo. No body, cobre o viewport todo.
  return createPortal(
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold text-iasd-dark">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-gray-800">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
