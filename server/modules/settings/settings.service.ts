import { config } from '../../core/config.js'
import { withTransaction } from '../../core/db.js'
import type { CryptoService, EncryptedValue } from '../../core/security/crypto.service.js'
import { sendMailWith, type ResolvedEmailConfig } from '../../lib/mail.js'
import type { SettingsRepository } from './settings.repository.js'
import type { EmailSettingsInput } from './dto/email-settings.dto.js'

const EMAIL_KEY = 'email'
const EMAIL_PASSWORD_KEY = 'email.smtp_password'

interface StoredEmail {
  host: string
  port: number
  secure: boolean
  from: string
  to: string
  authUser: string
}

/** Forma exposta ao cliente: sem a senha, com flag indicando se há uma salva. */
export interface PublicEmailSettings extends StoredEmail {
  hasPassword: boolean
}

export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly crypto: CryptoService,
  ) {}

  /** Helper privado: devolve a StoredEmail resolvida (banco→env) sem qualquer dado de senha. */
  private async resolveBaseEmail(): Promise<StoredEmail> {
    const stored = await this.settings.get<StoredEmail>(EMAIL_KEY)
    const e = config.emailEnvFallback
    return stored ?? {
      host: e.host, port: e.port, secure: e.secure, from: e.from, to: e.to, authUser: e.authUser,
    }
  }

  /** Lê a config não sensível (banco→env). Acrescenta hasPassword. Nunca devolve a senha. */
  async getEmailSettings(): Promise<PublicEmailSettings> {
    const base = await this.resolveBaseEmail()
    const enc = await this.settings.get<EncryptedValue>(EMAIL_PASSWORD_KEY)
    const hasPassword = enc != null || !!config.emailEnvFallback.authPass
    return { ...base, hasPassword }
  }

  /** Config resolvida para ENVIO (inclui senha decifrada). Uso interno; nunca exposta. */
  async getConfigForSending(): Promise<ResolvedEmailConfig> {
    const base = await this.resolveBaseEmail()
    let authPass: string | undefined
    const enc = await this.settings.get<EncryptedValue>(EMAIL_PASSWORD_KEY)
    if (enc) authPass = this.crypto.decrypt(enc)
    else if (config.emailEnvFallback.authPass) authPass = config.emailEnvFallback.authPass
    return {
      host: base.host, port: base.port, secure: base.secure, from: base.from, to: base.to,
      authUser: base.authUser || undefined,
      authPass,
    }
  }

  /** Salva a config. Senha cifrada só se enviada; em branco preserva a anterior (CA-06). Vale sem restart. */
  async updateEmailSettings(input: EmailSettingsInput, updatedBy: string | null): Promise<PublicEmailSettings> {
    const stored: StoredEmail = {
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

  /** Envia um e-mail de teste com a config atual. Falha de SMTP retorna ok:false + motivo (não é erro HTTP). */
  async sendTestEmail(to: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const cfg = await this.getConfigForSending()
    try {
      await sendMailWith(cfg, {
        to,
        subject: 'E-mail de teste — Painel IASD Tucuruvi',
        html: '<p>Este é um e-mail de teste enviado pelo painel. Se você o recebeu, o SMTP está configurado corretamente.</p>',
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Falha desconhecida no envio.' }
    }
  }
}
