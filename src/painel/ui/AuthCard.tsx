import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Layout das telas de autenticação: cartão centralizado sobre o fundo claro. */
export default function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Link to="/"><img src="/img/logo-iasd.svg" alt="IASD Tucuruvi" className="w-14 h-14 rounded mb-3" /></Link>
          <h1 className="text-xl font-heading font-bold text-iasd-dark text-center">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 text-center mt-1">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
          {children}
        </div>
        {footer && <div className="text-center text-sm mt-4">{footer}</div>}
      </div>
    </main>
  )
}
