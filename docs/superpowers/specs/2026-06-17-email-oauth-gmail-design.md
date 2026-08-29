# Spec — Configuração de e-mail via OAuth2 (Gmail API) no painel

- **Data:** 2026-06-17
- **Branch:** `feat/email-oauth-gmail`
- **Relacionado:** US-14 (Tela de configurações — e-mail do sistema), US-15 (Criptografia de segredos)
- **Referência de arquitetura:** `CLAUDE.md` → *Backend — Área Administrativa, Autenticação e RBAC*
- **Referência visual:** `docs/patterns/area-administrativa-visual.md`

---

## 1. Objetivo e contexto

Hoje a configuração de e-mail do painel (`/painel/configuracoes`, US-14) só suporta **SMTP com usuário/senha**. A igreja vai enviar a partir de uma conta **Gmail**, e o Gmail **removeu o login por senha simples** (2022): só funciona com **App Password** ou **OAuth2**. O objetivo é permitir **autenticar via OAuth2** no painel — sem armazenar senha — para enviar pela conta Gmail.

Escolhemos enviar pela **Gmail API** com o escopo **`https://www.googleapis.com/auth/gmail.send`** (menor privilégio — só enviar), e **não** por SMTP/XOAUTH2 (que exigiria o escopo amplo `https://mail.google.com/`). O modo **SMTP por senha continua existindo** (necessário para o **Mailpit** em dev e para o formulário público de contato).

## 2. Escopo

### Dentro do escopo
- Novo campo **`authType: 'smtp' | 'gmail_oauth2'`** na configuração de e-mail.
- Modo **`gmail_oauth2`**: enviar pela **Gmail API** usando OAuth2 (refresh token), com fluxo de conexão no painel ("Conectar conta Google" → consentimento → callback).
- `client_id`/`client_secret` em **variáveis de ambiente** (`GOOGLE_OAUTH_CLIENT_ID`/`SECRET`); refresh token cifrado no banco.
- Status de conexão ("Conectado como …"), desconectar, e o **e-mail de teste** funcionando nos dois modos.

### Fora do escopo
- App Password (não é OAuth; o modo SMTP atual já aceita uma App Password como senha, sem mudança).
- Service account / delegação de domínio (Workspace) — não se aplica a @gmail.com pessoal.
- Verificação/publicação do app OAuth no Google (ação do usuário no Google Cloud, documentada).

## 3. Decisões de design (confirmadas no brainstorming)

1. **Gmail API + `gmail.send`** (não SMTP) para o modo OAuth — menor privilégio e verificação mais leve que `mail.google.com`.
2. **Mantém o modo SMTP/senha** ao lado (seletor `authType`); default `smtp` (preserva Mailpit/env/dev e o `/api/contato`).
3. **Fluxo OAuth completo no app** (botão "Conectar conta Google" → consent → callback), não colar refresh token manualmente.
4. **`client_id`/`client_secret` em variáveis de ambiente** (`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`), junto da `YOUTUBE_API_KEY` — **não** vão pro banco nem pro painel. Redirect URI derivado de `PUBLIC_BASE_URL` e exibido na tela para registrar no Google Cloud.
5. **Sem dependência nova:** o `nodemailer` (já presente) traz o `MailComposer` para montar o MIME; a troca/renovação de token e o envio na Gmail API usam `fetch`.

## 4. Modelo de dados (chaves na tabela `settings`)

Reaproveita o padrão key-value + `CryptoService` (US-15), como a senha SMTP atual.

| Chave | Conteúdo | Sensível? |
|---|---|---|
| `email` (existente) | `StoredEmail` **+ novo `authType: 'smtp' \| 'gmail_oauth2'`** (default `smtp`) | não |
| `email.smtp_password` (existente) | senha SMTP cifrada (`EncryptedValue`) | cifrada |
| `email.oauth` (novo) | `{ senderEmail: string }` (conta conectada; vazio se não conectado). O `client_id`/`secret` **vêm do env**, não daqui. | não |
| `email.oauth_refresh_token` (novo) | refresh token cifrado (`EncryptedValue`) | cifrada |

`connected` é **derivado** (existe `oauth_refresh_token` cifrado **e** `senderEmail`). `clientConfigured` é **derivado do env** (`GOOGLE_OAUTH_CLIENT_ID`/`SECRET` presentes). Nada de access token persistido (obtido sob demanda do refresh token). **Tratar envelope cifrado ausente/falsy como "não conectado"** — nunca chamar `decrypt` num valor ausente.

## 5. Backend

### 5.1 Resolução e envio (`server/lib/mail.ts`)
`ResolvedEmailConfig` passa a ser uma **união discriminada** por `authType`:
- `{ authType: 'smtp', host, port, secure, from, to, authUser?, authPass? }` (como hoje).
- `{ authType: 'gmail_oauth2', from, to, sender, clientId, clientSecret, refreshToken }`.

`sendMailWith(cfg, message)` ramifica:
- **smtp** → `nodemailer.createTransport(...)` + `sendMail` (inalterado).
- **gmail_oauth2** → novo `sendViaGmailApi(cfg, message)`:
  1. Obtém **access token** via `POST https://oauth2.googleapis.com/token` (`grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`). **Cache em memória** do access token por chave (refresh token), respeitando o `expires_in` (evita uma chamada ao token endpoint a cada envio).
  2. Monta o MIME com **`MailComposer`** (`nodemailer/lib/mail-composer/index.js` — sem dep nova). O **`From` é SEMPRE `cfg.sender`** (a conta conectada); `message.from`/`cfg.from` são **ignorados** no modo OAuth, porque o Gmail força o remetente para a conta autenticada. Inclui `to`, `subject`, `html`.
  3. `base64url` do MIME → `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` com `Authorization: Bearer <accessToken>` e `{ raw }`.
  4. Erros (token/HTTP) lançam para o chamador (que já trata em `sendTestEmail` e nas rotas).

Função pura/isolada nova: `server/lib/gmail.ts` (`getAccessToken`, `sendViaGmailApi`) — mantém `mail.ts` enxuto e o I/O do Google isolado.

### 5.2 Settings service (`settings.service.ts`)
- `resolveBaseEmail`/`getEmailSettings` incluem `authType`.
- `resolveBaseEmail`/`getEmailSettings`/`updateEmailSettings` incluem `authType` (o `StoredEmail` ganha `authType`; `updateEmailSettings` grava `authType: input.authType`).
- `getConfigForSending()` ramifica por `authType`: se `gmail_oauth2`, **lê `client_id`/`client_secret` do env** e o refresh token cifrado do banco. **Guarda antes de decifrar:** se o envelope do refresh token estiver ausente/falsy **ou** o env não tiver client_id/secret, lança `BadRequestError('Conta Google não conectada.')` (nunca chama `decrypt` em valor ausente). Senão, decifra o refresh token e monta `{ authType:'gmail_oauth2', from: senderEmail, to, sender: senderEmail, clientId, clientSecret, refreshToken }`. Caso `smtp`: comportamento atual.
- `sendTestEmail` chama `getConfigForSending` **dentro** do try/catch (hoje está antes — mover pra dentro), pra "não conectado" virar `{ ok:false, reason }` amigável. `/api/contato` já trata falha sem derrubar a resposta.
- `PublicEmailSettings` ganha `authType` e `oauth: { senderEmail, connected, clientConfigured }` (**nunca** devolve secret/refresh token; sem `clientId` — ele vem do env).
- Novos métodos:
  - `buildAuthorizeUrl(userId)` — usa o `client_id` **do env** (erro claro se ausente); monta a URL de consentimento (`scope=gmail.send`, `access_type=offline`, `prompt=consent`, `redirect_uri`, `state` assinado).
  - `handleOAuthCallback(code, state)` — valida `state` (assinatura + `iat`), **extrai `userId` do state** (não de `req.user`); usa `client_id`/`secret` **do env** para trocar `code`→tokens; busca o e-mail via `userinfo`; cifra e salva `refresh_token` + grava `senderEmail`.
  - `disconnectOAuth(updatedBy)` — remove o `oauth_refresh_token` (grava valor ausente) e zera `senderEmail`.

### 5.3 State / autenticação do callback (`server/core/security/`)
**Os cookies de auth são `SameSite=Strict`** (`auth.cookies.ts`). O callback chega como **navegação cross-site** vinda de `accounts.google.com`, então o browser **NÃO envia** os cookies `access_token`/`csrf_token` — `requireAuth` daria 401 em **todo** callback. Portanto:

- O **callback NÃO usa `requireAuth`**. A autenticação dele é o próprio **`state` assinado**, gerado pelo endpoint `authorize` (esse sim autenticado).
- `state` = payload `{ userId, iat (timestamp), nonce aleatório }` assinado por **HMAC** (helper análogo ao `core/security/csrf.ts`, usando um segredo do servidor). No callback valida-se: **assinatura íntegra** + **`iat` dentro de ~10 min** (rejeita replay antigo). O `userId` usado como `updatedBy` vem **do state validado** (não de `req.user`).
- O `authorize` (que gera o state) **mantém** `requireAuth` + `settings:manage` — é uma chamada same-site do próprio painel, então os cookies vão normalmente.
- Redirect URI fixo = `${PUBLIC_BASE_URL}/api/admin/settings/email/oauth/callback` (precisa bater com o registrado no Google Cloud; **exige `PUBLIC_BASE_URL` absoluto, inclusive em dev** para testar).

### 5.4 Rotas (`settings.routes.ts`, sob `/api/admin`, perm `settings:manage`)
| Método | Rota | CSRF | Descrição |
|---|---|---|---|
| `GET` | `/settings/email/oauth/authorize` | — | Responde a URL de consentimento (frontend redireciona). |
| `GET` | `/settings/email/oauth/callback` | — | **Sem `requireAuth`** (cookies SameSite=Strict não chegam no cross-site). Autenticado pelo `state` assinado; troca code→tokens, salva, **redireciona** para `/painel/configuracoes?oauth=ok\|erro`. |
| `POST` | `/settings/email/oauth/disconnect` | sim | Desconecta (apaga refresh token). |

`authorize`/`disconnect` usam `requireAuth` + `settings:manage` (disconnect também `requireCsrf`). O **callback é a exceção**: validado só pelo `state` (ver §5.3). O `PUT /settings/email` existente passa a aceitar `authType`. (Não há rota de client OAuth — credenciais vêm do env.)

### 5.5 DTOs (`dto/email-settings.dto.ts`) + env
- `emailSettingsDto` ganha `authType: z.enum(['smtp','gmail_oauth2']).default('smtp')`. O `host` deixa de ser sempre obrigatório: via `superRefine`, exigido **só quando `authType==='smtp'`** (no modo OAuth não há host). **O schema client (`src/schemas/settings.ts`) replica o mesmo `superRefine`** para não divergir (senão o form trava no host vazio em modo OAuth).
- **Config/env:** `server/core/config.ts` ganha `googleOauthClientId`/`googleOauthClientSecret` (de `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`). Documentar em `.env.example`, `deploy.sh` e `update.sh` (como a `YOUTUBE_API_KEY`). Sem dependência/rota nova para credenciais.

## 6. Frontend (`src/painel/pages/Configuracoes.tsx`)

- Seletor **"Tipo de autenticação"**: *SMTP (senha/App Password)* | *Gmail (OAuth2)*.
- **SMTP**: campos atuais (host/porta/secure/usuário/senha) — inalterado.
- **Gmail (OAuth2)**:
  - O **`from` NÃO é editável** neste modo (remetente = conta conectada): mostrar "Enviando como: `senderEmail`" quando conectado. `to` (destino do teste) segue editável.
  - **Sem campos de client_id/secret** (ficam no env). Se `oauth.clientConfigured === false`, mostrar aviso "Defina `GOOGLE_OAUTH_CLIENT_ID/SECRET` no servidor" e **desabilitar** o botão Conectar.
  - **Redirect URI** exibido (read-only, com botão copiar) = `${window.location.origin}/api/admin/settings/email/oauth/callback`, com instrução de registrar no Google Cloud.
  - Botão **"Conectar conta Google"** (habilitado quando `clientConfigured`) → `GET .../authorize` → `window.location.href = url`.
  - **Status**: "Conectado como `senderEmail`" + **"Desconectar"**, ou "Não conectado".
  - Aviso curto: publicar o app no Google Cloud (produção) para o token não expirar em 7 dias.
  - Ao voltar do Google (`?oauth=ok|erro`), exibe `Alert` e recarrega `GET /settings/email`.
- **"Enviar e-mail de teste"** (existente) funciona nos dois modos (usa `getConfigForSending`).
- Tudo com o kit de UI (`src/painel/ui/`).
- **Schema client em sincronia:** adicionar `authType` ao `src/schemas/settings.ts` **e** o mesmo `superRefine` do host (obrigatório só em `smtp`). Não há campos de client OAuth no form.

## 7. Segurança
- `refresh_token` **cifrado em repouso** (CryptoService, US-15); nunca retornado ao cliente. `client_id`/`client_secret` ficam **só no env** (não no banco/painel/respostas).
- `state` assinado (HMAC) e validado por **assinatura + expiração (`iat` ≤ ~10 min) + nonce** → anti-CSRF/replay no callback (que não depende de cookie/sessão).
- Escopo mínimo **`gmail.send`** (só enviar).
- Mutações (`disconnect`) com `requireCsrf`; rotas sob `settings:manage` (exceto o callback, validado pelo `state`).
- `redirect_uri` fixo e derivado de `PUBLIC_BASE_URL` (precisa bater com o registrado no Google Cloud).

## 8. Configuração no Google Cloud + env (ação do usuário — documentar)
Criar projeto → ativar **Gmail API** → tela de consentimento **Externo** + escopo `gmail.send` + conta como usuário de teste → credencial **ID do cliente OAuth (Aplicativo da Web)** com o redirect URI = `${PUBLIC_BASE_URL}/api/admin/settings/email/oauth/callback` → **publicar o app** (produção) p/ o refresh token não expirar (clicar no aviso de "app não verificado"). Depois, no `.env.local`: `GOOGLE_OAUTH_CLIENT_ID=…`, `GOOGLE_OAUTH_CLIENT_SECRET=…`, e `PUBLIC_BASE_URL` absoluto.

## 9. Verificação manual (sem suíte de testes — convenção do projeto)
- Com `GOOGLE_OAUTH_CLIENT_ID/SECRET` no env: selecionar "Gmail (OAuth2)", "Conectar conta Google" → consent → volta "Conectado como …".
- "Enviar e-mail de teste" entrega pela Gmail API (chega na caixa real).
- Desconectar zera o status; reconectar funciona.
- Modo SMTP (Mailpit em dev) continua funcionando; formulário público (`/api/contato`) continua enviando.
- Refresh token nunca aparece em respostas da API (`GET /settings/email`); `client_id`/secret só no env.
- **Sem o env configurado**, o botão "Conectar" fica desabilitado com aviso.

## 10. Definição de pronto
- [ ] `authType` (`smtp`/`gmail_oauth2`) salvo e respeitado no envio.
- [ ] Fluxo OAuth completo (authorize → consent → callback) salvando refresh token cifrado + e-mail da conta.
- [ ] Envio em modo OAuth via **Gmail API** (`gmail.send`), MIME pelo MailComposer.
- [ ] `client_id`/`client_secret` no **env** (`GOOGLE_OAUTH_*`); redirect URI exibido; botão Conectar depende do env.
- [ ] Status conectar/desconectar; e-mail de teste nos dois modos.
- [ ] SMTP/Mailpit e `/api/contato` intactos; refresh token cifrado e nunca exposto; `state` assinado; `settings:manage` + CSRF.
