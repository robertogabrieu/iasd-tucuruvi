# Spec — Épico de Autenticação (backend + telas mínimas)

- **Data:** 2026-06-14
- **Branch:** `feat/area-administrativa`
- **Histórias cobertas:** US-01, US-02, US-03, US-04, US-05, US-08, US-09
- **Referência de arquitetura:** `CLAUDE.md` → seção *Backend — Área Administrativa, Autenticação e RBAC*
- **Backlog:** `docs/historias/`

---

## 1. Objetivo e contexto

Implementar o backend de autenticação da área administrativa do site IASD Tucuruvi, mais as
telas React mínimas para usar o fluxo de entrada ponta-a-ponta. Hoje só existe a **infra**
(serviço Postgres no `docker-compose`, variáveis em `.env.example`, geração de segredos no
`deploy.sh`, e a documentação de arquitetura no `CLAUDE.md`). **Nenhum código de auth, migration
ou dependência (`pg`/`argon2`/`jwt`) existe ainda** — esta spec define o backend desde a fundação.

A entrega é um **vertical slice clicável**: um administrador consegue logar, manter a sessão
(refresh rotativo), recuperar a senha por e-mail e está protegido contra força bruta; o primeiro
usuário é criado por seed no boot.

## 2. Escopo

### Dentro do escopo

| História | Resumo |
|---|---|
| US-01 | Login com e-mail e senha |
| US-02 | Logout |
| US-03 | Sessão persistente com refresh token rotativo |
| US-04 | Esqueci minha senha |
| US-05 | Redefinir senha via token de uso único |
| US-08 | Proteção contra força bruta |
| US-09 | Seed do usuário e role iniciais |

Mais a **fundação** exigida por essas histórias: schema do banco, `core/security`
(`Password`, `TokenService`, `csrf`), hierarquia de erros + handler central, runner de
migrations, middleware `requireAuth` e `requireCsrf`, e as telas React de auth.

### Fora do escopo (specs próprias depois)

- **US-10/US-11** — `requirePermission` granular e endpoints de gestão de roles. *Esta spec
  inclui o schema RBAC e o seed, mas **não** o middleware de permissão nem os endpoints de
  atribuição de role.*
- **US-06/US-07** — convite e aceite de usuário.
- **US-13/US-14** e demais — layout do painel, telas de configuração, boletim etc.

### Decisão de fronteira (importante)

Para satisfazer **US-09** sem exigir uma migration nova quando a spec de RBAC chegar, esta spec
inclui o **schema RBAC completo** (5 tabelas: `users`, `roles`, `permissions`, `user_roles`,
`role_permissions`) e um **seed** que popula o catálogo de permissões, a role `admin` (com todas
as permissões) e o primeiro usuário. Porém o **comportamento** de autorização granular
(`requirePermission`, endpoints de roles) fica para a spec de RBAC. Só `requireAuth` (validação
de sessão) entra agora.

## 3. Decisões tomadas no brainstorming

| Tema | Decisão |
|---|---|
| Escopo da spec | Auth + fundação mínima (não a área admin inteira) |
| Frontend | Backend **+ telas mínimas de auth** (login, esqueci, redefinir) + 1 placeholder protegida |
| CSRF | **Double-submit token** (HMAC com `CSRF_SECRET`) **somado** a `SameSite=Strict` |
| Política de senha | **Mín. 8 chars + ≥1 maiúscula, ≥1 número, ≥1 símbolo** |
| Lib JWT | `jose` (ESM-nativo, casa com `"type":"module"`) |
| Endpoints de suporte | Incluir `GET /api/auth/me` e `GET /api/auth/csrf` |

> **Nota de segurança (registrada por decisão do usuário):** o NIST SP 800-63B moderno
> recomenda priorizar **comprimento** sobre regras de composição (composição tende a gerar
> senhas previsíveis como `Senha123!`). O usuário optou pela política clássica (8 + composição);
> implementamos exatamente isso, mas a constante de política fica centralizada e fácil de ajustar.

## 4. Arquitetura em camadas

Segue a arquitetura obrigatória do `CLAUDE.md` (organização por feature, fluxo
`routes → controller → service → repository → db`, 4 design patterns: Repository, Service Layer,
DI por construtor em composition root, hierarquia de erros + handler central).

```
server/
├── core/
│   ├── db.ts                       # Pool pg; runner de migrations (SQL numerado); dispara seed no boot
│   ├── errors.ts                   # AppError → Unauthorized/Forbidden/NotFound/Conflict/Validation/TooManyRequests
│   ├── error-handler.ts            # middleware central: AppError (e ZodError) → resposta HTTP
│   ├── config.ts                   # leitura/validação de env (TTLs, params brute-force, política senha)
│   └── security/
│       ├── password.ts             # value object Password: valida política + hash/verify argon2id
│       ├── token.service.ts        # emite/valida JWT (jose); rotação + detecção de reuso
│       └── csrf.ts                 # emite/valida token double-submit (HMAC CSRF_SECRET)
├── modules/auth/
│   ├── auth.routes.ts              # liga rotas → controller + middlewares
│   ├── auth.controller.ts          # HTTP fino: valida DTO, chama service, monta cookies/resposta
│   ├── auth.service.ts             # regra de negócio: login, refresh, logout, forgot, reset, brute-force
│   ├── dto/                        # schemas Zod de entrada
│   └── middleware/
│       ├── require-auth.ts         # valida access JWT → req.user
│       └── require-csrf.ts         # valida double-submit nas rotas mutantes
├── modules/users/
│   └── user.repository.ts          # SQL de users (consumido por auth.service e pelo seed)
├── modules/tokens/
│   ├── refresh-token.repository.ts # SQL de refresh_tokens (família, rotação, revogação)
│   └── password-reset.repository.ts# SQL de password_reset_tokens
├── seed/
│   ├── seed.ts                     # idempotente: permissões + role admin + 1º usuário
│   └── permissions.catalog.ts      # catálogo versionado de chaves de permissão
├── migrations/
│   └── 001_auth_foundation.sql     # schema completo da fundação
└── container.ts                    # composition root: instancia repos → services → controllers
```

**Integração com o servidor existente:** as rotas de auth são montadas sob `/api/auth/*` no
`server/index.ts`, sem tocar nas APIs públicas existentes (`/api/flickr`, `/api/youtube`,
`/api/contato`). `cookie-parser` é adicionado ao app. O `error-handler` é registrado por último.

**Regras de camada (reforço):** o controller nunca executa SQL; o service nunca toca `req`/`res`
(recebe DTOs e devolve resultados/contexto de cookie); o repository nunca contém regra de
negócio. `auth.service` encapsula toda a lógica de brute-force (não o controller), reutilizável
por seed/CLI.

## 5. Modelo de dados

Migration única de fundação (`001_auth_foundation.sql`). Extensões: `citext` (e-mail
case-insensitive), `pgcrypto` ou `gen_random_uuid()` para UUIDs.

### `users`
| coluna | tipo | notas |
|---|---|---|
| id | uuid PK | default `gen_random_uuid()` |
| email | citext UNIQUE NOT NULL | case-insensitive |
| password_hash | text NOT NULL | argon2id |
| name | text NOT NULL | |
| status | text NOT NULL | `active` \| `disabled`, default `active` |
| failed_login_count | int NOT NULL | default 0 |
| locked_until | timestamptz NULL | lockout progressivo |
| lock_cycle_count | int NOT NULL | default 0; nº de ciclos de lock já cumpridos (define o backoff) |
| last_login_at | timestamptz NULL | |
| created_at / updated_at | timestamptz NOT NULL | default `now()` |

### `roles`
`id` uuid PK · `key` text UNIQUE (ex.: `admin`) · `name` text · `created_at`.

### `permissions`
`id` uuid PK · `key` text UNIQUE (ex.: `users:invite`) · `description` text.

### `user_roles` (N:N)
`user_id` FK → users · `role_id` FK → roles · **PK composta** `(user_id, role_id)`.
`ON DELETE CASCADE` em ambos.

### `role_permissions` (N:N)
`role_id` FK → roles · `permission_id` FK → permissions · **PK composta**. `ON DELETE CASCADE`.

### `refresh_tokens`
| coluna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | `ON DELETE CASCADE` |
| family_id | uuid NOT NULL | correlaciona a cadeia de rotações de uma sessão |
| token_hash | text NOT NULL | **só o hash** (SHA-256) do refresh token |
| expires_at | timestamptz NOT NULL | |
| revoked_at | timestamptz NULL | preenchido na rotação/logout/reuso |
| replaced_by | uuid NULL | id do token que o substituiu (auditoria da rotação) |
| created_at | timestamptz NOT NULL | |

Índices: `(user_id)`, `(family_id)`, `(token_hash)`.

### `password_reset_tokens`
`id` uuid PK · `user_id` FK · `token_hash` text (**só hash**) · `expires_at` · `used_at` timestamptz NULL · `created_at`. Índice em `(token_hash)` e `(user_id)`.

### `schema_migrations`
`version` text PK · `applied_at` timestamptz. Usado pelo runner caseiro.

**Hashing de tokens:** refresh e reset são gerados como segredos aleatórios (ex.: 32 bytes
`base64url`); guardamos `sha256(token)`. A validação re-hasheia o token recebido e compara.
(O JWT de access **não** é guardado — é stateless, validado por assinatura.)

## 6. Endpoints

Base: `/api/auth`. Todas as respostas de erro passam pelo handler central.

| Método | Rota | História | Auth | CSRF | Resumo |
|---|---|---|---|---|---|
| GET | `/csrf` | suporte | não | n/a | emite cookie CSRF não-httpOnly + retorna token; chamado no load do SPA |
| POST | `/login` | US-01, US-08 | não | sim | valida credenciais; seta cookies access+refresh; aplica lockout + rate-limit |
| POST | `/refresh` | US-03 | refresh cookie | sim | rotaciona par; detecta reuso (revoga família) |
| POST | `/logout` | US-02 | refresh cookie | sim | revoga refresh atual; limpa cookies; idempotente `204` |
| GET | `/me` | US-03 | access cookie | não | bootstrap de sessão no SPA; `401` se sem access válido |
| POST | `/forgot-password` | US-04 | não | sim | resposta genérica sempre; rate-limit; invalida tokens anteriores |
| POST | `/reset-password` | US-05 | não | sim | consome token único; regrava senha; revoga todas as sessões |

### Contratos (resumo)

- `POST /login` → body `{ email, password }`. Sucesso `200` com cookies + body
  `{ user: { id, name, email } }`. Erros: `401` (credenciais inválidas — genérico), `403`
  (conta `disabled`), `422` (validação Zod), `429` (rate-limit/lockout).
- `POST /refresh` → sem body; lê cookie de refresh. Sucesso `200` + novos cookies. Erro `401`
  (ausente/expirado/revogado/reuso).
- `POST /logout` → sem body; revoga e limpa. Sempre `204`.
- `GET /me` → `200 { user: { id, name, email, roles: [...] } }` ou `401`.
- `POST /forgot-password` → body `{ email }`. Sempre `200` genérico (exceto `429`).
- `POST /reset-password` → body `{ token, password }`. Sucesso `200`. Erros: `400`
  (token inválido/expirado/usado — genérico), `422` (política de senha).

### Cookies emitidos

- `access_token` — JWT, `httpOnly` + `Secure` + `SameSite=Strict`, `Max-Age` = `JWT_ACCESS_TTL`.
- `refresh_token` — segredo opaco, `httpOnly` + `Secure` + `SameSite=Strict`, `Path=/api/auth`,
  `Max-Age` = `JWT_REFRESH_TTL`.
- `csrf_token` — **não-httpOnly** (o JS precisa ler), `Secure` + `SameSite=Strict`.

> `Secure` é condicionado a produção: em dev (HTTP localhost) a flag é omitida para os cookies
> funcionarem; controlado por env (`NODE_ENV`/`COOKIE_SECURE`).

## 7. Mecanismos de segurança

### 7.1 JWT e sessão (US-01, US-03)
- Lib `jose`. Access ~15 min, refresh ~7 dias (env `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`).
- Access JWT assinado com `JWT_ACCESS_SECRET`; payload mínimo (`sub` = user id, `iat`, `exp`).
- **Refresh rotativo:** cada `/refresh` válido emite par novo, marca o refresh anterior
  `revoked_at = now()` e `replaced_by = <novo id>`, na mesma transação.
- **Detecção de reuso:** se chega um refresh cujo registro já está `revoked_at`, é roubo
  presumido ⟶ revoga **toda a família** (`UPDATE ... WHERE family_id = $1`) e responde `401`.
- **Expiração:** refresh expirado → `401`, exige novo login.
- `requireAuth` valida só o access JWT (sem tocar no refresh) — US-03 CA-04.

### 7.2 CSRF (double-submit + SameSite)
- `csrf.ts` gera valor aleatório e o assina via HMAC-SHA256 com `CSRF_SECRET`.
- `GET /csrf` seta o cookie `csrf_token` (não-httpOnly) e retorna o valor no body.
- Frontend reenvia o valor no header `X-CSRF-Token` em **todo POST**.
- `requireCsrf` valida: header presente, igual ao cookie, e assinatura válida. Falha → `403`.
- Camada extra sobre `SameSite=Strict` (que já bloqueia envio cross-site em browsers modernos).

### 7.3 Proteção contra força bruta (US-08)
Parâmetros centralizados em `core/config.ts` (env com defaults):

| Parâmetro | Default | Env |
|---|---|---|
| Rate-limit login por IP | 10 tentativas / 5 min → `429` | `LOGIN_RATE_MAX` / `LOGIN_RATE_WINDOW` |
| Limiar de lockout por conta | 5 falhas consecutivas | `LOCKOUT_THRESHOLD` |
| Backoff progressivo (por ciclo) | 1 min → 5 min → 15 min → 60 min (teto) | `LOCKOUT_BACKOFF` |
| Rate-limit forgot-password | 3 / 15 min por email+IP → `429` | `FORGOT_RATE_MAX` / `FORGOT_RATE_WINDOW` |

- Rate-limit por IP estende `server/lib/rate-limit.ts` (já existente).
- **Lockout por conta:** a cada falha incrementa `failed_login_count`. Ao atingir
  `LOCKOUT_THRESHOLD`, define `locked_until` conforme o `lock_cycle_count` atual na curva de
  backoff, incrementa `lock_cycle_count` e zera `failed_login_count`. Login com conta dentro de
  `locked_until` é recusado **mesmo com senha correta** (mensagem genérica — US-08 CA-04).
- **Reset em sucesso:** login bem-sucedido zera `failed_login_count`, limpa `locked_until` e
  zera `lock_cycle_count`.
- Toda a lógica vive em `auth.service` (não no controller).

### 7.4 Política de senha (US-05, reutilizável por US-07 futura)
- Value object `Password` valida: mín. **8 caracteres**, **≥1 maiúscula, ≥1 número, ≥1 símbolo**.
- Validação **server-side** no `Password.create()`; espelhada no Zod do frontend (schema
  duplicado client/server, conforme convenção do projeto).
- Hash/verify com **argon2id** (lib `argon2`), parâmetros de custo em config.

### 7.5 Não-vazamento de existência de conta (US-01, US-04, US-05)
- Login: `401` genérico para e-mail inexistente **ou** senha errada.
- Forgot-password: sempre `200` genérico; e-mail só é enviado se a conta existe e está `active`.
- Reset: `400` genérico para token inválido/expirado/usado.

### 7.6 Recuperação de senha (US-04, US-05)
- `forgot-password`: gera token aleatório, guarda `sha256` em `password_reset_tokens`
  (`expires_at` ≈ 30 min), **invalida** tokens não usados anteriores do mesmo usuário, e envia
  e-mail com link `/redefinir-senha?token=<token-claro>` via a infra existente
  (`server/lib/mail.ts` → Nodemailer/Mailpit em dev).
- `reset-password`: valida token por hash; em sucesso regrava senha (argon2id), marca
  `used_at`, e **revoga todas as sessões** do usuário (`refresh_tokens`) — exige novo login.
  Operação transacional.

## 8. Seed / Bootstrap (US-09)

- Roda no boot, **depois** das migrations, a partir de `core/db.ts` → `seed/seed.ts`. Idempotente.
- **Permissões:** popula o catálogo de `permissions` a partir de `permissions.catalog.ts`
  (chaves conhecidas, ex.: `users:invite`, `users:read`, `roles:assign`, `boletim:write`).
  `INSERT ... ON CONFLICT (key) DO NOTHING`.
- **Role `admin`:** cria a role `admin` (se não existir) e vincula **todas** as permissões do
  catálogo (`role_permissions`), idempotente.
- **Primeiro usuário:** se `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` definidos **e** não existe
  nenhum usuário, cria usuário `active` (senha argon2id) e atribui a role `admin`.
- **Ausência de envs** e sem usuários: loga aviso claro e **segue** sem quebrar o boot (US-09 CA-04).
- **Idempotência:** reexecução não duplica nem sobrescreve (verifica existência antes de inserir).
- Reaproveita `user.repository` / repos de role — sem SQL duplicado solto.

## 9. Frontend mínimo (vertical slice)

Telas React (Vite + React Router v7), seguindo identidade visual e convenções existentes
(`@/*` alias, React Hook Form + Zod). **Sem** o layout do painel (US-13 é épico à parte).

- **Rotas novas:**
  - `/login` — formulário e-mail+senha; erros genéricos; em sucesso vai para `/painel`.
  - `/esqueci-senha` — campo e-mail; sempre exibe confirmação genérica.
  - `/redefinir-senha` — lê `?token=`; campos nova senha + confirmação (valida política client-side).
  - `/painel` — **placeholder protegido** (só prova a sessão ponta-a-ponta; conteúdo real vem depois).
- **`AuthContext` (React Context):**
  - No mount: `GET /api/auth/csrf` → depois `GET /api/auth/me` para hidratar `user`.
  - Expõe `user`, `login(email, password)`, `logout()`.
  - **Wrapper de fetch:** injeta o header `X-CSRF-Token` em POSTs; em `401`, tenta `POST /refresh`
    uma vez e repete a requisição original; se o refresh falhar, limpa `user` e manda p/ `/login`.
- **`ProtectedRoute`:** redireciona para `/login` quando não há `user`.
- Schemas Zod de login/reset duplicados em `src/schemas/` (espelham os do servidor).

## 10. Tratamento de erros e config

- **Hierarquia `AppError`** (`core/errors.ts`): `UnauthorizedError` (401), `ForbiddenError` (403),
  `NotFoundError` (404), `ConflictError` (409), `ValidationError` (422), `TooManyRequestsError` (429).
- **Handler central** (`core/error-handler.ts`): traduz `AppError` e `ZodError` para HTTP; loga
  o inesperado e responde `500` genérico. Registrado por último no `index.ts`. Elimina
  `try/catch` repetido nos controllers.
- **Config** (`core/config.ts`): lê e valida env no boot (segredos JWT, `CSRF_SECRET`, TTLs,
  params de brute-force, custo argon2, `COOKIE_SECURE`). Falha cedo se segredo obrigatório faltar
  em produção.

## 11. Dependências novas

| Pacote | Uso |
|---|---|
| `pg` (+ `@types/pg`) | driver Postgres / pool |
| `argon2` | hash/verify de senha (argon2id) |
| `jose` | emissão/validação de JWT (ESM-nativo) |
| `cookie-parser` (+ `@types/cookie-parser`) | parsing de cookies no Express |

Sem ORM — runner de migrations é caseiro (lê `migrations/*.sql` em ordem, registra em
`schema_migrations`). Convenção ESM do backend: imports internos com sufixo `.js`.

## 12. Estratégia de validação

Conforme convenção do projeto (**sem suíte de testes automatizada**), a validação é manual:

- **Browser:** fluxo de login, sessão persistente (recarregar página mantém logado), logout,
  acesso à `/painel` protegida, esqueci/redefinir senha.
- **Mailpit:** confere o e-mail de reset e o link com token.
- **Postgres:** inspeciona `users` (lockout, contadores, `last_login_at`), `refresh_tokens`
  (rotação, `revoked_at`, `replaced_by`, revogação de família), `password_reset_tokens`
  (`used_at`), e o resultado do seed.
- **Checklist por história:** cada US tem seus CA verificados manualmente (ver DoD em
  `docs/historias/`).

## 13. Critérios de aceitação consolidados (rastreabilidade)

- **US-01:** login `200` com cookies; `401` genérico; `403` disabled; `422` validação; zera contadores; atualiza `last_login_at`.
- **US-02:** logout revoga refresh, limpa cookies, `204` idempotente; refresh pós-logout → `401`.
- **US-03:** rotação emite par novo + revoga anterior; reuso revoga família; expiração → `401`; access válido acessa rota protegida sem tocar refresh.
- **US-04:** token de reset hashado com expiração curta; e-mail no Mailpit; resposta genérica idêntica p/ conta inexistente; invalida tokens anteriores; rate-limit `429`.
- **US-05:** redefinição consome token único, regrava com argon2id, revoga todas as sessões; token inválido → `400` genérico; política de senha → `422`.
- **US-08:** rate-limit IP `429`; lockout progressivo por conta; reset de contadores no sucesso; mensagens genéricas.
- **US-09:** role `admin` + catálogo de permissões semeados; 1º usuário das envs; idempotente; ausência de envs apenas avisa e segue.

## 14. Sequência de implementação sugerida

1. Dependências + `core/config.ts` + `core/db.ts` (pool + runner) + migration `001`.
2. `core/errors.ts` + `core/error-handler.ts`; montar em `index.ts`.
3. `core/security/password.ts` (argon2 + política) e `core/security/token.service.ts` (jose) e `csrf.ts`.
4. Repositórios: `user`, `refresh-token`, `password-reset`.
5. `seed/` (catálogo + role + 1º usuário) ligado ao boot (US-09).
6. `auth.service` (login + brute-force) → `auth.controller` → `auth.routes`; middlewares `requireAuth`/`requireCsrf`; `container.ts`. (US-01, US-08)
7. Refresh/logout + rotação/detecção de reuso. (US-02, US-03)
8. Forgot/reset + e-mail. (US-04, US-05)
9. Frontend: `AuthContext` + wrapper fetch + rotas `/login`, `/esqueci-senha`, `/redefinir-senha`, `/painel` + `ProtectedRoute`.
10. Validação manual ponta-a-ponta (seção 12).
