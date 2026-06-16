import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { emailSettingsSchema, type EmailSettingsForm } from '@/schemas/settings'
import VerticalTabs from '@/painel/components/VerticalTabs'
import { PageHeader, Alert, Button, Field, Input } from '@/painel/ui'

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <h2 className="text-lg font-heading font-bold text-iasd-dark">E-mail</h2>

      <Alert message={msg} />

      <Field label="Host SMTP" error={errors.host?.message} htmlFor="email-host">
        <Input id="email-host" {...register('host')} />
      </Field>

      <Field label="Porta" error={errors.port?.message} htmlFor="email-port">
        <Input id="email-port" type="number" {...register('port')} />
      </Field>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('secure')} /> Usar TLS (secure)
      </label>

      <Field label="Remetente (from)" error={errors.from?.message} htmlFor="email-from">
        <Input id="email-from" {...register('from')} />
      </Field>

      <Field label="Destinatário padrão (to)" error={errors.to?.message} htmlFor="email-to">
        <Input id="email-to" {...register('to')} />
      </Field>

      <Field label="Usuário de autenticação" htmlFor="email-auth-user">
        <Input id="email-auth-user" {...register('authUser')} />
      </Field>

      <Field
        label={hasPassword ? 'Senha SMTP (já existe uma salva — preencha só para trocar)' : 'Senha SMTP'}
        htmlFor="email-password"
      >
        <Input
          id="email-password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
          placeholder={hasPassword ? '••••••••' : ''}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>Salvar</Button>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
        <Field label="Enviar e-mail de teste para:" htmlFor="email-test-to">
          <Input
            id="email-test-to"
            type="email"
            value={testTo}
            onChange={e => setTestTo(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </Field>
        <Button type="button" variant="secondary" onClick={sendTest}>Enviar teste</Button>
      </div>
    </form>
  )
}

export default function Configuracoes() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" />
      <VerticalTabs tabs={[{ key: 'email', label: 'E-mail', content: <EmailTab /> }]} />
    </div>
  )
}
