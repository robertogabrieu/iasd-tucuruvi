import { config } from '../../core/config.js'
import { withTransaction } from '../../core/db.js'
import { BadRequestError } from '../../core/errors.js'
import { issueOAuthState, verifyOAuthState } from '../../core/security/oauth-state.js'
import type { CryptoService, EncryptedValue } from '../../core/security/crypto.service.js'
import { sendMailWith, type ResolvedEmailConfig } from '../../lib/mail.js'
import { exchangeCodeForTokens, fetchGoogleEmail, GMAIL_SEND_SCOPE } from '../../lib/gmail.js'
import type { SettingsRepository } from './settings.repository.js'
import type { EmailSettingsInput } from './dto/email-settings.dto.js'

const EMAIL_KEY = 'email'
const EMAIL_PASSWORD_KEY = 'email.smtp_password'
const EMAIL_OAUTH_KEY = 'email.oauth'
const EMAIL_OAUTH_REFRESH_KEY = 'email.oauth_refresh_token'

type AuthType = 'smtp' | 'gmail_oauth2'

interface StoredEmail {
  authType: AuthType
  host: string
  port: number
  secure: boolean
  from: string
  to: string
  authUser: string
}

interface OAuthPublic {
  senderEmail: string
  connected: boolean
  clientConfigured: boolean
}

/** Forma exposta ao cliente: sem a senha, com flag indicando se há uma salva. Sem refresh token. */
export interface PublicEmailSettings extends StoredEmail {
  hasPassword: boolean
  oauth: OAuthPublic
}

export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly crypto: CryptoService,
  ) {}

  /** Helper privado: devolve a StoredEmail resolvida (banco→env) sem qualquer dado de senha. */
  private async resolveBaseEmail(): Promise<StoredEmail> {
    const stored = await this.settings.get<Partial<StoredEmail>>(EMAIL_KEY)
    const e = config.emailEnvFallback
    if (!stored) {
      return {
        authType: 'smtp',
        host: e.host, port: e.port, secure: e.secure, from: e.from, to: e.to, authUser: e.authUser,
      }
    }
    return {
      authType: stored.authType ?? 'smtp',
      host: stored.host ?? e.host,
      port: stored.port ?? e.port,
      secure: stored.secure ?? e.secure,
      from: stored.from ?? e.from,
      to: stored.to ?? e.to,
      authUser: stored.authUser ?? e.authUser,
    }
  }

  /** Lê a config não sensível (banco→env). Acrescenta hasPassword e oauth. Nunca devolve segredos. */
  async getEmailSettings(): Promise<PublicEmailSettings> {
    const base = await this.resolveBaseEmail()
    const enc = await this.settings.get<EncryptedValue>(EMAIL_PASSWORD_KEY)
    const hasPassword = enc != null || !!config.emailEnvFallback.authPass

    const oauthStored = await this.settings.get<{ senderEmail: string }>(EMAIL_OAUTH_KEY)
    const oauthRefresh = await this.settings.get<EncryptedValue>(EMAIL_OAUTH_REFRESH_KEY)
    const senderEmail = oauthStored?.senderEmail ?? ''
    const clientConfigured = !!config.googleOauthClientId && !!config.googleOauthClientSecret
    const oauth: OAuthPublic = {
      senderEmail,
      connected: !!oauthRefresh && !!senderEmail,
      clientConfigured,
    }
    return { ...base, hasPassword, oauth }
  }

  /** Config resolvida para ENVIO (inclui segredo decifrado). Uso interno; nunca exposta. */
  async getConfigForSending(): Promise<ResolvedEmailConfig> {
    const base = await this.resolveBaseEmail()

    if (base.authType === 'gmail_oauth2') {
      const oauth = await this.settings.get<{ senderEmail: string }>(EMAIL_OAUTH_KEY)
      const enc = await this.settings.get<EncryptedValue>(EMAIL_OAUTH_REFRESH_KEY)
      if (!config.googleOauthClientId || !config.googleOauthClientSecret || !enc || !oauth?.senderEmail) {
        throw new BadRequestError('Conta Google não conectada.')
      }
      return {
        authType: 'gmail_oauth2',
        from: oauth.senderEmail,
        to: base.to,
        sender: oauth.senderEmail,
        clientId: config.googleOauthClientId,
        clientSecret: config.googleOauthClientSecret,
        refreshToken: this.crypto.decrypt(enc),
      }
    }

    let authPass: string | undefined
    const enc = await this.settings.get<EncryptedValue>(EMAIL_PASSWORD_KEY)
    if (enc) authPass = this.crypto.decrypt(enc)
    else if (config.emailEnvFallback.authPass) authPass = config.emailEnvFallback.authPass
    return {
      authType: 'smtp',
      host: base.host, port: base.port, secure: base.secure, from: base.from, to: base.to,
      authUser: base.authUser || undefined,
      authPass,
    }
  }

  /** Salva a config. Senha cifrada só se enviada; em branco preserva a anterior (CA-06). Vale sem restart. */
  async updateEmailSettings(input: EmailSettingsInput, updatedBy: string | null): Promise<PublicEmailSettings> {
    const stored: StoredEmail = {
      authType: input.authType,
      host: input.host, port: input.port, secure: input.secure,
      from: input.from, to: input.to, authUser: input.authUser ?? '',
    }
    await withTransaction(async (tx) => {
      await this.settings.upsert(EMAIL_KEY, stored, updatedBy, tx)
      if (input.password && input.password.length > 0) {
        const envelope = this.crypto.encrypt(input.password)
        await this.settings.upsert(EMAIL_PASSWORD_KEY, envelope, updatedBy, tx)
      }
    })
    return this.getEmailSettings()
  }

  /** Envia um e-mail de teste com a config atual. Falha (inclui "não conectado") retorna ok:false + motivo. */
  async sendTestEmail(to: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      const cfg = await this.getConfigForSending()
      await sendMailWith(cfg, {
        to,
        subject: 'E-mail de teste — Painel IASD Tucuruvi',
        html: '<p>Este é um e-mail de teste enviado pelo painel. Se você o recebeu, o envio está configurado corretamente.</p>',
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Falha desconhecida no envio.' }
    }
  }

  private redirectUri(): string {
    return `${config.publicBaseUrl}/api/admin/settings/email/oauth/callback`
  }

  async buildAuthorizeUrl(userId: string): Promise<string> {
    if (!config.googleOauthClientId) throw new BadRequestError('GOOGLE_OAUTH_CLIENT_ID não configurado no servidor.')
    const p = new URLSearchParams({
      client_id: config.googleOauthClientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: GMAIL_SEND_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state: issueOAuthState(userId),
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`
  }

  async handleOAuthCallback(code: string, state: string): Promise<void> {
    const payload = verifyOAuthState(state)
    if (!payload) throw new BadRequestError('State OAuth inválido ou expirado.')
    if (!config.googleOauthClientId || !config.googleOauthClientSecret) throw new BadRequestError('Client OAuth não configurado.')
    const { refreshToken, accessToken } = await exchangeCodeForTokens({
      code, clientId: config.googleOauthClientId, clientSecret: config.googleOauthClientSecret, redirectUri: this.redirectUri(),
    })
    if (!refreshToken) throw new BadRequestError('Google não retornou refresh token (revogue o acesso e reconecte).')
    const email = await fetchGoogleEmail(accessToken)
    await withTransaction(async (tx) => {
      await this.settings.upsert(EMAIL_OAUTH_KEY, { senderEmail: email }, payload.userId, tx)
      await this.settings.upsert(EMAIL_OAUTH_REFRESH_KEY, this.crypto.encrypt(refreshToken), payload.userId, tx)
    })
  }

  async disconnectOAuth(updatedBy: string | null): Promise<PublicEmailSettings> {
    await withTransaction(async (tx) => {
      await this.settings.upsert(EMAIL_OAUTH_REFRESH_KEY, null, updatedBy, tx)   // valor null = ausente
      await this.settings.upsert(EMAIL_OAUTH_KEY, { senderEmail: '' }, updatedBy, tx)
    })
    return this.getEmailSettings()
  }
}
