import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, Link } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { editarUsuarioSchema, type EditarUsuarioForm } from '@/schemas/usuarios'
import RolesModal from '@/painel/components/RolesModal'

interface Detail {
  id: string; name: string; email: string; status: 'active' | 'disabled'
  roles: string[]; last_login_at: string | null; created_at: string
  failed_login_count: number; locked_until: string | null
}

export default function UsuarioDetalhe() {
  const { id = '' } = useParams()
  const [user, setUser] = useState<Detail | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [showRoles, setShowRoles] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<EditarUsuarioForm>({ resolver: zodResolver(editarUsuarioSchema) })

  const load = useCallback(async () => {
    await ensureCsrf()
    const res = await adminFetch(`/users/${id}`)
    if (res.ok) {
      const u: Detail = (await res.json()).user
      setUser(u)
      reset({ name: u.name, email: u.email })
    } else if (res.status === 404) {
      setMsg({ kind: 'err', text: 'Usuário não encontrado.' })
    }
  }, [id, reset])

  useEffect(() => { load() }, [load])

  async function onSubmit(data: EditarUsuarioForm) {
    setMsg(null)
    const res = await adminFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
    if (res.ok) { setMsg({ kind: 'ok', text: 'Dados salvos.' }); load() }
    else if (res.status === 409) setMsg({ kind: 'err', text: 'E-mail já usado por outro usuário.' })
    else setMsg({ kind: 'err', text: 'Não foi possível salvar.' })
  }

  async function act(path: string, okText: string, body?: unknown) {
    setMsg(null)
    const res = await adminFetch(path, { method: path.endsWith('/status') ? 'PATCH' : 'POST', body: body ? JSON.stringify(body) : undefined })
    if (res.ok) { setMsg({ kind: 'ok', text: okText }); load() }
    else if (res.status === 409) setMsg({ kind: 'err', text: 'Bloqueado: o sistema ficaria sem administrador.' })
    else setMsg({ kind: 'err', text: 'Operação não permitida.' })
  }

  if (!user) {
    return (
      <div className="max-w-lg">
        {msg && <p className="text-red-600 text-sm">{msg.text}</p>}
        <Link to="/painel/usuarios" className="text-iasd-accent hover:underline">← Voltar</Link>
      </div>
    )
  }

  const field = 'w-full border rounded px-3 py-2'
  const locked = user.locked_until && new Date(user.locked_until) > new Date()

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link to="/painel/usuarios" className="text-iasd-accent hover:underline text-sm">← Voltar</Link>
        <h1 className="text-2xl font-heading font-bold text-iasd-dark mt-1">{user.name}</h1>
        <p className="text-sm text-gray-500">Criado em {new Date(user.created_at).toLocaleString('pt-BR')} ·
          Último login {user.last_login_at ? new Date(user.last_login_at).toLocaleString('pt-BR') : '—'}</p>
      </div>

      {msg && <p className={msg.kind === 'ok' ? 'text-green-700 text-sm' : 'text-red-600 text-sm'}>{msg.text}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Nome</label>
          <input {...register('name')} className={field} />
          {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm mb-1">E-mail</label>
          <input {...register('email')} className={field} />
          {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition disabled:opacity-60">Salvar</button>
      </form>

      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Papéis: <strong>{user.roles.join(', ') || '—'}</strong></span>
          <button onClick={() => setShowRoles(true)} className="text-iasd-dark hover:underline text-sm">Gerenciar papéis</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => act(`/users/${id}/status`, user.status === 'active' ? 'Conta desativada.' : 'Conta reativada.', { status: user.status === 'active' ? 'disabled' : 'active' })}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-100">
            {user.status === 'active' ? 'Desativar conta' : 'Reativar conta'}
          </button>
          <button onClick={() => act(`/users/${id}/unlock`, 'Conta desbloqueada.')} disabled={!locked}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50">Desbloquear</button>
          <button onClick={() => act(`/users/${id}/password-reset`, 'E-mail de redefinição enviado.')}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-100">Enviar redefinição de senha</button>
        </div>
      </div>

      {showRoles && (
        <RolesModal userId={user.id} userName={user.name} current={user.roles}
          onClose={() => setShowRoles(false)} onChanged={load} />
      )}
    </div>
  )
}
