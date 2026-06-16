import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { papelNomeSchema, type PapelNomeForm } from '@/schemas/papeis'
import RoleEditModal, { type ManagedRole } from '@/painel/components/RoleEditModal'
import {
  PageHeader, Button, Badge, Alert,
  Field, Input,
  Table, THead, EmptyRow, th, td,
  Modal,
} from '@/painel/ui'

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

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
    <div className="space-y-6">
      <PageHeader
        title="Papéis"
        actions={<Button onClick={() => setCreating(true)}>Novo papel</Button>}
      />

      <Alert message={msg} />

      <Table>
        <THead>
          <tr>
            <th className={th}>Nome</th>
            <th className={th}>Chave</th>
            <th className={th}>Permissões</th>
            <th className={th}>Usuários</th>
            <th className={th}></th>
          </tr>
        </THead>
        <tbody>
          {roles.map(r => (
            <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
              <td className={td}>
                <div className="flex items-center gap-2">
                  {r.name}
                  {r.protected && <Badge color="gray">protegido</Badge>}
                </div>
              </td>
              <td className={td}><code className="text-xs text-gray-600">{r.key}</code></td>
              <td className={`${td} text-gray-600`}>{r.permissions.length}</td>
              <td className={`${td} text-gray-600`}>{r.userCount}</td>
              <td className={td}>
                <div className="flex items-center justify-end gap-3 text-gray-500">
                  <button
                    onClick={() => setEditing(r)}
                    title={r.protected ? 'Ver' : 'Editar'}
                    aria-label={r.protected ? 'Ver' : 'Editar'}
                    className="hover:text-iasd-accent transition-colors"
                  >
                    {r.protected ? <EyeIcon /> : <PencilIcon />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {roles.length === 0 && <EmptyRow colSpan={5}>Nenhum papel.</EmptyRow>}
        </tbody>
      </Table>

      {editing && <RoleEditModal role={editing} onClose={() => setEditing(null)} onChanged={load} />}

      {creating && (
        <Modal title="Novo papel" onClose={() => setCreating(false)}>
          <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
            <Field label="Nome" error={errors.name?.message} htmlFor="papel-nome">
              <Input id="papel-nome" {...register('name')} placeholder="Ex.: Editor de Conteúdo" />
            </Field>
            <p className="text-xs text-gray-500">A chave (key) é gerada automaticamente a partir do nome.</p>
            <Button type="submit" disabled={isSubmitting}>Criar</Button>
          </form>
        </Modal>
      )}
    </div>
  )
}
