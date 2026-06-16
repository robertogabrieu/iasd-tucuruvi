import type { ReactNode } from 'react'

/** Classes padrão das células — use em <th>/<td> dentro de <Table>. */
export const th = 'px-4 py-2.5 font-medium'
export const td = 'px-4 py-2.5'

/**
 * Tabela padrão: wrapper com borda/rounded + <table> estilizada.
 * Passe <thead>/<tbody> como filhos usando as classes `th`/`td`.
 */
export default function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  )
}

/** Cabeçalho padrão (fundo cinza, texto muted). */
export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">{children}</thead>
}

/** Linha de "nenhum resultado" para o corpo da tabela. */
export function EmptyRow({ colSpan, children = 'Nenhum resultado.' }: { colSpan: number; children?: ReactNode }) {
  return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">{children}</td></tr>
}
