import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { emailSettingsSchema, type EmailSettingsForm } from '@/schemas/settings'
import VerticalTabs from '@/painel/components/VerticalTabs'

function EmailTab() {
  const [hasPassword, setHasPassword] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testTo, setTestTo] = useState('')
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<EmailSettingsForm>({ resolver: zodResolver(emailSettingsSchema) })

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      const res = await adminFetch('/settings/email')
      if (res.ok) {
        const { email } = await res.json()
        setHasPassword(email.hasPassword)
        reset({ host: email.host, port: email.port, secure: email.secure,
          from: email.from, to: email.to, authUser: email.authUser ?? '', password: '' })
      }
    })()
  }, [reset])

  async function onSubmit(data: EmailSettingsForm) {
    setMsg(null)
    const body = { ...data, authUser: data.authUser ?? '' }
    if (!data.password) delete (body as Record<string, unknown>).password // em branco preserva (CA-06)
    const res = await adminFetch('/settings/email', { method: 'PUT', body: JSON.stringify(body) })
    if (res.ok) {
      const { email } = await res.json()
      setHasPassword(email.hasPassword)
      reset({ ...email, authUser: email.authUser ?? '', password: '' })
      setMsg({ kind: 'ok', text: 'Configuração salva.' })
    } else {
      setMsg({ kind: 'err', text: 'Não foi possível salvar (verifique os campos).' })
    }
  }

  async function sendTest() {
    setMsg(null)
    const res = await adminFetch('/settings/email/test', { method: 'POST', body: JSON.stringify({ to: testTo }) })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) setMsg({ kind: 'ok', text: 'E-mail de teste enviado.' })
    else setMsg({ kind: 'err', text: `Falha no envio: ${data.reason ?? 'erro desconhecido'}` })
  }

  const field = 'w-full border rounded px-3 py-2'
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <h2 className="text-lg font-heading font-bold text-iasd-dark">E-mail</h2>
      {msg && <p className={msg.kind === 'ok' ? 'text-green-700 text-sm' : 'text-red-600 text-sm'}>{msg.text}</p>}

      <div>
        <label className="block text-sm mb-1">Host SMTP</label>
        <input {...register('host')} className={field} />
        {errors.host && <p className="text-red-600 text-xs mt-1">{errors.host.message}</p>}
      </div>
      <div>
        <label className="block text-sm mb-1">Porta</label>
        <input type="number" {...register('port')} className={field} />
        {errors.port && <p className="text-red-600 text-xs mt-1">{errors.port.message}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('secure')} /> Usar TLS (secure)
      </label>
      <div>
        <label className="block text-sm mb-1">Remetente (from)</label>
        <input {...register('from')} className={field} />
        {errors.from && <p className="text-red-600 text-xs mt-1">{errors.from.message}</p>}
      </div>
      <div>
        <label className="block text-sm mb-1">Destinatário padrão (to)</label>
        <input {...register('to')} className={field} />
        {errors.to && <p className="text-red-600 text-xs mt-1">{errors.to.message}</p>}
      </div>
      <div>
        <label className="block text-sm mb-1">Usuário de autenticação</label>
        <input {...register('authUser')} className={field} />
      </div>
      <div>
        <label className="block text-sm mb-1">Senha SMTP {hasPassword && <span className="text-gray-500">(já existe uma salva — preencha só para trocar)</span>}</label>
        <input type="password" autoComplete="new-password" {...register('password')} className={field}
          placeholder={hasPassword ? '••••••••' : ''} />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isSubmitting}
          className="bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition disabled:opacity-60">
          Salvar
        </button>
      </div>

      <div className="border-t pt-4 mt-4">
        <label className="block text-sm mb-1">Enviar e-mail de teste para:</label>
        <div className="flex gap-2">
          <input type="email" value={testTo} onChange={e => setTestTo(e.target.value)}
            className={field} placeholder="voce@exemplo.com" />
          <button type="button" onClick={sendTest}
            className="shrink-0 border border-iasd-dark text-iasd-dark rounded px-4 py-2 hover:bg-gray-200 transition">
            Enviar teste
          </button>
        </div>
      </div>
    </form>
  )
}

export default function Configuracoes() {
  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-iasd-dark mb-6">Configurações</h1>
      <VerticalTabs tabs={[{ key: 'email', label: 'E-mail', content: <EmailTab /> }]} />
    </div>
  )
}
