# Spec — Épico Gestão de Usuários + RBAC granular

**Data:** 2026-06-15 · **Branch:** `feat/area-administrativa`
**Histórias cobertas:** US-10 (autorizar por permissão), US-11 (gerenciar papéis), US-06 (convidar usuário), US-07 (aceitar convite).
**Superfície nova:** `/api/admin/*` + endpoint público `/api/auth/accept-invite` + página pública `/aceitar-convite`.

## Contexto

O épico de Autenticação já entregou a fundação: schema (`001_auth_foundation.sql`), `core/security`
(`Password` argon2id, `TokenService` JWT + token opaco), hierarquia de erros + handler central,
`requireAuth`, CSRF, cookies e as telas mínimas de auth. Esta spec constrói **em cima dessa fundação**
a gestão de usuários e a autorização granular por permissão.

Estado relevante no início:
- Tabelas existentes: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`,
  `refresh_tokens`, `password_reset_tokens`. **Não existe** tabela `invitations`.
- Catálogo de permissões (`server/seed/permissions.catalog.ts`) já declara `users:read`,
  `users:invite`, `roles:assign`, `boletim:write`. A role `admin` recebe **todas** as permissões no seed.
- `requireAuth` (valida JWT do cookie `access_token`) existe. **`requirePermission` não existe.**
- `TokenService.generateOpaqueToken()` + `hashToken()` são reutilizáveis para o token de convite.
- Padrão de e-mail: `server/mail/auth-mail.ts` (`sendPasswordResetEmail`); transporter Nodemailer →
  Mailpit em dev.
- O runner de migrations (`core/db.ts → runMigrations`) aplica arquivos `.sql` em ordem alfabética,
  idempotente via tabela `schema_migrations`. Basta adicionar `002_*.sql`.
- Frontend: `src/auth/auth-api.ts` fixa o prefixo `/api/auth`; `src/pages/RedefinirSenha.tsx` é o
  padrão de página pública com token na query string.

## Decisões de arquitetura

Todo o código novo segue a arquitetura em camadas obrigatória do `CLAUDE.md`
(`routes → controller → service → repository → db`), organizada por módulo (feature), com os 4 design
patterns (Repository, Service Layer, DI por construtor no `container.ts`, hierarquia de erros + handler
central). Uma classe só nasce com estado + comportamento coeso e mais de um consumidor; caso contrário,
função pura.

### Decisão 1 — Resolução de permissões: consulta ao banco por requisição

`requirePermission('chave')` roda **depois** de `requireAuth` e resolve a permissão com um `EXISTS`
único, juntando `users → user_roles → roles → role_permissions → permissions` e filtrando
`users.status = 'active'`. O access token **não** carrega permissões.

- **Por quê:** mudanças de papel (US-11) precisam refletir imediatamente. Permissões embutidas no JWT
  ficariam *stale* até o refresh (~15 min) e incham o token.
- **Alternativa rejeitada:** embutir permissões no JWT.
- **Custo:** 1 query barata (indexada por PKs/FKs) por request administrativo. Sem cache nesta entrega;
  se necessário no futuro, memoização por requisição é incremento trivial.
- **União de roles (US-10 CA-04):** o `EXISTS` percorre todas as roles do usuário, então a permissão
  concedida por **qualquer** role já autoriza — união natural, sem código extra.

### Decisão 2 — Guard "último administrador" por permissão `roles:assign`

A regra de US-11 CA-04 (não deixar o sistema sem administrador) é definida **por permissão**, nunca por
nome de role (coerente com a decisão de RBAC do `CLAUDE.md`): uma remoção de papel é bloqueada com `409`
se resultaria em **zero usuários ativos** detendo a permissão `roles:assign`.

- **Por quê:** consistente com "autorizar por permissão, nunca por nome de role". Funciona mesmo quando
  existirem outras roles administrativas além de `admin`.

### Decisão 3 — Roteamento do aceite: dois routers no mesmo prefixo `/api/auth`

US-07 fixa o caminho público `POST /api/auth/accept-invite` (sem autenticação). Para honrá-lo sem
quebrar a coesão do módulo `invitations`, o módulo exporta **dois** routers e o composition root monta
ambos:

- `app.use('/api/admin', adminRoutes)` — inclui o `POST /invitations` (protegido).
- `app.use('/api/auth', authRoutes)` **e** `app.use('/api/auth', invitationPublicRoutes)` — o segundo
  acrescenta o `POST /accept-invite` público. Express permite múltiplos routers no mesmo mount.

## Modelo de dados — nova migration

`server/migrations/002_user_management.sql`:

```sql
CREATE TABLE invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       citext NOT NULL,
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  invited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','revoked')),
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX idx_invitations_email      ON invitations(email);
```

- Token guardado **apenas hashado** (sha256 via `TokenService.hashToken`), nunca em claro — mesmo padrão
  de `refresh_tokens`/`password_reset_tokens`.
- `status` modela o ciclo de vida (uso único): `pending` → `accepted` (aceito) ou `revoked` (reenvio
  invalidou o anterior). Expiração via `expires_at`.
- `invited_by` registra quem convidou (US-06 CA-01); `ON DELETE SET NULL` preserva o histórico do
  convite se o autor for removido.

### Config

Adicionar a `server/core/config.ts`: `invitationTtlDays` (env `INVITE_TTL_DAYS`, default `7`).
`deploy.sh` não precisa de novo segredo.

## Estrutura de módulos

```
server/
├── migrations/002_user_management.sql
├── modules/
│   ├── authz/                                  # US-10
│   │   ├── permission.repository.ts
│   │   └── middleware/require-permission.ts
│   ├── invitations/                            # US-06 + US-07
│   │   ├── invitation.repository.ts
│   │   ├── invitation.service.ts
│   │   ├── invitation.controller.ts
│   │   ├── invitation.routes.ts
│   │   └── dto/invitation.dto.ts
│   └── roles/                                  # US-11 (estende o existente)
│       ├── role.repository.ts                  # +listRoles, +removeUserRole
│       ├── role.service.ts                     # assign/remove + guard "último admin"
│       ├── role.controller.ts
│       └── role.routes.ts
├── mail/auth-mail.ts                           # +sendInvitationEmail
└── container.ts                                # +permissionRepo, +requirePermission, +adminRoutes, +invitationPublicRoutes
```

### `authz` (US-10)

- **`PermissionRepository`** (fala com o Postgres):
  - `userHasPermission(userId, key): Promise<boolean>` — `EXISTS` com o JOIN descrito, `status='active'`.
  - `listForUser(userId): Promise<string[]>` — opcional, para depuração/UI futura.
  - `countActiveUsersWithPermission(key): Promise<number>` — suporta o guard de US-11.
- **`makeRequirePermission(permRepo)`** → função `(key: string) => RequestHandler`:
  - Assume `requireAuth` já populou `req.user`. Se ausente (defesa), lança `UnauthorizedError` (`401`).
  - Se `userHasPermission` falso, lança `ForbiddenError` (`403`).
  - Encaminha rejeições ao handler central (padrão `wrap`/asyncWrap das rotas).

### `invitations` (US-06 + US-07)

- **`InvitationRepository`**: `create({email, roleId, tokenHash, invitedBy, expiresAt})` ·
  `findByHash(hash)` · `findPendingByEmail(email)` · `revokePendingForEmail(email, tx?)`
  (UPDATE status='revoked' WHERE pending) · `markAccepted(id, tx?)`.
- **`InvitationService`**:
  - `invite({email, roleKey, invitedBy})`:
    1. `409 ConflictError` se `users.findByEmail` já existe (US-06 CA-03).
    2. resolve `roleId` por `roleKey` (`RoleRepository.findRoleIdByKey`); inexistente ⇒ `422`/`400`.
    3. `revokePendingForEmail` (US-06 CA-04 reenvio invalida o anterior).
    4. `generateOpaqueToken()`; grava o **hash** + `role_id` + `invited_by` + `expires_at`
       (`now() + invitationTtlDays`).
    5. `sendInvitationEmail(email, token)` (token em claro só no e-mail).
    6. Retorna metadados do convite **sem** o token.
  - `acceptInvite({token, name, password})`:
    1. `Password.create(password)` **primeiro** — política inválida ⇒ `422`, sem consumir o convite
       (US-07 CA-03).
    2. `findByHash(hashToken(token))`; inexistente, `status != 'pending'`, ou `expires_at <= now()`
       ⇒ `400 BadRequestError` (US-07 CA-02).
    3. **Transação** (`withTransaction`): `users.create({email do convite, name, passwordHash})` com
       `status='active'` + `users.assignRole(userId, invite.role_id)` + `markAccepted(invite.id)`.
       E-mail herdado do convite, imutável (US-07 nota técnica).
    4. **Auto-login** (US-07 CA-04, *Should* — incluído): emite sessão e devolve
       `accessToken`/`refreshToken` para o controller setar os cookies (reusa `auth.cookies`).
       **Nota de implementação:** `AuthService.issueSession` é hoje **privado**. Para reuso sem
       duplicar lógica de refresh token, tornar `issueSession(userId)` **público** em `AuthService` e
       injetar `AuthService` no `InvitationController` (ou no service) só para emitir a sessão no aceite.
       Alternativa equivalente: extrair um `SessionIssuer` compartilhado. O plano decide; o desenho
       exige apenas **não** reimplementar a emissão de refresh token.
    5. Retorna o `PublicUser`.
- **`InvitationController`** + **`invitation.routes.ts`**:
  - `makeInvitationAdminRoutes(controller, requireAuth, requirePermission)` → `POST /invitations`
    (`requireAuth` + `requirePermission('users:invite')` + `requireCsrf`).
  - `makeInvitationPublicRoutes(controller)` → `POST /accept-invite` (`requireCsrf`, público); seta
    cookies de sessão na resposta.
- **DTOs Zod** (`dto/invitation.dto.ts`): `inviteSchema { email: email, roleKey: string }` (o convite
  usa `roleKey` — amigável ao admin); `acceptSchema { name: string(min), password: string }`.

### `roles` (US-11)

- **`RoleRepository`** (estende o existente): `+listRoles(): {id,key,name}[]` ·
  `+removeUserRole(userId, roleId)` (DELETE de `user_roles`). `assignRole` idempotente já existe em
  `UserRepository` (`ON CONFLICT DO NOTHING`).
- **`RoleService`**:
  - `listRoles()` (US-11 CA-01).
  - `assignRole(userId, roleId)`: valida usuário existe (`404 NotFoundError`) e role existe; idempotente
    (US-11 CA-02).
  - `removeRole(userId, roleId)`: **guard "último admin"** — se a role removida concede `roles:assign`
    e `permissionRepo.countActiveUsersWithPermission('roles:assign')` cairia a 0 com a remoção,
    `409 ConflictError` (US-11 CA-04). Senão, `removeUserRole` (US-11 CA-03).
- **`RoleController`** + **`makeRoleAdminRoutes(...)`**: `GET /roles`, `POST /users/:id/roles`,
  `DELETE /users/:id/roles/:roleId`, todos com `requireAuth` + `requirePermission('roles:assign')`
  (mutações também com `requireCsrf`).
- **DTO dos endpoints de papéis:** o `POST /users/:id/roles` recebe `{ roleId }` no corpo — coerente com
  o `:roleId` do path do `DELETE`. (Difere do convite, que usa `roleKey`; pinado aqui de propósito para
  evitar ambiguidade.)

### Composition root (`container.ts`)

Instancia `PermissionRepository` e `InvitationRepository`, reusa `UserRepository` e `TokenService` (já
instanciados) e **passa a instanciar `RoleRepository`** no composition root — hoje ela só é criada no
`seed.ts`, então precisa ser nova no `container.ts`, não meramente "reusada". Monta
`requirePermission = makeRequirePermission(permissionRepo)`. Compõe `adminRoutes`
(invitations admin + roles) e `invitationPublicRoutes`. `index.ts` adiciona:

```ts
app.use('/api/admin', adminRoutes)
app.use('/api/auth', invitationPublicRoutes)   // além do authRoutes já existente
```

## Fluxo de dados e mapeamento de erros

| Situação | Status | Erro |
|----------|--------|------|
| Sem `access_token` válido em `/api/admin/*` | 401 | `UnauthorizedError` (via `requireAuth`, antes da permissão — US-10 CA-03) |
| Autenticado sem a permissão exigida | 403 | `ForbiddenError` (via `requirePermission`) |
| Convidar e-mail já cadastrado | 409 | `ConflictError` |
| Aceite com token inexistente/expirado/usado | 400 | `BadRequestError` |
| Aceite com senha fora da política | 422 | `ValidationError` (via `Password.create`) |
| Remover última role com `roles:assign` | 409 | `ConflictError` |
| Usuário/role inexistente em US-11 | 404 | `NotFoundError` |

Todos lançados pelas camadas de serviço/middleware e traduzidos pelo handler central existente
(`core/error-handler.ts`). Nenhum `try/catch` nos controllers.

## Frontend

Apenas a página pública de aceite (decisão de escopo — a UI de administração fica para o épico do painel,
US-13/14).

- **`src/pages/AceitarConvite.tsx`** (padrão de `RedefinirSenha.tsx`): lê `?token=`; formulário
  **nome + senha + confirmação** (React Hook Form + Zod); `ensureCsrf()` no boot; `POST` para
  `/api/auth/accept-invite` via o cliente `auth-api`; em sucesso os cookies de sessão já vêm setados →
  redireciona para `/painel`. Erros `400` (token inválido) e `422` (senha) exibidos inline.
- **`src/App.tsx`**: rota pública `/aceitar-convite`.
- **`src/schemas/auth.ts`**: `acceptInviteSchema { name, password, confirm }` (espelha o `acceptSchema`
  do servidor; manter em sincronia — convenção do `CLAUDE.md`).

`src/auth/auth-api.ts` já fixa o prefixo `/api/auth`, então o `accept-invite` encaixa sem mudança no
cliente.

## Segurança

- Token de convite **uso único** + expiração curta (~7 dias), guardado **hashado**. Reenvio revoga o
  pendente anterior.
- Resposta de criação de convite **não** inclui o token (só vai por e-mail) — evita vazamento via logs/UI.
- `requireCsrf` em todas as mutações (inclusive o aceite público).
- Autorização sempre por **permissão** (`requirePermission`), nunca por nome de role.
- Guard de "último admin" impede lockout administrativo total.
- Sem multi-tenant; sem mudança no modelo de sessão/refresh já existente.

## Validação (sem suíte de testes — convenção do projeto)

Validação manual no browser + `curl` + Mailpit:
1. **US-06:** `POST /api/admin/invitations` autenticado como admin → convite criado, e-mail no Mailpit
   com link `/aceitar-convite?token=...`. Reenviar para o mesmo e-mail invalida o anterior. E-mail já
   cadastrado ⇒ `409`.
2. **US-07:** abrir o link → definir nome+senha → conta `active` criada com a role do convite → cai
   logado no `/painel`. Token reusado/expirado ⇒ `400`. Senha fraca ⇒ `422` sem consumir o convite.
3. **US-10:** criar uma 2ª role sem `users:invite` (inserindo linhas, sem migration), atribuí-la a um
   usuário de teste e confirmar `403` ao convidar; `401` sem cookie.
4. **US-11:** `GET /api/admin/roles`; atribuir/remover papéis (idempotência no assign); tentar remover a
   última role com `roles:assign` ⇒ `409`.

## Fora de escopo (incrementos futuros)

- UI de administração (convidar/listar usuários, gerenciar papéis) — épico do painel (US-13/US-14).
- Criação de novas roles via UI (`editor`, `viewer`) — hoje só por inserção de linhas, sem migration.
- Listagem de usuários (`users:read`) — sem história nesta entrega.
- Cache de permissões por requisição — só se houver necessidade de performance.
