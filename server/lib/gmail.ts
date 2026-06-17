// MailComposer não tem .d.ts nesse subcaminho; import default funciona (CJS, sem exports map).
// @ts-ignore - sem tipos para o subcaminho
import MailComposer from 'nodemailer/lib/mail-composer/index.js'
import type Mail from 'nodemailer/lib/mailer/index.js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'

export interface GmailOAuthCreds { clientId: string; clientSecret: string; refreshToken: string }
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

export async function getAccessToken(c: GmailOAuthCreds): Promise<string> {
  const cached = tokenCache.get(c.refreshToken)
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token
  const res = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken, grant_type: 'refresh_token' }),
  })
  if (!res.ok) throw new Error(`Falha ao renovar o token do Google (HTTP ${res.status}).`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache.set(c.refreshToken, { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 })
  return data.access_token
}

/** Envia pela Gmail API. From é SEMPRE `sender` (conta conectada). */
export async function sendViaGmailApi(sender: string, creds: GmailOAuthCreds, message: Mail.Options): Promise<void> {
  const accessToken = await getAccessToken(creds)
  const raw: Buffer = await new MailComposer({ ...message, from: sender }).compile().build()
  const res = await fetch(SEND_URL, {
    method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw: raw.toString('base64url') }),
  })
  if (!res.ok) { const b = await res.text().catch(() => ''); throw new Error(`Gmail API HTTP ${res.status}: ${b.slice(0, 200)}`) }
}

export async function exchangeCodeForTokens(p: { code: string; clientId: string; clientSecret: string; redirectUri: string }): Promise<{ refreshToken: string | null; accessToken: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: p.code, client_id: p.clientId, client_secret: p.clientSecret, redirect_uri: p.redirectUri, grant_type: 'authorization_code' }),
  })
  if (!res.ok) throw new Error(`Falha na troca do code OAuth (HTTP ${res.status}).`)
  const data = (await res.json()) as { access_token: string; refresh_token?: string }
  return { refreshToken: data.refresh_token ?? null, accessToken: data.access_token }
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Falha ao obter e-mail da conta Google (HTTP ${res.status}).`)
  const data = (await res.json()) as { email?: string }
  if (!data.email) throw new Error('Conta Google sem e-mail no userinfo.')
  return data.email
}
