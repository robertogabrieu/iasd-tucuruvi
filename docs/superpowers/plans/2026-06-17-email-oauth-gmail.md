# E-mail via OAuth2 (Gmail API) — Plano de Implementação

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir configurar o envio de e-mail do painel via **OAuth2 (Gmail API, escopo `gmail.send`)**, ao lado do SMTP/senha atual, com fluxo "Conectar conta Google". `client_id`/`client_secret` vêm do **env**; o refresh token fica cifrado no banco.

**Architecture:** A config de e-mail ganha `authType` (`smtp` | `gmail_oauth2`). No modo OAuth o envio é pela **Gmail API** (`users.messages.send`): access token do refresh token (cache em memória), MIME pelo `MailComposer` do nodemailer. Fluxo OAuth no painel; callback autenticado por **`state` assinado** (cookies são `SameSite=Strict`). `client_id`/`secret` no env (`GOOGLE_OAUTH_CLIENT_ID/SECRET`); refresh token cifrado (CryptoService, US-15).

**Tech Stack:** Express 5 · nodemailer (`MailComposer` + SMTP, já presente) · Gmail API via `fetch` · Zod · React + TS. Spec: `docs/superpowers/specs/2026-06-17-email-oauth-gmail-design.md`.

**Convenção de verificação (projeto SEM testes):** cada tarefa fecha com `npm run build` (Vite + `tsc -p tsconfig.server.json`) e, no frontend, `npx tsc -p tsconfig.json --noEmit`, + verificação manual quando há comportamento. ESM backend usa sufixo `.js`; schemas Zod client/server em sincronia; só o kit de UI no painel.

---

## Mapa de arquivos
**Novos:** `server/core/security/oauth-state.ts`, `server/lib/gmail.ts`.
**Modificados:** `server/core/config.ts`, `server/lib/mail.ts`, `server/modules/settings/dto/email-settings.dto.ts`, `server/modules/settings/settings.service.ts`, `server/modules/settings/settings.controller.ts`, `server/modules/settings/settings.routes.ts`, `src/schemas/settings.ts`, `src/painel/pages/Configuracoes.tsx`, `.env.example`, `deploy.sh`, `update.sh`.

---

## Task 1: Env (`config.ts`) + helper de `state`

**Files:** Modify `server/core/config.ts`; Create `server/core/security/oauth-state.ts`

- [ ] **Step 1: `config.ts`** — adicionar:
```ts
googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
```

- [ ] **Step 2: `oauth-state.ts`** (HMAC com `config.csrfSecret`; payload `{ userId, iat, nonce }`; expira em 10 min):
```ts
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { config } from '../config.js'

export interface OAuthStatePayload { userId: string; iat: number; nonce: string }
const MAX_AGE_MS = 10 * 60 * 1000

function sign(data: string): string {
  return createHmac('sha256', config.csrfSecret).update(data).digest('base64url')
}
export function issueOAuthState(userId: string): string {
  const payload: OAuthStatePayload = { userId, iat: Date.now(), nonce: randomBytes(9).toString('base64url') }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${data}.${sign(data)}`
}
export function verifyOAuthState(state: string | undefined): OAuthStatePayload | null {
  if (!state) return null
  const dot = state.lastIndexOf('.')
  if (dot < 0) return null
  const data = state.slice(0, dot)
  const a = Buffer.from(state.slice(dot + 1))
  const b = Buffer.from(sign(data))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let payload: OAuthStatePayload
  try { payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) } catch { return null }
  if (typeof payload?.userId !== 'string' || typeof payload?.iat !== 'number') return null
  if (Date.now() - payload.iat > MAX_AGE_MS) return null
  return payload
}
```

- [ ] **Step 3: Build + smoke** — `npm run build`; `npx tsx -e "import {issueOAuthState,verifyOAuthState} from './server/core/security/oauth-state.ts'; const s=issueOAuthState('u1'); console.log(verifyOAuthState(s), verifyOAuthState(s+'x'))"` → 1º objeto, 2º `null`.
- [ ] **Step 4: Commit** — `feat(email-oauth): env GOOGLE_OAUTH_* + helper de state assinado`

---

## Task 2: Cliente Google (`server/lib/gmail.ts`)

**Files:** Create `server/lib/gmail.ts`

- [ ] **Step 1:** token (com cache), envio Gmail API, troca de code, userinfo:
```ts
// MailComposer não tem .d.ts nesse subcaminho; import default funciona (CJS, sem exports map).
// @ts-expect-error - sem tipos para o subcaminho
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
```

- [ ] **Step 2: Build** — confirmar compile (se `tsc` reclamar de "unused @ts-expect-error", trocar por `@ts-ignore`). `MailComposer(...).compile().build()` sem callback retorna `Promise<Buffer>` → `await` ok.
- [ ] **Step 3: Commit** — `feat(email-oauth): cliente Gmail API (token+cache, envio, code, userinfo)`

---

## Task 3: `ResolvedEmailConfig` união + ramificação no envio

**Files:** Modify `server/lib/mail.ts`

- [ ] **Step 1:** união discriminada:
```ts
export interface SmtpEmailConfig { authType: 'smtp'; host: string; port: number; secure: boolean; from: string; to: string; authUser?: string; authPass?: string }
export interface GmailOAuthEmailConfig { authType: 'gmail_oauth2'; from: string; to: string; sender: string; clientId: string; clientSecret: string; refreshToken: string }
export type ResolvedEmailConfig = SmtpEmailConfig | GmailOAuthEmailConfig
```
`envFallback()` retorna `{ authType: 'smtp', ... }`. `buildTransporter(cfg: SmtpEmailConfig)`.

- [ ] **Step 2:** ramificar `sendMailWith` (atenção à ordem do spread — chave de override **por último**):
```ts
import { sendViaGmailApi } from './gmail.js'

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
```
(Corrige também o foot-gun de spread em **`sendMailWith` E `sendMail`** — ambos hoje têm `{ from: message.from ?? cfg.from, ...message }`, onde o `...message` sobrescreve o `from`; trocar para `{ ...message, from: message.from ?? cfg.from }` nos dois.)

- [ ] **Step 3: Build** — `tsc -p tsconfig.server.json` vai **acusar erros em `settings.service.ts`** (constrói o `ResolvedEmailConfig` no shape antigo). **Esperado — corrigido na Task 4.** Não tratar como tarefa quebrada.
- [ ] **Step 4: Commit** — `feat(email-oauth): ResolvedEmailConfig discriminada (smtp | gmail_oauth2)`

---

## Task 4: Settings service + DTO

**Files:** Modify `server/modules/settings/settings.service.ts`, `dto/email-settings.dto.ts`

Chaves novas: `EMAIL_OAUTH_KEY='email.oauth'` (`{ senderEmail }`), `EMAIL_OAUTH_REFRESH_KEY='email.oauth_refresh_token'` (cifrado). `client_id/secret` vêm de `config.googleOauthClientId/Secret`.

- [ ] **Step 1: DTO** — `emailSettingsDto` ganha `authType: z.enum(['smtp','gmail_oauth2']).default('smtp')`; `host` deixa de ter `.min(1)` e passa a ser exigido via `superRefine` só quando `authType==='smtp'`:
```ts
export const emailSettingsDto = z.object({
  authType: z.enum(['smtp', 'gmail_oauth2']).default('smtp'),
  host: z.string().optional().default(''),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  from: z.email('Remetente inválido.'),
  to: z.email('Destinatário inválido.'),
  authUser: z.string().optional().default(''),
  password: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.authType === 'smtp' && !v.host) ctx.addIssue({ code: 'custom', path: ['host'], message: 'Informe o host SMTP.' })
})
```
(Não há `oauthClientDto` — credenciais no env.)

- [ ] **Step 2: Tipos no service**
- `StoredEmail` ganha `authType: 'smtp' | 'gmail_oauth2'` (default `smtp`).
- `PublicEmailSettings` ganha `authType` e `oauth: { senderEmail: string; connected: boolean; clientConfigured: boolean }` (sem clientId/secret/refresh token).

- [ ] **Step 3: `getEmailSettings`** — inclui `authType`; monta `oauth`:
  - `senderEmail` de `email.oauth`;
  - `connected` = `!!(await get<EncryptedValue>(EMAIL_OAUTH_REFRESH_KEY)) && !!senderEmail`;
  - `clientConfigured` = `!!config.googleOauthClientId && !!config.googleOauthClientSecret`.
  - **Nunca** decifra/expõe refresh token.

- [ ] **Step 4: `getConfigForSending`** — ramo OAuth com guarda ANTES do decrypt:
```ts
if (base.authType === 'gmail_oauth2') {
  const oauth = await this.settings.get<{ senderEmail: string }>(EMAIL_OAUTH_KEY)
  const enc = await this.settings.get<EncryptedValue>(EMAIL_OAUTH_REFRESH_KEY)
  if (!config.googleOauthClientId || !config.googleOauthClientSecret || !enc || !oauth?.senderEmail) {
    throw new BadRequestError('Conta Google não conectada.')
  }
  return {
    authType: 'gmail_oauth2', from: oauth.senderEmail, to: base.to, sender: oauth.senderEmail,
    clientId: config.googleOauthClientId, clientSecret: config.googleOauthClientSecret,
    refreshToken: this.crypto.decrypt(enc),
  }
}
// ramo smtp: como hoje, mas retornando { authType: 'smtp', ... }
```

- [ ] **Step 5: `updateEmailSettings`** — o objeto `stored` passa a incluir **`authType: input.authType`** (senão o seletor não persiste).

- [ ] **Step 6: `sendTestEmail`** — mover `getConfigForSending()` para **dentro** do `try` (hoje está antes) → "não conectado" vira `{ ok:false, reason }`.

- [ ] **Step 7: Métodos OAuth**
```ts
private redirectUri() { return `${config.publicBaseUrl}/api/admin/settings/email/oauth/callback` }

async buildAuthorizeUrl(userId: string): Promise<string> {
  if (!config.googleOauthClientId) throw new BadRequestError('GOOGLE_OAUTH_CLIENT_ID não configurado no servidor.')
  const p = new URLSearchParams({
    client_id: config.googleOauthClientId, redirect_uri: this.redirectUri(),
    response_type: 'code', scope: GMAIL_SEND_SCOPE, access_type: 'offline', prompt: 'consent', state: issueOAuthState(userId),
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

async disconnectOAuth(updatedBy: string | null) {
  await withTransaction(async (tx) => {
    await this.settings.upsert(EMAIL_OAUTH_REFRESH_KEY, null, updatedBy, tx)   // valor null = ausente
    await this.settings.upsert(EMAIL_OAUTH_KEY, { senderEmail: '' }, updatedBy, tx)
  })
  return this.getEmailSettings()
}
```
> `upsert(KEY, null)` grava JSON `null`; `get` devolve `null` (via `?? null`). As guardas de `getEmailSettings`/`getConfigForSending` tratam falsy como não-conectado **antes** de `decrypt` — não há `decrypt(null)`. Sem mudança no repositório.

- [ ] **Step 8: Imports** — `config`, `BadRequestError` (core/errors), `withTransaction`, `EncryptedValue` (já importado), e de `lib/gmail.js`: `exchangeCodeForTokens`, `fetchGoogleEmail`, `GMAIL_SEND_SCOPE`; de `core/security/oauth-state.js`: `issueOAuthState`, `verifyOAuthState`.

- [ ] **Step 9: Build** — `npm run build` agora passa (resolve os erros da Task 3).
- [ ] **Step 10: Commit** — `feat(email-oauth): settings service + DTO (env creds, fluxo OAuth, guardas)`

---

## Task 5: Controller + rotas

**Files:** Modify `server/modules/settings/settings.controller.ts`, `settings.routes.ts`

- [ ] **Step 1: Controller** (narrow do `req.query` p/ não quebrar o `tsc`):
```ts
authorize = async (req: Request, res: Response) => {
  res.json({ url: await this.settings.buildAuthorizeUrl(req.user!.id) })
}
oauthCallback = async (req: Request, res: Response) => {
  try {
    await this.settings.handleOAuthCallback(String(req.query.code ?? ''), String(req.query.state ?? ''))
    res.redirect('/painel/configuracoes?oauth=ok')
  } catch {
    res.redirect('/painel/configuracoes?oauth=erro')
  }
}
disconnect = async (req: Request, res: Response) => {
  res.json({ email: await this.settings.disconnectOAuth(req.user?.id ?? null) })
}
```

- [ ] **Step 2: Rotas** (em `makeSettingsRoutes`):
```ts
r.get('/settings/email/oauth/authorize', wrap(requireAuth), perm, wrap(controller.authorize))
r.get('/settings/email/oauth/callback', wrap(controller.oauthCallback)) // SEM requireAuth (state autentica)
r.post('/settings/email/oauth/disconnect', wrap(requireAuth), perm, requireCsrf, wrap(controller.disconnect))
```

- [ ] **Step 3: Build + verificação** — subir o server; `GET /api/admin/settings/email` traz `authType` + `oauth:{senderEmail:'',connected:false,clientConfigured:<bool>}`. Com env setado, `GET .../authorize` retorna URL de `accounts.google.com` com `redirect_uri`, `scope=gmail.send`, `state`.
- [ ] **Step 4: Commit** — `feat(email-oauth): controller + rotas OAuth (callback via state)`

> Nota: nenhum wiring novo no `container.ts` — o `SettingsService` lê `config` direto (env + publicBaseUrl); as rotas saem do `makeSettingsRoutes` já exportado.

---

## Task 6: Schema client (sincronia)

**Files:** Modify `src/schemas/settings.ts`

- [ ] **Step 1:** adicionar `authType: z.enum(['smtp','gmail_oauth2']).default('smtp')` e **replicar o `superRefine`** (host obrigatório só em `smtp`), removendo o `.min(1)` de `host` (manter `z.coerce.number()` em `port`, conforme nota existente). Sem campos de client OAuth.
- [ ] **Step 2: tsc front** → passa.
- [ ] **Step 3: Commit** — `feat(email-oauth): authType + host condicional no schema client`

---

## Task 7: Tela `/painel/configuracoes`

**Files:** Modify `src/painel/pages/Configuracoes.tsx`

- [ ] **Step 1:** estender o tipo da resposta de `GET /settings/email` (`authType`, `oauth`). Campo controlado **"Tipo de autenticação"** (`authType`) no form.
- [ ] **Step 2: SMTP** — bloco atual, exibido quando `authType==='smtp'`.
- [ ] **Step 3: Gmail OAuth2** (quando `authType==='gmail_oauth2'`):
  - **Sem campos de client_id/secret.** Se `oauth.clientConfigured===false`: aviso "Defina `GOOGLE_OAUTH_CLIENT_ID/SECRET` no servidor" + botão Conectar **desabilitado**.
  - **Redirect URI** read-only + copiar = `${window.location.origin}/api/admin/settings/email/oauth/callback`.
  - **"Conectar conta Google"** (habilitado se `clientConfigured`) → `const { url } = await adminFetch('/settings/email/oauth/authorize').then(r=>r.json()); window.location.href = url`.
  - **Status**: "Conectado como `oauth.senderEmail`" + **"Desconectar"** (`POST .../oauth/disconnect`), ou "Não conectado".
  - Sem campo `from`: "Enviando como: `oauth.senderEmail`" quando conectado. `to` (teste) segue.
  - Aviso: publicar o app no Google Cloud (produção) p/ não expirar em 7 dias.
- [ ] **Step 4:** ler `?oauth=ok|erro` (`location.search`), `Alert` + recarregar `GET /settings/email`.
- [ ] **Step 5:** submit manda `authType`; "Enviar e-mail de teste" funciona nos dois modos.
- [ ] **Step 6: tsc front + verificação visual** — alternar o seletor mostra os blocos certos; tudo no kit de UI.
- [ ] **Step 7: Commit** — `feat(email-oauth): tela de configuração com modo Gmail OAuth2`

---

## Task 8: Env nos scripts + docs

**Files:** Modify `.env.example`, `deploy.sh`, `update.sh`, `CLAUDE.md`

- [ ] **Step 1:** `.env.example` — documentar `GOOGLE_OAUTH_CLIENT_ID=` e `GOOGLE_OAUTH_CLIENT_SECRET=` (com comentário: OAuth Gmail, opcional; só p/ o modo Gmail no painel).
- [ ] **Step 2:** `deploy.sh` — prompt opcional (em branco permitido) e gravar as duas vars no `.env.local` (mesmo padrão da `YOUTUBE_API_KEY`/`PUBLIC_BASE_URL`).
- [ ] **Step 3:** `update.sh` — opcional: não bloquear se ausentes (o modo OAuth só é usado se o admin escolher). Pode só garantir que linhas existam comentadas — **decisão:** não mexer (são opcionais; documentadas no `.env.example`).
- [ ] **Step 4:** `CLAUDE.md` — nota curta: modo de e-mail OAuth (Gmail API/`gmail.send`), env `GOOGLE_OAUTH_*`, callback `/api/admin/settings/email/oauth/callback`.
- [ ] **Step 5: Commit** — `docs(email-oauth): env GOOGLE_OAUTH_* no .env.example/deploy + CLAUDE.md`

---

## Task 9: Verificação fim-a-fim + PR

- [ ] **Step 1: Setup (usuário)** — Google Cloud (Gmail API, consent Externo + `gmail.send` + test user, client Web com redirect `${PUBLIC_BASE_URL}/api/admin/settings/email/oauth/callback`, app publicado). `.env.local`: `GOOGLE_OAUTH_CLIENT_ID/SECRET` + `PUBLIC_BASE_URL` absoluto.
- [ ] **Step 2: Verificação** — painel: Gmail OAuth2 → "Conectar conta Google" → consent → "Conectado como…". "Enviar e-mail de teste" chega na caixa real. Desconectar/reconectar. SMTP/Mailpit e `/api/contato` ok. `GET /settings/email` nunca expõe refresh token.
- [ ] **Step 3: Review + PR** — superpowers:requesting-code-review no diff; endereçar; superpowers:finishing-a-development-branch → PR `feat/email-oauth-gmail` → master.

---

## Segurança (resumo)
- `refresh_token` cifrado (CryptoService); `client_id/secret` só no env; nada sensível exposto em `GET /settings/email`.
- Callback **sem `requireAuth`** (cookies SameSite=Strict), autenticado por `state` assinado (`iat`≤10min + nonce).
- Escopo `gmail.send`; `From` sempre = conta conectada; `decrypt` nunca em valor ausente (guardas).
- `settings:manage` + `requireCsrf` nas mutações; redirect URI fixo; exige `PUBLIC_BASE_URL` absoluto p/ OAuth.
