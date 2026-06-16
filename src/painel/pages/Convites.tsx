import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { convidarSchema, type ConvidarForm } from '@/schemas/usuarios'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import {
  PageHeader, Button, Alert,
  Field, Input, Select,
  Table, THead, EmptyRow, th, td,
  Modal, Pager,
} from '@/painel/ui'

interface Role { id: string; key: string; name: string }
interface Pending { id: string; email: string; role_name: string; invited_by_name: string | null; expires_at: string }

const SendIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
)

export default function Convites() {
  const { page, limit, setPage } = usePagination()
  const [roles, setRoles] = useState<Role[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<ConvidarForm>({ resolver: zodResolver(convidarSchema) })

  const loadPending = useCallback(async () => {
    const res = await adminFetch(`/invitations?page=${page}&limit=${limit}`)
    if (res.ok) { const b = await res.json(); setPending(b.data); setInfo(b.pagination) }
  }, [page, limit])

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      const res = await adminFetch('/roles')
      if (res.ok) setRoles((await res.json()).roles)
      await loadPending()
    })()
  }, [loadPending])

  async function onInvite(data: ConvidarForm) {
    setMsg(null)
    const res = await adminFetch('/invitations', { method: 'POST', body: JSON.stringify(data) })
    if (res.ok) { setMsg({ kind: 'ok', text: 'Convite enviado.' }); reset({ email: '', roleKey: '' }); setShowInvite(false); loadPending() }
    else if (res.status === 409) setMsg({ kind: 'err', text: 'Já existe um usuário com este e-mail.' })
    else setMsg({ kind: 'err', text: 'Não foi possível convidar.' })
  }

  async function revoke(id: string) {
    setMsg(null)
    const res = await adminFetch(`/invitations/${id}`, { method: 'DELETE' })
    if (res.ok) loadPending()
    else setMsg({ kind: 'err', text: 'Não foi possível revogar.' })
  }

  async function resend(email: string, roleName: string) {
    const role = roles.find(r => r.name === roleName)
    if (!role) return
    setMsg(null)
    const res = await adminFetch('/invitations', { method: 'POST', body: JSON.stringify({ email, roleKey: role.key }) })
    if (res.ok) { setMsg({ kind: 'ok', text: 'Convite reenviado.' }); loadPending() }
    else setMsg({ kind: 'err', text: 'Não foi possível reenviar.' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Convites"
        actions={
          <Button onClick={() => { setMsg(null); reset({ email: '', roleKey: '' }); setShowInvite(true) }}>
            Enviar convite
          </Button>
        }
      />

      <Alert message={msg} />

      <Table>
        <THead>
          <tr>
            <th className={th}>E-mail</th>
            <th className={th}>Papel</th>
            <th className={th}>Convidado por</th>
            <th className={th}>Expira</th>
            <th className={th}></th>
          </tr>
        </THead>
        <tbody>
          {pending.map(p => (
            <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
              <td className={td}>{p.email}</td>
              <td className={`${td} text-gray-600`}>{p.role_name}</td>
              <td className={`${td} text-gray-600`}>{p.invited_by_name ?? '—'}</td>
              <td className={`${td} text-gray-500`}>{new Date(p.expires_at).toLocaleDateString('pt-BR')}</td>
              <td className={td}>
                <div className="flex items-center justify-end gap-3 text-gray-500">
                  <button
                    onClick={() => resend(p.email, p.role_name)}
                    title="Reenviar"
                    aria-label="Reenviar"
                    className="hover:text-iasd-accent transition-colors"
                  >
                    <SendIcon />
                  </button>
                  <button
                    onClick={() => revoke(p.id)}
                    title="Revogar"
                    aria-label="Revogar"
                    className="hover:text-red-600 transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {pending.length === 0 && <EmptyRow colSpan={5}>Nenhum convite pendente.</EmptyRow>}
        </tbody>
      </Table>

      {info && <Pager info={info} onPage={setPage} />}

      {showInvite && (
        <Modal title="Convidar pessoa" onClose={() => setShowInvite(false)}>
          <form onSubmit={handleSubmit(onInvite)} className="space-y-4">
            {msg?.kind === 'err' && <Alert message={msg} />}
            <Field label="E-mail" error={errors.email?.message} htmlFor="invite-email">
              <Input id="invite-email" {...register('email')} placeholder="pessoa@exemplo.com" />
            </Field>
            <Field label="Papel" error={errors.roleKey?.message} htmlFor="invite-role">
              <Select id="invite-role" {...register('roleKey')} defaultValue="">
                <option value="" disabled>Selecione…</option>
                {roles.map(r => <option key={r.id} value={r.key}>{r.name}</option>)}
              </Select>
            </Field>
            <Button type="submit" disabled={isSubmitting}>Enviar convite</Button>
          </form>
        </Modal>
      )}
    </div>
  )
}
