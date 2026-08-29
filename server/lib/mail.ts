import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer/index.js'
import { config } from '../core/config.js'
import { sendViaGmailApi } from './gmail.js'

/** Config SMTP resolvida (banco→env) e pronta para envio. authPass é a senha em claro (em memória). */
export interface SmtpEmailConfig {
  authType: 'smtp'
  host: string
  port: number
  secure: boolean
  from: string
  to: string
  authUser?: string
  authPass?: string
}

/** Config OAuth2 (Gmail API) resolvida. refreshToken é o segredo decifrado (em memória). */
export interface GmailOAuthEmailConfig {
  authType: 'gmail_oauth2'
  from: string
  to: string
  sender: string
  clientId: string
  clientSecret: string
  refreshToken: string
}

/** Config de e-mail já resolvida (banco→env) e pronta para envio. */
export type ResolvedEmailConfig = SmtpEmailConfig | GmailOAuthEmailConfig

// Provider injetado no bootstrap (container.ts). Antes disso, cai no fallback de env.
let provider: (() => Promise<ResolvedEmailConfig>) | null = null
export function setEmailConfigProvider(fn: () => Promise<ResolvedEmailConfig>): void {
  provider = fn
}

function envFallback(): SmtpEmailConfig {
  const e = config.emailEnvFallback
  return {
    authType: 'smtp',
    host: e.host, port: e.port, secure: e.secure, from: e.from, to: e.to,
    authUser: e.authUser || undefined, authPass: e.authPass || undefined,
  }
}

export async function resolveEmailConfig(): Promise<ResolvedEmailConfig> {
  return provider ? provider() : envFallback()
}

function buildTransporter(cfg: SmtpEmailConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.authUser ? { user: cfg.authUser, pass: cfg.authPass ?? '' } : undefined,
  })
}

/** Envia uma mensagem usando a config vigente (banco→env). Aplica o remetente padrão se ausente. */
export async function sendMail(message: Mail.Options): Promise<void> {
  const cfg = await resolveEmailConfig()
  await sendMailWith(cfg, message)
}

/** Permite à camada de serviço enviar com uma config explícita (ex.: e-mail de teste). */
export async function sendMailWith(cfg: ResolvedEmailConfig, message: Mail.Options): Promise<void> {
  if (cfg.authType === 'gmail_oauth2') {
    await sendViaGmailApi(cfg.sender,
      { clientId: cfg.clientId, clientSecret: cfg.clientSecret, refreshToken: cfg.refreshToken },
      { ...message, to: message.to ?? cfg.to })
    return
  }
  const transporter = buildTransporter(cfg)
  await transporter.sendMail({ ...message, from: message.from ?? cfg.from })
}

interface EmailData { nome: string; telefone: string; email: string; horario: string }

export async function sendContatoEmail(data: EmailData): Promise<void> {
  await sendMail({
    to: config.emailEnvFallback.to, // destino do formulário público
    subject: `Novo pedido de estudo bíblico — ${data.nome}`,
    html: `
      <h2>Novo pedido de estudo bíblico</h2>
      <p><strong>Nome:</strong> ${data.nome}</p>
      <p><strong>Telefone/WhatsApp:</strong> ${data.telefone}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Melhor horário:</strong> ${data.horario}</p>
    `,
  })
}
