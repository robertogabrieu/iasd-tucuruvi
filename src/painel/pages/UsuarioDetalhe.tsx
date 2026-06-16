import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, Link } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { editarUsuarioSchema, type EditarUsuarioForm } from '@/schemas/usuarios'
import RolesModal from '@/painel/components/RolesModal'
import {
  Card, Button, Badge, StatusBadge, Chip,
  Alert, Field, Input,
  Avatar,
} from '@/painel/ui'

interface Detail {
  id: string; name: string; email: string; status: 'active' | 'disabled'
  roles: string[]; last_login_at: string | null; created_at: string
  failed_login_count: number; locked_until: string | null
}

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const PowerIcon = () => icon(<><path d="M12 3v9" /><path d="M6.4 6.4a8 8 0 1011.2 0" /></>)
const CheckIcon = () => icon(<path d="M20 6 9 17l-5-5" />)
const UnlockIcon = () => icon(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 017-2.6" /></>)
const MailIcon = () => icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>)

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
      <div className="space-y-4">
        <Link to="/painel/usuarios" className="text-iasd-accent hover:underline text-sm">← Voltar</Link>
        {msg && <Alert message={msg} />}
      </div>
    )
  }

  const active = user.status === 'active'
  const locked = !!user.locked_until && new Date(user.locked_until) > new Date()

  return (
    <div className="space-y-6">
      <Link to="/painel/usuarios" className="inline-flex items-center gap-1 text-iasd-accent hover:underline text-sm">← Voltar para Usuários</Link>

      {msg && <Alert message={msg} />}

      {/* Cabeçalho */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-heading font-bold text-iasd-dark truncate">{user.name}</h1>
              <StatusBadge status={user.status} />
              {locked && <Badge color="amber">Bloqueado</Badge>}
            </div>
            <p className="text-gray-500 truncate">{user.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {user.roles.length > 0
                ? user.roles.map(r => <Chip key={r}>{r}</Chip>)
                : <span className="text-xs text-gray-400">Sem papéis</span>}
            </div>
          </div>
          <dl className="text-xs text-gray-500 sm:text-right space-y-1 shrink-0">
            <div><dt className="inline text-gray-400">Criado em </dt><dd className="inline">{fmt(user.created_at)}</dd></div>
            <div><dt className="inline text-gray-400">Último login </dt><dd className="inline">{fmt(user.last_login_at)}</dd></div>
          </dl>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Dados */}
        <Card title="Dados do usuário">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Nome" error={errors.name?.message} htmlFor="name">
              <Input id="name" {...register('name')} />
            </Field>
            <Field label="E-mail" error={errors.email?.message} htmlFor="email">
              <Input id="email" {...register('email')} />
            </Field>
            <Button type="submit" disabled={isSubmitting}>Salvar alterações</Button>
          </form>
        </Card>

        {/* Papéis + Conta */}
        <div className="space-y-6">
          <Card title="Papéis" actions={<Button variant="secondary" size="sm" onClick={() => setShowRoles(true)}>Gerenciar</Button>}>
            <div className="flex flex-wrap gap-1.5">
              {user.roles.length > 0
                ? user.roles.map(r => <Chip key={r}>{r}</Chip>)
                : <span className="text-sm text-gray-400">Nenhum papel atribuído.</span>}
            </div>
          </Card>

          <Card title="Conta">
            <div className="space-y-2.5">
              <Button
                variant={active ? 'danger' : 'secondary'}
                full
                icon={active ? <PowerIcon /> : <CheckIcon />}
                onClick={() => act(`/users/${id}/status`, active ? 'Conta desativada.' : 'Conta reativada.', { status: active ? 'disabled' : 'active' })}
              >
                {active ? 'Desativar conta' : 'Reativar conta'}
              </Button>
              <Button
                variant="secondary"
                full
                disabled={!locked}
                icon={<UnlockIcon />}
                onClick={() => act(`/users/${id}/unlock`, 'Conta desbloqueada.')}
              >
                {locked ? 'Desbloquear conta' : 'Conta não está bloqueada'}
              </Button>
              <Button
                variant="secondary"
                full
                icon={<MailIcon />}
                onClick={() => act(`/users/${id}/password-reset`, 'E-mail de redefinição enviado.')}
              >
                Enviar redefinição de senha
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {showRoles && (
        <RolesModal userId={user.id} userName={user.name} current={user.roles}
          onClose={() => setShowRoles(false)} onChanged={load} />
      )}
    </div>
  )
}
