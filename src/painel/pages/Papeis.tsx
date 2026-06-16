import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { papelNomeSchema, type PapelNomeForm } from '@/schemas/papeis'
import Modal from '@/painel/components/Modal'
import RoleEditModal, { type ManagedRole } from '@/painel/components/RoleEditModal'

export default function Papeis() {
  const [roles, setRoles] = useState<ManagedRole[]>([])
  const [editing, setEditing] = useState<ManagedRole | null>(null)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<PapelNomeForm>({ resolver: zodResolver(papelNomeSchema) })

  const load = useCallback(async () => {
    await ensureCsrf()
    const res = await adminFetch('/roles/manage')
    if (res.ok) setRoles((await res.json()).roles)
  }, [])

  useEffect(() => { load() }, [load])

  async function onCreate(data: PapelNomeForm) {
    setMsg(null)
    const res = await adminFetch('/roles', { method: 'POST', body: JSON.stringify(data) })
    if (res.ok) { setCreating(false); reset({ name: '' }); load(); setMsg({ kind: 'ok', text: 'Papel criado.' }) }
    else if (res.status === 409) setMsg({ kind: 'err', text: 'Já existe um papel com esse nome.' })
    else setMsg({ kind: 'err', text: 'Não foi possível criar.' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark">Papéis</h1>
        <button onClick={() => setCreating(true)}
          className="bg-iasd-dark text-white rounded px-4 py-2 text-sm hover:bg-iasd-accent transition">Novo papel</button>
      </div>

      {msg && <p className={`mb-4 text-sm ${msg.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Chave</th>
              <th className="px-4 py-2">Permissões</th>
              <th className="px-4 py-2">Usuários</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">{r.name} {r.protected && <span className="text-xs text-gray-500">(protegido)</span>}</td>
                <td className="px-4 py-2"><code className="text-xs">{r.key}</code></td>
                <td className="px-4 py-2">{r.permissions.length}</td>
                <td className="px-4 py-2">{r.userCount}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setEditing(r)} className="text-iasd-dark hover:underline">{r.protected ? 'Ver' : 'Editar'}</button>
                </td>
              </tr>
            ))}
            {roles.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Nenhum papel.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <RoleEditModal role={editing} onClose={() => setEditing(null)} onChanged={load} />}

      {creating && (
        <Modal title="Novo papel" onClose={() => setCreating(false)}>
          <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Nome</label>
              <input {...register('name')} className="w-full border rounded px-3 py-2" placeholder="Ex.: Editor de Conteúdo" />
              {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
              <p className="text-xs text-gray-500 mt-1">A chave (key) é gerada automaticamente a partir do nome.</p>
            </div>
            <button type="submit" disabled={isSubmitting}
              className="bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition disabled:opacity-60">Criar</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
