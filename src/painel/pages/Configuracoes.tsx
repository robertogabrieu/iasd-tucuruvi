import { useCallback, useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { emailSettingsSchema, type EmailSettingsForm, type EmailSettingsFormInput } from '@/schemas/settings'
import VerticalTabs from '@/painel/components/VerticalTabs'
import { PageHeader, Alert, Button, Field, Input, Select } from '@/painel/ui'

type OAuthInfo = { senderEmail: string; connected: boolean; clientConfigured: boolean }
type EmailResponse = {
  authType: 'smtp' | 'gmail_oauth2'
  host: string
  port: number
  secure: boolean
  from: string
  to: string
  authUser?: string
  hasPassword: boolean
  oauth: OAuthInfo
}

const REDIRECT_URI = `${window.location.origin}/api/admin/settings/email/oauth/callback`

function EmailTab() {
  const [hasPassword, setHasPassword] = useState(false)
  const [oauth, setOauth] = useState<OAuthInfo>({ senderEmail: '', connected: false, clientConfigured: false })
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testTo, setTestTo] = useState('')
  const [copied, setCopied] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  // Três genéricos: entrada (campos) · contexto · saída transformada (submit). Necessário porque
  // z.coerce.number() em `port` faz a entrada (unknown) divergir da saída (number).
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } =
    useForm<EmailSettingsFormInput, unknown, EmailSettingsForm>({ resolver: zodResolver(emailSettingsSchema) })

  // authType é controlado via select registrado; observamos para alternar os blocos.
  const authType = useWatch({ control, name: 'authType' }) ?? 'smtp'

  const load = useCallback(async () => {
    const res = await adminFetch('/settings/email')
    if (res.ok) {
      const { email } = (await res.json()) as { email: EmailResponse }
      setHasPassword(email.hasPassword)
      setOauth(email.oauth)
      reset({
        authType: email.authType, host: email.host, port: email.port, secure: email.secure,
        from: email.from, to: email.to, authUser: email.authUser ?? '', password: '',
      })
    }
  }, [reset])

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      await load()
    })()
  }, [load])

  // Retorno do fluxo OAuth do Google: /painel/configuracoes?oauth=ok|erro
  useEffect(() => {
    const result = searchParams.get('oauth')
    if (!result) return
    if (result === 'ok') setMsg({ kind: 'ok', text: 'Conta Google conectada.' })
    else setMsg({ kind: 'err', text: 'Não foi possível conectar a conta Google.' })
    load()
    // limpa o query param da URL
    const next = new URLSearchParams(searchParams)
    next.delete('oauth')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, load])

  async function onSubmit(data: EmailSettingsForm) {
    setMsg(null)
    const body = { ...data, authUser: data.authUser ?? '' }
    if (!data.password) delete (body as Record<string, unknown>).password // em branco preserva (CA-06)
    const res = await adminFetch('/settings/email', { method: 'PUT', body: JSON.stringify(body) })
    if (res.ok) {
      await load() // recarrega do servidor (fonte da verdade) — repõe form/hasPassword/oauth
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

  async function connectGoogle() {
    setMsg(null)
    try {
      const res = await adminFetch('/settings/email/oauth/authorize')
      if (!res.ok) throw new Error()
      const { url } = (await res.json()) as { url: string }
      window.location.href = url
    } catch {
      setMsg({ kind: 'err', text: 'Não foi possível iniciar a conexão com o Google.' })
    }
  }

  async function disconnectGoogle() {
    setMsg(null)
    const res = await adminFetch('/settings/email/oauth/disconnect', { method: 'POST' })
    if (res.ok) {
      const { email } = (await res.json()) as { email: EmailResponse }
      setOauth(email.oauth)
      setMsg({ kind: 'ok', text: 'Conta Google desconectada.' })
    } else {
      setMsg({ kind: 'err', text: 'Não foi possível desconectar a conta Google.' })
    }
  }

  async function copyRedirectUri() {
    try {
      await navigator.clipboard.writeText(REDIRECT_URI)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard indisponível: o campo read-only permite copiar manualmente */
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <h2 className="text-lg font-heading font-bold text-iasd-dark">E-mail</h2>

      <Alert message={msg} />

      <Field label="Tipo de autenticação" htmlFor="email-auth-type">
        <Select id="email-auth-type" {...register('authType')}>
          <option value="smtp">SMTP (senha / App Password)</option>
          <option value="gmail_oauth2">Gmail (OAuth2)</option>
        </Select>
      </Field>

      {authType === 'smtp' ? (
        <>
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
        </>
      ) : (
        <div className="space-y-4">
          {/* Campos exigidos pelo schema também no modo OAuth: ficam ocultos para não bloquear o submit. */}
          <input type="hidden" {...register('host')} />
          <input type="hidden" {...register('from')} />
          <input type="hidden" {...register('secure')} />

          {!oauth.clientConfigured && (
            <Alert kind="err">
              Defina <code>GOOGLE_OAUTH_CLIENT_ID</code> e <code>GOOGLE_OAUTH_CLIENT_SECRET</code> no servidor para
              habilitar o modo Gmail (OAuth2).
            </Alert>
          )}

          <Field label="Redirect URI (registre no Google Cloud)" htmlFor="email-redirect-uri">
            <div className="flex gap-2">
              <Input id="email-redirect-uri" readOnly value={REDIRECT_URI} onFocus={e => e.target.select()} />
              <Button type="button" variant="secondary" onClick={copyRedirectUri}>
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Cadastre esta URI como "URI de redirecionamento autorizado" no cliente OAuth do Google Cloud.
            </p>
          </Field>

          <div className="rounded-lg border border-gray-200 px-4 py-3 space-y-3">
            {oauth.connected ? (
              <>
                <p className="text-sm text-gray-700">
                  Conectado — enviando como <strong>{oauth.senderEmail}</strong>
                </p>
                <Button type="button" variant="secondary" onClick={disconnectGoogle}>Desconectar</Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700">Não conectado.</p>
                <Button type="button" onClick={connectGoogle} disabled={!oauth.clientConfigured}>
                  Conectar conta Google
                </Button>
              </>
            )}
          </div>

          <Field label="Destinatário padrão (to)" error={errors.to?.message} htmlFor="email-to-oauth">
            <Input id="email-to-oauth" {...register('to')} />
          </Field>

          <Alert kind="ok">
            Publique o app no Google Cloud (modo Produção) para que a conexão não expire em 7 dias.
          </Alert>
        </div>
      )}

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
