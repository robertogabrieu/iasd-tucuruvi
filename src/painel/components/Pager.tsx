import type { PageInfo } from '../usePagination'

export default function Pager({ info, onPage }: { info: PageInfo; onPage: (p: number) => void }) {
  if (info.totalPages <= 1) return null
  const btn = 'px-3 py-1 rounded border text-sm disabled:opacity-50'
  return (
    <div className="flex items-center gap-3 mt-4">
      <button className={btn} disabled={info.page <= 1} onClick={() => onPage(info.page - 1)}>Anterior</button>
      <span className="text-sm text-gray-600">página {info.page} de {info.totalPages}</span>
      <button className={btn} disabled={info.page >= info.totalPages} onClick={() => onPage(info.page + 1)}>Próxima</button>
    </div>
  )
}
