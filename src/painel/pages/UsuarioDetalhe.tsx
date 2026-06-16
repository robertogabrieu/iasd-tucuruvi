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

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const PowerIcon = () => icon(<><path d="M12 3v9" /><path d="M6.4 6.4a8 8 0 1011.2 0" /></>)
const CheckIcon = () => icon(<path d="M20 6 9 17l-5-5" />)
const UnlockIcon = () => icon(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 017-2.6" /></>)
const MailIcon = () => icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>)

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : '—')

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
      <div className="max-w-4xl space-y-4">
        <Link to="/painel/usuarios" className="text-iasd-accent hover:underline text-sm">← Voltar</Link>
        {msg && <p className="text-red-600 text-sm">{msg.text}</p>}
      </div>
    )
  }

  const field = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-iasd-accent/40 focus:border-iasd-accent'
  const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
  const active = user.status === 'active'
  const locked = !!user.locked_until && new Date(user.locked_until) > new Date()

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/painel/usuarios" className="inline-flex items-center gap-1 text-iasd-accent hover:underline text-sm">← Voltar para Usuários</Link>

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.kind === 'ok'
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>
      )}

      {/* Cabeçalho */}
      <div className={`${card} p-6 flex flex-col sm:flex-row sm:items-center gap-5`}>
        <div className="w-16 h-16 rounded-full bg-iasd-dark text-white flex items-center justify-center text-xl font-heading font-bold shrink-0">
          {initials(user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-iasd-dark truncate">{user.name}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 ${active
              ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
              {active ? 'Ativo' : 'Desativado'}
            </span>
            {locked && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 bg-amber-100 text-amber-800">
                Bloqueado
              </span>
            )}
          </div>
          <p className="text-gray-500 truncate">{user.email}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {user.roles.length > 0
              ? user.roles.map(r => (
                <span key={r} className="text-xs bg-iasd-light border border-gray-200 rounded-full px-2.5 py-0.5 text-iasd-dark">{r}</span>
              ))
              : <span className="text-xs text-gray-400">Sem papéis</span>}
          </div>
        </div>
        <dl className="text-xs text-gray-500 sm:text-right space-y-1 shrink-0">
          <div><dt className="inline text-gray-400">Criado em </dt><dd className="inline">{fmt(user.created_at)}</dd></div>
          <div><dt className="inline text-gray-400">Último login </dt><dd className="inline">{fmt(user.last_login_at)}</dd></div>
        </dl>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Dados */}
        <section className={`${card} p-6`}>
          <h2 className="font-heading font-bold text-iasd-dark mb-4">Dados do usuário</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nome</label>
              <input {...register('name')} className={field} />
              {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">E-mail</label>
              <input {...register('email')} className={field} />
              {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting}
              className="bg-iasd-dark text-white rounded-lg px-4 py-2 hover:bg-iasd-accent transition disabled:opacity-60">Salvar alterações</button>
          </form>
        </section>

        {/* Papéis + Conta */}
        <div className="space-y-6">
          <section className={`${card} p-6`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-bold text-iasd-dark">Papéis</h2>
              <button onClick={() => setShowRoles(true)}
                className="text-sm border border-iasd-dark text-iasd-dark rounded-lg px-3 py-1.5 hover:bg-gray-100 transition">Gerenciar</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {user.roles.length > 0
                ? user.roles.map(r => (
                  <span key={r} className="text-sm bg-iasd-light border border-gray-200 rounded-full px-3 py-1 text-iasd-dark">{r}</span>
                ))
                : <span className="text-sm text-gray-400">Nenhum papel atribuído.</span>}
            </div>
          </section>

          <section className={`${card} p-6`}>
            <h2 className="font-heading font-bold text-iasd-dark mb-4">Conta</h2>
            <div className="space-y-2.5">
              <button onClick={() => act(`/users/${id}/status`, active ? 'Conta desativada.' : 'Conta reativada.', { status: active ? 'disabled' : 'active' })}
                className={`w-full inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm border transition ${active
                  ? 'border-red-200 text-red-700 hover:bg-red-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                {active ? <PowerIcon /> : <CheckIcon />}
                {active ? 'Desativar conta' : 'Reativar conta'}
              </button>
              <button onClick={() => act(`/users/${id}/unlock`, 'Conta desbloqueada.')} disabled={!locked}
                className="w-full inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm border border-gray-200 text-iasd-dark hover:bg-gray-100 transition disabled:opacity-50 disabled:hover:bg-transparent">
                <UnlockIcon /> {locked ? 'Desbloquear conta' : 'Conta não está bloqueada'}
              </button>
              <button onClick={() => act(`/users/${id}/password-reset`, 'E-mail de redefinição enviado.')}
                className="w-full inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm border border-gray-200 text-iasd-dark hover:bg-gray-100 transition">
                <MailIcon /> Enviar redefinição de senha
              </button>
            </div>
          </section>
        </div>
      </div>

      {showRoles && (
        <RolesModal userId={user.id} userName={user.name} current={user.roles}
          onClose={() => setShowRoles(false)} onChanged={load} />
      )}
    </div>
  )
}
