import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import RolesModal from '@/painel/components/RolesModal'
import {
  PageHeader, Button, StatusBadge, Chip,
  Table, THead, EmptyRow, th, td,
  Pager,
} from '@/painel/ui'

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
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        actions={<Button to="/painel/usuarios/convites">Convidar</Button>}
      />

      <Table>
        <THead>
          <tr>
            <th className={th}>Nome</th>
            <th className={th}>E-mail</th>
            <th className={th}>Status</th>
            <th className={th}>Papéis</th>
            <th className={th}>Último login</th>
            <th className={th}></th>
          </tr>
        </THead>
        <tbody>
          {rows.map(u => (
            <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
              <td className={td}>
                <Link to={`/painel/usuarios/${u.id}`} className="text-iasd-accent hover:underline font-medium">
                  {u.name}
                </Link>
              </td>
              <td className={`${td} text-gray-600`}>{u.email}</td>
              <td className={td}>
                <StatusBadge status={u.status} />
              </td>
              <td className={td}>
                {u.roles.length > 0
                  ? <div className="flex flex-wrap gap-1">{u.roles.map(r => <Chip key={r}>{r}</Chip>)}</div>
                  : <span className="text-gray-400">—</span>}
              </td>
              <td className={`${td} text-gray-500`}>
                {u.last_login_at ? new Date(u.last_login_at).toLocaleString('pt-BR') : '—'}
              </td>
              <td className={td}>
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
          {rows.length === 0 && <EmptyRow colSpan={6}>Nenhum usuário.</EmptyRow>}
        </tbody>
      </Table>

      {info && <Pager info={info} onPage={setPage} />}

      {editing && (
        <RolesModal userId={editing.id} userName={editing.name} current={editing.roles}
          onClose={() => setEditing(null)} onChanged={load} />
      )}
    </div>
  )
}
