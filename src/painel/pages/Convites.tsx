import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { convidarSchema, type ConvidarForm } from '@/schemas/usuarios'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import Pager from '@/painel/components/Pager'

interface Role { id: string; key: string; name: string }
interface Pending { id: string; email: string; role_name: string; invited_by_name: string | null; expires_at: string }

export default function Convites() {
  const { page, limit, setPage } = usePagination()
  const [roles, setRoles] = useState<Role[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
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
    if (res.ok) { setMsg({ kind: 'ok', text: 'Convite enviado.' }); reset({ email: '', roleKey: '' }); loadPending() }
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

  const field = 'w-full border rounded px-3 py-2'

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-heading font-bold text-iasd-dark">Convites</h1>
      {msg && <p className={msg.kind === 'ok' ? 'text-green-700 text-sm' : 'text-red-600 text-sm'}>{msg.text}</p>}

      <form onSubmit={handleSubmit(onInvite)} className="max-w-lg space-y-4 border rounded-lg p-4">
        <h2 className="font-heading font-bold text-iasd-dark">Convidar pessoa</h2>
        <div>
          <label className="block text-sm mb-1">E-mail</label>
          <input {...register('email')} className={field} placeholder="pessoa@exemplo.com" />
          {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm mb-1">Papel</label>
          <select {...register('roleKey')} className={field} defaultValue="">
            <option value="" disabled>Selecione…</option>
            {roles.map(r => <option key={r.id} value={r.key}>{r.name}</option>)}
          </select>
          {errors.roleKey && <p className="text-red-600 text-xs mt-1">{errors.roleKey.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition disabled:opacity-60">Enviar convite</button>
      </form>

      <div>
        <h2 className="font-heading font-bold text-iasd-dark mb-3">Pendentes</h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Papel</th>
                <th className="px-4 py-2">Convidado por</th>
                <th className="px-4 py-2">Expira</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2">{p.email}</td>
                  <td className="px-4 py-2">{p.role_name}</td>
                  <td className="px-4 py-2">{p.invited_by_name ?? '—'}</td>
                  <td className="px-4 py-2">{new Date(p.expires_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2 text-right space-x-3">
                    <button onClick={() => resend(p.email, p.role_name)} className="text-iasd-dark hover:underline">Reenviar</button>
                    <button onClick={() => revoke(p.id)} className="text-red-600 hover:underline">Revogar</button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Nenhum convite pendente.</td></tr>}
            </tbody>
          </table>
        </div>
        {info && <Pager info={info} onPage={setPage} />}
      </div>
    </div>
  )
}
