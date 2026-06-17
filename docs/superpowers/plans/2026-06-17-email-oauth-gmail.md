# E-mail via OAuth2 (Gmail API) — Plano de Implementação

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir configurar o envio de e-mail do painel via **OAuth2 (Gmail API, escopo `gmail.send`)**, ao lado do modo SMTP/senha atual, com fluxo "Conectar conta Google" e tokens cifrados.

**Architecture:** A config de e-mail ganha `authType` (`smtp` | `gmail_oauth2`). No modo OAuth o envio é pela **Gmail API** (`users.messages.send`): access token obtido do refresh token (cache em memória), MIME montado pelo `MailComposer` do nodemailer. Fluxo OAuth no painel; callback autenticado por **`state` assinado** (cookies são `SameSite=Strict`, não chegam no cross-site). `client_secret` e `refresh_token` cifrados (CryptoService, US-15).

**Tech Stack:** Express 5 · nodemailer (já presente; `MailComposer` + SMTP) · Gmail API via `fetch` · Zod · React + TS. Spec: `docs/superpowers/specs/2026-06-17-email-oauth-gmail-design.md`.

**Convenção de verificação (projeto SEM testes automatizados):** cada tarefa fecha com `npm run build` (Vite + `tsc -p tsconfig.server.json`) e, no frontend, `npx tsc -p tsconfig.json --noEmit`, mais verificação manual quando há comportamento. Commits frequentes. Lembretes: ESM no backend usa sufixo `.js` nos imports internos; schemas Zod duplicados client/server em sincronia; só o kit de UI no painel.

---

## Mapa de arquivos
**Backend (novos):** `server/core/security/oauth-state.ts`, `server/lib/gmail.ts`.
**Backend (modificados):** `server/lib/mail.ts`, `server/modules/settings/dto/email-settings.dto.ts`, `server/modules/settings/settings.service.ts`, `server/modules/settings/settings.controller.ts`, `server/modules/settings/settings.routes.ts`, `server/container.ts`.
**Frontend (modificados):** `src/schemas/settings.ts`, `src/painel/pages/Configuracoes.tsx`.
**Docs:** `CLAUDE.md` / `docs/historias` (nota), `.env.example` (sem var nova — client no painel).

---

## Task 1: Helper de `state` assinado (anti-CSRF/replay do callback)

**Files:** Create `server/core/security/oauth-state.ts`

- [ ] **Step 1: Implementar sign/verify com userId+iat+nonce**

```ts
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { config } from '../config.js'

export interface OAuthStatePayload { userId: string; iat: number; nonce: string }
const MAX_AGE_MS = 10 * 60 * 1000 // 10 min

function sign(data: string): string {
  return createHmac('sha256', config.csrfSecret).update(data).digest('base64url')
}

/** Gera um state assinado embutindo o admin que iniciou o fluxo. */
export function issueOAuthState(userId: string): string {
  const payload: OAuthStatePayload = { userId, iat: Date.now(), nonce: randomBytes(9).toString('base64url') }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${data}.${sign(data)}`
}

/** Valida assinatura + expiração. Retorna o payload (com userId) ou null. */
export function verifyOAuthState(state: string | undefined): OAuthStatePayload | null {
  if (!state) return null
  const dot = state.lastIndexOf('.')
  if (dot < 0) return null
  const data = state.slice(0, dot)
  const sig = state.slice(dot + 1)
  const a = Buffer.from(sig)
  const b = Buffer.from(sign(data))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let payload: OAuthStatePayload
  try { payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) } catch { return null }
  if (typeof payload?.userId !== 'string' || typeof payload?.iat !== 'number') return null
  if (Date.now() - payload.iat > MAX_AGE_MS) return null
  return payload
}
```

- [ ] **Step 2: Build** → `npm run build` passa.
- [ ] **Step 3: Smoke test rápido**

Run: `npx tsx -e "import {issueOAuthState,verifyOAuthState} from './server/core/security/oauth-state.ts'; const s=issueOAuthState('u1'); console.log(verifyOAuthState(s)); console.log(verifyOAuthState(s+'x'))"`
Expected: 1º imprime `{ userId: 'u1', iat, nonce }`; 2º imprime `null`.

- [ ] **Step 4: Commit** — `feat(email-oauth): helper de state assinado para o fluxo OAuth`

---

## Task 2: Cliente Google (`server/lib/gmail.ts`) — tokens + envio Gmail API

**Files:** Create `server/lib/gmail.ts`

- [ ] **Step 1: Implementar token exchange, refresh (com cache), userinfo e envio**

```ts
// MailComposer não tem tipos no caminho profundo; import default funciona (CJS, sem exports map).
// @ts-expect-error - sem .d.ts para o subcaminho
import MailComposer from 'nodemailer/lib/mail-composer/index.js'
import type Mail from 'nodemailer/lib/mailer/index.js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'

export interface GmailOAuthCreds { clientId: string; clientSecret: string; refreshToken: string }

// Cache de access token por refresh token (respeita expires_in, com folga de 60s).
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

export async function getAccessToken(c: GmailOAuthCreds): Promise<string> {
  const cached = tokenCache.get(c.refreshToken)
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.clientId, client_secret: c.clientSecret,
      refresh_token: c.refreshToken, grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Falha ao renovar o token do Google (HTTP ${res.status}).`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache.set(c.refreshToken, { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 })
  return data.access_token
}

/** Envia uma mensagem pela Gmail API. From é SEMPRE o `sender` (conta conectada). */
export async function sendViaGmailApi(sender: string, creds: GmailOAuthCreds, message: Mail.Options): Promise<void> {
  const accessToken = await getAccessToken(creds)
  const raw: Buffer = await new MailComposer({ ...message, from: sender }).compile().build()
  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw: raw.toString('base64url') }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gmail API HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
}

/** Fluxo OAuth: troca o code por tokens (precisa do refresh_token na 1ª autorização). */
export async function exchangeCodeForTokens(p: {
  code: string; clientId: string; clientSecret: string; redirectUri: string
}): Promise<{ refreshToken: string | null; accessToken: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: p.code, client_id: p.clientId, client_secret: p.clientSecret,
      redirect_uri: p.redirectUri, grant_type: 'authorization_code',
    }),
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

- [ ] **Step 2: Build** → confirmar que o import do `MailComposer` compila (o `@ts-expect-error` cobre a falta de tipos; se o `tsc` reclamar de "unused @ts-expect-error", trocar por `@ts-ignore`). `npm run build` passa.
- [ ] **Step 3: Commit** — `feat(email-oauth): cliente Gmail API (tokens, envio, userinfo)`

---

## Task 3: `ResolvedEmailConfig` como união + ramificação no envio

**Files:** Modify `server/lib/mail.ts`

- [ ] **Step 1: Tornar `ResolvedEmailConfig` discriminada por `authType`**

Substituir a interface única por:
```ts
export interface SmtpEmailConfig {
  authType: 'smtp'
  host: string; port: number; secure: boolean
  from: string; to: string
  authUser?: string; authPass?: string
}
export interface GmailOAuthEmailConfig {
  authType: 'gmail_oauth2'
  from: string; to: string
  sender: string
  clientId: string; clientSecret: string; refreshToken: string
}
export type ResolvedEmailConfig = SmtpEmailConfig | GmailOAuthEmailConfig
```
`envFallback()` retorna `{ authType: 'smtp', ... }`.

- [ ] **Step 2: Ramificar `sendMailWith` / `sendMail`**

```ts
import { sendViaGmailApi } from './gmail.js'

export async function sendMailWith(cfg: ResolvedEmailConfig, message: Mail.Options): Promise<void> {
  if (cfg.authType === 'gmail_oauth2') {
    await sendViaGmailApi(cfg.sender, { clientId: cfg.clientId, clientSecret: cfg.clientSecret, refreshToken: cfg.refreshToken }, { to: message.to ?? cfg.to, ...message })
    return
  }
  const transporter = buildTransporter(cfg) // inalterado para smtp
  await transporter.sendMail({ from: message.from ?? cfg.from, ...message })
}
```
`buildTransporter` só recebe `SmtpEmailConfig` (ajustar o tipo do parâmetro). `sendMail` (que usa `resolveEmailConfig`) continua chamando `sendMailWith`.

- [ ] **Step 3: Build** → `npm run build` passa (vai acusar onde `ResolvedEmailConfig` era construída — corrigido na Task 5).
- [ ] **Step 4: Commit** — `feat(email-oauth): ResolvedEmailConfig discriminada (smtp | gmail_oauth2)`

---

## Task 4: DTOs (server)

**Files:** Modify `server/modules/settings/dto/email-settings.dto.ts`

- [ ] **Step 1: Adicionar `authType` e o DTO do client OAuth**

```ts
export const emailSettingsDto = z.object({
  authType: z.enum(['smtp', 'gmail_oauth2']).default('smtp'),
  host: z.string().min(1, 'Informe o host SMTP.'),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  from: z.email('Remetente inválido.'),
  to: z.email('Destinatário inválido.'),
  authUser: z.string().optional().default(''),
  password: z.string().optional(),
})

export const oauthClientDto = z.object({
  clientId: z.string().min(1, 'Informe o Client ID.'),
  clientSecret: z.string().optional(), // write-only: em branco preserva o salvo
})
export type OAuthClientInput = z.infer<typeof oauthClientDto>
```
> Nota: no modo `gmail_oauth2` o `host` ainda é exigido pelo schema; como o form OAuth não mostra host, o frontend manda o host salvo/placeholder (ex.: mantém o valor atual ou `smtp.gmail.com`). Alternativa: tornar `host` opcional quando `authType==='gmail_oauth2'` via `superRefine`. **Decisão:** usar `superRefine` para exigir host só quando `authType==='smtp'`.

Implementar o `superRefine`:
```ts
.superRefine((v, ctx) => {
  if (v.authType === 'smtp' && !v.host) ctx.addIssue({ code: 'custom', path: ['host'], message: 'Informe o host SMTP.' })
})
```
(remover o `.min(1)` obrigatório de `host` e validar via refine.)

- [ ] **Step 2: Build** → passa.
- [ ] **Step 3: Commit** — `feat(email-oauth): DTOs (authType + client OAuth)`

---

## Task 5: Settings service — resolução, persistência e fluxo OAuth

**Files:** Modify `server/modules/settings/settings.service.ts`

Chaves novas: `EMAIL_OAUTH_KEY='email.oauth'` (`{ clientId, senderEmail }`), `EMAIL_OAUTH_SECRET_KEY='email.oauth_client_secret'` (cifrado), `EMAIL_OAUTH_REFRESH_KEY='email.oauth_refresh_token'` (cifrado).

- [ ] **Step 1: Estado + tipos**
- `StoredEmail` ganha `authType?: 'smtp' | 'gmail_oauth2'` (default `smtp`).
- `PublicEmailSettings` ganha `authType` e `oauth: { clientId: string; senderEmail: string; connected: boolean; hasClientSecret: boolean }`.
- Construtor recebe `publicBaseUrl: string` (injetado no container) para montar o redirect URI/authorize.

- [ ] **Step 2: `getEmailSettings` e `getConfigForSending`**
- `getEmailSettings`: inclui `authType` e monta `oauth` (clientId/senderEmail de `email.oauth`; `hasClientSecret` = existe `email.oauth_client_secret`; `connected` = existe `email.oauth_refresh_token` **e** `senderEmail`). **Nunca** retorna secret/refresh token.
- `getConfigForSending`: se `authType==='gmail_oauth2'` → decifra client_secret + refresh_token; se faltar refresh token, **`throw new BadRequestError('Conta Google não conectada.')`**; senão retorna `{ authType:'gmail_oauth2', from: senderEmail, to, sender: senderEmail, clientId, clientSecret, refreshToken }`. Caso contrário, ramo SMTP atual (`{ authType:'smtp', ... }`).

- [ ] **Step 3: `updateEmailSettings`** — persiste `authType` junto do `StoredEmail` (mantém a lógica de senha SMTP).

- [ ] **Step 4: Métodos OAuth**
```ts
private redirectUri() { return `${this.publicBaseUrl}/api/admin/settings/email/oauth/callback` }

async updateOAuthClient(input: OAuthClientInput, updatedBy: string | null) {
  const cur = (await this.settings.get<{clientId:string;senderEmail:string}>(EMAIL_OAUTH_KEY)) ?? { clientId:'', senderEmail:'' }
  await withTransaction(async (tx) => {
    await this.settings.upsert(EMAIL_OAUTH_KEY, { ...cur, clientId: input.clientId }, updatedBy, tx)
    if (input.clientSecret) await this.settings.upsert(EMAIL_OAUTH_SECRET_KEY, this.crypto.encrypt(input.clientSecret), updatedBy, tx)
  })
  return this.getEmailSettings()
}

async buildAuthorizeUrl(userId: string): Promise<string> {
  const oauth = await this.settings.get<{clientId:string}>(EMAIL_OAUTH_KEY)
  if (!oauth?.clientId) throw new BadRequestError('Configure o Client ID antes de conectar.')
  const p = new URLSearchParams({
    client_id: oauth.clientId, redirect_uri: this.redirectUri(),
    response_type: 'code', scope: GMAIL_SEND_SCOPE, access_type: 'offline',
    prompt: 'consent', include_granted_scopes: 'true', state: issueOAuthState(userId),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`
}

async handleOAuthCallback(code: string, state: string): Promise<void> {
  const payload = verifyOAuthState(state)
  if (!payload) throw new BadRequestError('State OAuth inválido ou expirado.')
  const oauth = await this.settings.get<{clientId:string;senderEmail:string}>(EMAIL_OAUTH_KEY)
  const encSecret = await this.settings.get<EncryptedValue>(EMAIL_OAUTH_SECRET_KEY)
  if (!oauth?.clientId || !encSecret) throw new BadRequestError('Client OAuth não configurado.')
  const clientSecret = this.crypto.decrypt(encSecret)
  const { refreshToken, accessToken } = await exchangeCodeForTokens({ code, clientId: oauth.clientId, clientSecret, redirectUri: this.redirectUri() })
  if (!refreshToken) throw new BadRequestError('Google não retornou refresh token (revogue o acesso anterior e reconecte com prompt=consent).')
  const email = await fetchGoogleEmail(accessToken)
  await withTransaction(async (tx) => {
    await this.settings.upsert(EMAIL_OAUTH_KEY, { ...oauth, senderEmail: email }, payload.userId, tx)
    await this.settings.upsert(EMAIL_OAUTH_REFRESH_KEY, this.crypto.encrypt(refreshToken), payload.userId, tx)
  })
}

async disconnectOAuth(updatedBy: string | null) {
  const oauth = await this.settings.get<{clientId:string;senderEmail:string}>(EMAIL_OAUTH_KEY)
  await withTransaction(async (tx) => {
    await this.settings.upsert(EMAIL_OAUTH_REFRESH_KEY, null, updatedBy, tx) // ou delete; ver repo
    if (oauth) await this.settings.upsert(EMAIL_OAUTH_KEY, { ...oauth, senderEmail: '' }, updatedBy, tx)
  })
  return this.getEmailSettings()
}
```
> Se o `SettingsRepository` não tiver `delete`, gravar `null`/`{}` e tratar como "ausente" no `get` (ajuste pequeno no repo: aceitar remoção, ou em `getConfigForSending` tratar valor falsy como não-conectado). Decisão: tratar valor ausente/falsy como desconectado (sem mudar o repo).

- [ ] **Step 5: `sendTestEmail`** — mover a chamada `getConfigForSending()` para **dentro** do `try` (hoje está antes), para o erro "Conta Google não conectada" virar `{ ok:false, reason }` amigável.

- [ ] **Step 6: Imports** — `BadRequestError` (core/errors), `issueOAuthState`/`verifyOAuthState`, `exchangeCodeForTokens`/`fetchGoogleEmail`/`GMAIL_SEND_SCOPE` (lib/gmail), `EncryptedValue`.

- [ ] **Step 7: Build** → `npm run build` passa.
- [ ] **Step 8: Commit** — `feat(email-oauth): settings service (resolução + fluxo OAuth + desconectar)`

---

## Task 6: Controller + rotas

**Files:** Modify `server/modules/settings/settings.controller.ts`, `server/modules/settings/settings.routes.ts`

- [ ] **Step 1: Controller** — métodos:
  - `putOAuthClient` (valida `oauthClientDto`, chama `updateOAuthClient`, devolve `{ email }`).
  - `authorize` — `res.json({ url: await service.buildAuthorizeUrl(req.user!.id) })` (frontend redireciona). [Alternativa 302; JSON é mais simples no fetch autenticado.]
  - `oauthCallback` — `const { code, state } = req.query`; em sucesso `res.redirect('/painel/configuracoes?oauth=ok')`; em erro (try/catch) `res.redirect('/painel/configuracoes?oauth=erro')`. **Não** usa `req.user`.
  - `disconnectOAuth` — chama service, devolve `{ email }`.

- [ ] **Step 2: Rotas** (em `makeSettingsRoutes`, sob `/api/admin`, perm `settings:manage`)
```ts
r.put('/settings/email/oauth/client', wrap(requireAuth), perm, requireCsrf, wrap(controller.putOAuthClient))
r.get('/settings/email/oauth/authorize', wrap(requireAuth), perm, wrap(controller.authorize))
r.get('/settings/email/oauth/callback', wrap(controller.oauthCallback)) // SEM requireAuth (state autentica)
r.post('/settings/email/oauth/disconnect', wrap(requireAuth), perm, requireCsrf, wrap(controller.disconnectOAuth))
```

- [ ] **Step 3: Build** → passa.
- [ ] **Step 4: Commit** — `feat(email-oauth): controller + rotas OAuth (callback via state)`

---

## Task 7: Wiring no container

**Files:** Modify `server/container.ts`

- [ ] **Step 1: Injetar `publicBaseUrl` no `SettingsService`**
`new SettingsService(settingsRepo, cryptoService, config.publicBaseUrl)`. As novas rotas já saem de `makeSettingsRoutes` (mesma exportação `settingsRoutes`). O provider `setEmailConfigProvider(() => settingsService.getConfigForSending())` continua igual (agora cobre os dois modos).

- [ ] **Step 2: Verificação manual do ciclo (sem Google real ainda)**
Subir o server. `GET /api/admin/settings/email` (com cookie admin) deve trazer `authType` e `oauth:{clientId:'',senderEmail:'',connected:false,hasClientSecret:false}`. `PUT .../oauth/client` salva clientId. `GET .../authorize` retorna uma URL de `accounts.google.com` com `redirect_uri`, `scope=gmail.send`, `state`. (A troca real exige a conta — feita na verificação final.)

- [ ] **Step 3: Commit** — `feat(email-oauth): wiring do SettingsService (publicBaseUrl) e rotas`

---

## Task 8: Schema client (sincronia)

**Files:** Modify `src/schemas/settings.ts`

- [ ] **Step 1: Adicionar `authType`** ao `emailSettingsSchema`:
```ts
authType: z.enum(['smtp', 'gmail_oauth2']).default('smtp'),
```
(Os campos do client OAuth — clientId/clientSecret — **não** entram aqui; vão por chamadas `adminFetch` dedicadas na tela.)

- [ ] **Step 2: tsc front** → `npx tsc -p tsconfig.json --noEmit` passa.
- [ ] **Step 3: Commit** — `feat(email-oauth): authType no schema client de settings`

---

## Task 9: Tela `/painel/configuracoes`

**Files:** Modify `src/painel/pages/Configuracoes.tsx`

- [ ] **Step 1: Seletor de tipo + estado**
- Adicionar campo controlado **"Tipo de autenticação"** (`smtp` | `gmail_oauth2`) ligado ao form (`authType`).
- Carregar `authType` + `oauth` do `GET /settings/email` (estende o tipo da resposta).

- [ ] **Step 2: UI do modo SMTP** — inalterada (host/porta/secure/usuário/senha), exibida quando `authType==='smtp'`.

- [ ] **Step 3: UI do modo Gmail OAuth2** (quando `authType==='gmail_oauth2'`):
  - Campos **Client ID** e **Client Secret** (secret write-only; placeholder "•••• salvo" se `oauth.hasClientSecret`) com botão **"Salvar credenciais"** → `adminFetch('/settings/email/oauth/client', { method:'PUT', body: JSON.stringify({clientId, clientSecret}) })`.
  - **Redirect URI** read-only com botão copiar = `${window.location.origin}/api/admin/settings/email/oauth/callback` (mostra o valor a registrar no Google Cloud) + instrução.
  - **"Conectar conta Google"** (habilitado só se `oauth.clientId` salvo) → `const { url } = await adminFetch('/settings/email/oauth/authorize').then(r=>r.json()); window.location.href = url`.
  - **Status**: se `oauth.connected` → "Conectado como `oauth.senderEmail`" + botão **"Desconectar"** (`POST .../oauth/disconnect`); senão "Não conectado".
  - **Sem campo `from`** neste modo: mostrar "Enviando como: `oauth.senderEmail`" quando conectado. `to` (teste) segue.
  - Aviso curto: "Publique o app no Google Cloud (produção) para o acesso não expirar em 7 dias."

- [ ] **Step 4: Retorno do Google** — ler `?oauth=ok|erro` (via `useSearchParams`/`location.search`), exibir `Alert` de sucesso/erro e recarregar o `GET /settings/email`.

- [ ] **Step 5: Salvar/Teste** — o submit do form manda `authType` junto; "Enviar e-mail de teste" funciona nos dois modos (já usa `getConfigForSending`).

- [ ] **Step 6: tsc front + verificação visual** — alternar o seletor mostra/esconde os blocos certos; campos OAuth e botões aparecem; tudo com o kit de UI.
- [ ] **Step 7: Commit** — `feat(email-oauth): tela de configuração com modo Gmail OAuth2`

---

## Task 10: Verificação fim-a-fim (com a conta real) + docs + PR

- [ ] **Step 1: Setup Google Cloud** (usuário) — Gmail API ativada, consent screen Externo + `gmail.send` + conta como test user, **Client OAuth (Web)** com redirect URI = `${PUBLIC_BASE_URL}/api/admin/settings/email/oauth/callback`, app **publicado** (produção). `PUBLIC_BASE_URL` setado (absoluto) no ambiente.
- [ ] **Step 2: Verificação manual** — no painel: selecionar Gmail OAuth2, salvar client_id/secret, "Conectar conta Google" → consent → volta "Conectado como…". "Enviar e-mail de teste" chega na caixa real. Desconectar/reconectar. SMTP/Mailpit e `/api/contato` seguem ok. `GET /settings/email` nunca expõe secret/refresh token.
- [ ] **Step 3: Docs** — nota no `CLAUDE.md` (modo de e-mail OAuth + setup Google) e, se fizer sentido, um `docs/` curto com o passo a passo do Google Cloud.
- [ ] **Step 4: Review + PR** — superpowers:requesting-code-review no diff; endereçar; superpowers:finishing-a-development-branch → PR `feat/email-oauth-gmail` → master.

---

## Resumo de segurança (revisado no spec)
- `client_secret` e `refresh_token` **cifrados** (CryptoService); nunca retornados ao cliente.
- Callback **sem `requireAuth`** (cookies `SameSite=Strict`), autenticado por **`state` assinado** com `iat`(≤10min)+nonce.
- Escopo mínimo `gmail.send`; `From` sempre = conta conectada.
- `settings:manage` + `requireCsrf` nas mutações; redirect URI fixo (bate com o Google Cloud); exige `PUBLIC_BASE_URL` absoluto (inclusive p/ testar OAuth em dev).
