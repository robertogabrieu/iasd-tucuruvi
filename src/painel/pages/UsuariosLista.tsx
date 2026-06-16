import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import Pager from '@/painel/components/Pager'
import RolesModal from '@/painel/components/RolesModal'

interface Row { id: string; name: string; email: string; status: 'active' | 'disabled'; roles: string[]; last_login_at: string | null }

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const KeyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="8" cy="15" r="4" />
    <path d="M10.85 12.15 19 4M18 5l2 2M15 8l2 2" />
  </svg>
)

export default function UsuariosLista() {
  const { page, limit, setPage } = usePagination()
  const [rows, setRows] = useState<Row[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [editing, setEditing] = useState<Row | null>(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    await ensureCsrf()
    const res = await adminFetch(`/users?page=${page}&limit=${limit}`)
    if (res.ok) {
      const body = await res.json()
      setRows(body.data)
      setInfo(body.pagination)
    }
  }, [page, limit])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark">Usuários</h1>
        <Link to="/painel/usuarios/convites"
          className="bg-iasd-dark text-white rounded px-4 py-2 text-sm hover:bg-iasd-accent transition">Convidar</Link>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Papéis</th>
              <th className="px-4 py-2">Último login</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2">
                  <button onClick={() => navigate(`/painel/usuarios/${u.id}`)} className="text-iasd-accent hover:underline">{u.name}</button>
                </td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs rounded-full px-2 py-0.5 ${u.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                    {u.status === 'active' ? 'ativo' : 'desativado'}
                  </span>
                </td>
                <td className="px-4 py-2">{u.roles.join(', ') || '—'}</td>
                <td className="px-4 py-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('pt-BR') : '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-3 text-gray-500">
                    <Link to={`/painel/usuarios/${u.id}`} title="Ver detalhes" aria-label="Ver detalhes"
                      className="hover:text-iasd-accent transition-colors">
                      <EyeIcon />
                    </Link>
                    <button onClick={() => setEditing(u)} title="Gerenciar papéis" aria-label="Gerenciar papéis"
                      className="hover:text-iasd-dark transition-colors">
                      <KeyIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Nenhum usuário.</td></tr>}
          </tbody>
        </table>
      </div>

      {info && <Pager info={info} onPage={setPage} />}

      {editing && (
        <RolesModal userId={editing.id} userName={editing.name} current={editing.roles}
          onClose={() => setEditing(null)} onChanged={load} />
      )}
    </div>
  )
}
