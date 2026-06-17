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
- `client_id`/`client_secret` configurados **no painel** (secret cifrado); refresh token cifrado.
- Status de conexão ("Conectado como …"), desconectar, e o **e-mail de teste** funcionando nos dois modos.

### Fora do escopo
- App Password (não é OAuth; o modo SMTP atual já aceita uma App Password como senha, sem mudança).
- Service account / delegação de domínio (Workspace) — não se aplica a @gmail.com pessoal.
- Verificação/publicação do app OAuth no Google (ação do usuário no Google Cloud, documentada).

## 3. Decisões de design (confirmadas no brainstorming)

1. **Gmail API + `gmail.send`** (não SMTP) para o modo OAuth — menor privilégio e verificação mais leve que `mail.google.com`.
2. **Mantém o modo SMTP/senha** ao lado (seletor `authType`); default `smtp` (preserva Mailpit/env/dev e o `/api/contato`).
3. **Fluxo OAuth completo no app** (botão "Conectar conta Google" → consent → callback), não colar refresh token manualmente.
4. **`client_id`/`client_secret` no painel** (self-service); `client_secret` cifrado como a senha SMTP. Redirect URI derivado de `PUBLIC_BASE_URL` e exibido na tela para registrar no Google Cloud.
5. **Sem dependência nova:** o `nodemailer` (já presente) traz o `MailComposer` para montar o MIME; a troca/renovação de token e o envio na Gmail API usam `fetch`.

## 4. Modelo de dados (chaves na tabela `settings`)

Reaproveita o padrão key-value + `CryptoService` (US-15), como a senha SMTP atual.

| Chave | Conteúdo | Sensível? |
|---|---|---|
| `email` (existente) | `StoredEmail` **+ novo `authType: 'smtp' \| 'gmail_oauth2'`** (default `smtp`) | não |
| `email.smtp_password` (existente) | senha SMTP cifrada (`EncryptedValue`) | cifrada |
| `email.oauth` (novo) | `{ clientId: string, senderEmail: string }` (`senderEmail` = conta conectada; vazio se não conectado) | não |
| `email.oauth_client_secret` (novo) | `client_secret` cifrado (`EncryptedValue`) | cifrada |
| `email.oauth_refresh_token` (novo) | refresh token cifrado (`EncryptedValue`) | cifrada |

`connected` é **derivado** (existe `oauth_refresh_token` + `senderEmail`). Nada de access token persistido (é obtido sob demanda a partir do refresh token).

## 5. Backend

### 5.1 Resolução e envio (`server/lib/mail.ts`)
`ResolvedEmailConfig` passa a ser uma **união discriminada** por `authType`:
- `{ authType: 'smtp', host, port, secure, from, to, authUser?, authPass? }` (como hoje).
- `{ authType: 'gmail_oauth2', from, to, sender, clientId, clientSecret, refreshToken }`.

`sendMailWith(cfg, message)` ramifica:
- **smtp** → `nodemailer.createTransport(...)` + `sendMail` (inalterado).
- **gmail_oauth2** → novo `sendViaGmailApi(cfg, message)`:
  1. Obtém **access token** via `POST https://oauth2.googleapis.com/token` (`grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`).
  2. Monta o MIME com **`MailComposer`** (do nodemailer) — `from = cfg.sender` (o Gmail exige From = conta autenticada), `to`, `subject`, `html`.
  3. `base64url` do MIME → `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` com `Authorization: Bearer <accessToken>` e `{ raw }`.
  4. Erros (token/HTTP) lançam para o chamador (que já trata em `sendTestEmail` e nas rotas).

Função pura/isolada nova: `server/lib/gmail.ts` (`getAccessToken`, `sendViaGmailApi`) — mantém `mail.ts` enxuto e o I/O do Google isolado.

### 5.2 Settings service (`settings.service.ts`)
- `resolveBaseEmail`/`getEmailSettings` incluem `authType`.
- `getConfigForSending()` ramifica por `authType`: se `gmail_oauth2`, decifra `client_secret` + `refresh_token`, monta a `ResolvedEmailConfig` OAuth (sender = `email.oauth.senderEmail`); senão, comportamento atual (SMTP).
- `PublicEmailSettings` ganha `authType`, `oauth: { clientId, senderEmail, connected, hasClientSecret }` (nunca devolve secret/refresh token).
- Novos métodos:
  - `updateOAuthClient({ clientId, clientSecret? }, updatedBy)` — salva `clientId` em `email.oauth` e cifra `client_secret` (em branco preserva — igual à senha SMTP).
  - `setAuthType(authType, updatedBy)` — atualiza o campo no `email` (ou via o `updateEmailSettings` existente, estendido com `authType`).
  - `buildAuthorizeUrl(userId)` — monta a URL de consentimento (escopo `gmail.send`, `access_type=offline`, `prompt=consent`, `redirect_uri`, `state` assinado).
  - `handleOAuthCallback(code, state, userId)` — valida `state`, troca `code`→tokens, busca o e-mail via `userinfo`, cifra e salva `refresh_token` + `senderEmail`.
  - `disconnectOAuth(updatedBy)` — remove `oauth_refresh_token` e zera `senderEmail`.

### 5.3 State / segurança do fluxo (`server/core/security/`)
`state` = valor aleatório + assinatura HMAC (reusa o padrão de `core/security/csrf.ts`, ou um helper análogo) embutindo o `userId`. No callback: valida assinatura **e** que `req.user.id` bate. Redirect URI fixo = `${PUBLIC_BASE_URL}/api/admin/settings/email/oauth/callback`.

### 5.4 Rotas (`settings.routes.ts`, sob `/api/admin`, perm `settings:manage`)
| Método | Rota | CSRF | Descrição |
|---|---|---|---|
| `PUT` | `/settings/email/oauth/client` | sim | Salva client_id/secret. |
| `GET` | `/settings/email/oauth/authorize` | — | Responde a URL de consentimento (frontend redireciona) ou 302. |
| `GET` | `/settings/email/oauth/callback` | — (protegido por `state`) | Troca code→tokens, salva, **redireciona** para `/painel/configuracoes?oauth=ok\|erro`. |
| `POST` | `/settings/email/oauth/disconnect` | sim | Desconecta (apaga refresh token). |

O `PUT /settings/email` existente passa a aceitar `authType`. As rotas mutantes usam `requireCsrf` (callback é GET, validado por `state`).

> Nota: o `callback` precisa do admin logado (cookie). Se a sessão expirar no meio do fluxo, cai no 401 do `requireAuth` (caso de borda aceitável; o admin acabou de iniciar o fluxo logado).

### 5.5 DTOs (`dto/email-settings.dto.ts`)
- `emailSettingsDto` ganha `authType: z.enum(['smtp','gmail_oauth2']).default('smtp')`.
- Novo `oauthClientDto = { clientId: string.min(1), clientSecret: string.optional() }` (secret write-only).

## 6. Frontend (`src/painel/pages/Configuracoes.tsx`)

- Seletor **"Tipo de autenticação"**: *SMTP (senha/App Password)* | *Gmail (OAuth2)*.
- **SMTP**: campos atuais (host/porta/secure/usuário/senha) — inalterado.
- **Gmail (OAuth2)**:
  - `from`/`to` seguem editáveis (o `from` efetivo de envio é a conta conectada).
  - Campos **Client ID** e **Client Secret** (secret write-only; placeholder "•••• salvo" quando há um).
  - **Redirect URI** exibido (read-only, com botão copiar) = `${PUBLIC_BASE_URL}/api/admin/settings/email/oauth/callback`, com instrução de registrar no Google Cloud.
  - Botão **"Conectar conta Google"** (habilitado só após salvar client_id/secret) → chama `authorize` e redireciona.
  - **Status**: "Conectado como `x@gmail.com`" ou "Não conectado"; botão **"Desconectar"**.
  - Aviso curto: publicar o app no Google Cloud (produção) para o token não expirar em 7 dias.
  - Ao voltar do Google (`?oauth=ok|erro`), exibe `Alert` de sucesso/erro.
- **"Enviar e-mail de teste"** (existente) funciona nos dois modos (usa `getConfigForSending`).
- Tudo com o kit de UI (`src/painel/ui/`).

## 7. Segurança
- `client_secret` e `refresh_token` **cifrados em repouso** (CryptoService, US-15); nunca retornados ao cliente.
- `state` assinado (HMAC) + validado contra o admin logado → anti-CSRF/replay no callback.
- Escopo mínimo **`gmail.send`** (só enviar).
- Mutações com `requireCsrf`; rotas sob `settings:manage`.
- `redirect_uri` fixo e derivado de `PUBLIC_BASE_URL` (precisa bater com o registrado no Google Cloud).

## 8. Configuração no Google Cloud (ação do usuário — documentar no painel/README)
Criar projeto → ativar **Gmail API** → tela de consentimento **Externo** + escopo `gmail.send` + conta como usuário de teste → credencial **ID do cliente OAuth (Aplicativo da Web)** com o redirect URI acima → **publicar o app** (produção) para o refresh token não expirar (clicar no aviso de "app não verificado"). `PUBLIC_BASE_URL` deve estar correto.

## 9. Verificação manual (sem suíte de testes — convenção do projeto)
- Selecionar "Gmail (OAuth2)", salvar client_id/secret, "Conectar conta Google" → consent → volta "Conectado como …".
- "Enviar e-mail de teste" entrega pela Gmail API (chega na caixa real).
- Desconectar zera o status; reconectar funciona.
- Modo SMTP (Mailpit em dev) continua funcionando; formulário público (`/api/contato`) continua enviando.
- Secret/refresh token nunca aparecem em respostas da API (`GET /settings/email`).
- Sem `client_id`/secret salvos, o botão "Conectar" fica desabilitado.

## 10. Definição de pronto
- [ ] `authType` (`smtp`/`gmail_oauth2`) salvo e respeitado no envio.
- [ ] Fluxo OAuth completo (authorize → consent → callback) salvando refresh token cifrado + e-mail da conta.
- [ ] Envio em modo OAuth via **Gmail API** (`gmail.send`), MIME pelo MailComposer.
- [ ] Client ID/Secret no painel (secret cifrado, write-only); redirect URI exibido.
- [ ] Status conectar/desconectar; e-mail de teste nos dois modos.
- [ ] SMTP/Mailpit e `/api/contato` intactos; segredos nunca expostos; `state` assinado; `settings:manage` + CSRF.
