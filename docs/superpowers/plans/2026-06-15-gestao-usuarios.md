# Gestão de Usuários + RBAC — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a superfície administrativa `/api/admin/*` com autorização granular por permissão (US-10), gestão de papéis de usuário (US-11), convite de usuários (US-06) e aceite público de convite com auto-login (US-07), mais a página pública `/aceitar-convite`.

**Architecture:** Arquitetura em camadas por módulo (`routes → controller → service → repository → db`) com os 4 design patterns do `CLAUDE.md` (Repository, Service Layer, DI por construtor no `container.ts`, hierarquia de erros + handler central). Permissões resolvidas por consulta ao banco a cada requisição (não embutidas no JWT). Aceite público montado num segundo router sob `/api/auth`. Spec: [`docs/superpowers/specs/2026-06-15-gestao-usuarios-design.md`](../specs/2026-06-15-gestao-usuarios-design.md).

**Tech Stack:** Express 5 (ESM, imports com sufixo `.js`), PostgreSQL 16 (`pg`), Zod v4, argon2id, jose (JWT), React 18 + React Hook Form + Zod (frontend). Mailpit em dev.

> **Convenção de verificação deste projeto:** **sem suíte de testes automatizada** (decisão registrada no `CLAUDE.md` — "validação manual no browser"). Cada tarefa verifica com **typecheck** (`npx tsc -p tsconfig.server.json --noEmit` no backend; `npm run build` no frontend) e, quando aplicável, **validação manual em runtime** (curl/Mailpit/browser). Não adicionar testes.
>
> **Comando de typecheck do backend (usado em quase toda tarefa):**
> `npx tsc -p tsconfig.server.json --noEmit` → Esperado: sem saída, exit 0.

---

## Mapa de arquivos

**Criar:**
- `server/migrations/002_user_management.sql` — tabela `invitations`.
- `server/modules/authz/permission.repository.ts` — SQL de resolução de permissão + helpers do guard.
- `server/modules/authz/middleware/require-permission.ts` — middleware `requirePermission(key)`.
- `server/modules/roles/role.service.ts` — regra de negócio de papéis + guard "último admin".
- `server/modules/roles/role.controller.ts` — HTTP fino dos papéis.
- `server/modules/roles/role.routes.ts` — rotas admin de papéis.
- `server/modules/roles/dto/role.dto.ts` — Zod do assign.
- `server/modules/invitations/invitation.repository.ts` — SQL de convites.
- `server/modules/invitations/invitation.service.ts` — convidar + aceitar.
- `server/modules/invitations/invitation.controller.ts` — HTTP fino dos convites.
- `server/modules/invitations/invitation.routes.ts` — rotas admin + pública.
- `server/modules/invitations/dto/invitation.dto.ts` — Zod de convite/aceite.
- `src/pages/AceitarConvite.tsx` — página pública de aceite.

**Modificar:**
- `server/core/config.ts` — `invitationTtlDays`.
- `.env.example` — `INVITE_TTL_DAYS`.
- `server/mail/auth-mail.ts` — `sendInvitationEmail`.
- `server/modules/users/user.repository.ts` — `create`/`assignRole` aceitam executor transacional.
- `server/modules/roles/role.repository.ts` — `listRoles`, `removeUserRole`, `roleHasPermission`, `exists`.
- `server/modules/auth/auth.service.ts` — tornar `issueSession` público.
- `server/container.ts` — instanciar/injetar novos componentes e exportar routers.
- `server/index.ts` — montar `/api/admin/*` e o router público de aceite.
- `src/schemas/auth.ts` — `aceitarConviteSchema`.
- `src/App.tsx` — rota `/aceitar-convite`.

---

## Task 1: Migration `invitations` + config TTL

**Files:**
- Create: `server/migrations/002_user_management.sql`
- Modify: `server/core/config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Criar a migration**

`server/migrations/002_user_management.sql`:

```sql
-- server/migrations/002_user_management.sql
-- Convites de usuário (US-06/US-07). Token guardado apenas hashado (sha256).
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

- [ ] **Step 2: Adicionar `invitationTtlDays` ao config**

Em `server/core/config.ts`, dentro do objeto `config`, logo após a linha `passwordResetTtlMin: int('PASSWORD_RESET_TTL_MIN', 30),`, adicionar:

```ts
  invitationTtlDays: int('INVITE_TTL_DAYS', 7),
```

- [ ] **Step 3: Documentar a env**

Em `.env.example`, na seção de auth (próximo a `PASSWORD_RESET_TTL_MIN` se existir, senão ao final), adicionar:

```
INVITE_TTL_DAYS=7
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 5: Validar a migration em runtime**

Run: `docker compose up -d db && npm run dev:server` (ou o fluxo de dev usual).
Expected: log `[migrations] aplicada: 002_user_management.sql` no primeiro boot. Parar o server depois (`Ctrl-C`).

- [ ] **Step 6: Commit**

```bash
git add server/migrations/002_user_management.sql server/core/config.ts .env.example
git commit -m "feat(db): tabela invitations + config INVITE_TTL_DAYS [US-06/07]"
```

---

## Task 2: authz — PermissionRepository

Isola todo o SQL de resolução de permissão e os helpers do guard "último admin".

**Files:**
- Create: `server/modules/authz/permission.repository.ts`

- [ ] **Step 1: Criar o repositório**

`server/modules/authz/permission.repository.ts`:

```ts
import type { Pool } from 'pg'

/**
 * Resolve permissões pela cadeia users → user_roles → roles → role_permissions → permissions,
 * sempre filtrando usuários ativos. Permissão concedida por QUALQUER role autoriza (união — US-10 CA-04).
 */
export class PermissionRepository {
  constructor(private readonly pool: Pool) {}

  async userHasPermission(userId: string, key: string): Promise<boolean> {
    const r = await this.pool.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM users u
         JOIN user_roles ur      ON ur.user_id = u.id
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p       ON p.id = rp.permission_id
         WHERE u.id = $1 AND u.status = 'active' AND p.key = $2
       ) AS ok`,
      [userId, key],
    )
    return r.rows[0].ok
  }

  /** Usuário mantém a permissão por alguma role DIFERENTE de exceptRoleId? (guard "último admin") */
  async userHasPermissionViaOtherRole(userId: string, key: string, exceptRoleId: string): Promise<boolean> {
    const r = await this.pool.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM users u
         JOIN user_roles ur      ON ur.user_id = u.id
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p       ON p.id = rp.permission_id
         WHERE u.id = $1 AND u.status = 'active' AND p.key = $2 AND ur.role_id <> $3
       ) AS ok`,
      [userId, key, exceptRoleId],
    )
    return r.rows[0].ok
  }

  /** Quantos OUTROS usuários ativos detêm a permissão (exclui exceptUserId). */
  async countActiveUsersWithPermissionExcept(key: string, exceptUserId: string): Promise<number> {
    const r = await this.pool.query<{ count: number }>(
      `SELECT count(DISTINCT u.id)::int AS count
         FROM users u
         JOIN user_roles ur      ON ur.user_id = u.id
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p       ON p.id = rp.permission_id
         WHERE u.status = 'active' AND p.key = $1 AND u.id <> $2`,
      [key, exceptUserId],
    )
    return r.rows[0].count
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/modules/authz/permission.repository.ts
git commit -m "feat(authz): PermissionRepository (resolução de permissão + guard) [US-10]"
```

---

## Task 3: authz — middleware `requirePermission`

**Files:**
- Create: `server/modules/authz/middleware/require-permission.ts`

- [ ] **Step 1: Criar o middleware**

`server/modules/authz/middleware/require-permission.ts`:

```ts
import type { RequestHandler } from 'express'
import { ForbiddenError, UnauthorizedError } from '../../../core/errors.js'
import type { PermissionRepository } from '../permission.repository.js'

/**
 * Fábrica do middleware de autorização por permissão. Roda DEPOIS de requireAuth
 * (que popula req.user). 401 se não autenticado (defesa); 403 se faltar a permissão.
 * Trata os próprios erros via next(e) — não precisa de wrap nas rotas.
 */
export function makeRequirePermission(permissions: PermissionRepository) {
  return (key: string): RequestHandler => async (req, _res, next) => {
    try {
      const userId = req.user?.id
      if (!userId) throw new UnauthorizedError('Não autenticado.')
      const ok = await permissions.userHasPermission(userId, key)
      if (!ok) throw new ForbiddenError('Permissão insuficiente.')
      next()
    } catch (e) {
      next(e)
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/modules/authz/middleware/require-permission.ts
git commit -m "feat(authz): middleware requirePermission [US-10]"
```

---

## Task 4: mail — `sendInvitationEmail`

**Files:**
- Modify: `server/mail/auth-mail.ts`

- [ ] **Step 1: Adicionar a função**

Em `server/mail/auth-mail.ts`, ao final do arquivo, adicionar:

```ts
export async function sendInvitationEmail(to: string, token: string): Promise<void> {
  const link = `${config.appBaseUrl}/aceitar-convite?token=${encodeURIComponent(token)}`
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@iasdtucuruvi.com.br',
    to,
    subject: 'Convite — Painel IASD Tucuruvi',
    html: `
      <h2>Você foi convidado para o painel da IASD Tucuruvi</h2>
      <p>Para ativar seu acesso, defina sua senha pelo link abaixo (válido por ${config.invitationTtlDays} dias):</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não esperava este convite, ignore este e-mail.</p>
    `,
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/mail/auth-mail.ts
git commit -m "feat(mail): sendInvitationEmail [US-06]"
```

---

## Task 5: Repositórios — extensões transacionais e de papéis

`UserRepository.create`/`assignRole` precisam rodar dentro da transação de aceite (US-07). `RoleRepository` ganha consultas para US-11 e o guard.

**Files:**
- Modify: `server/modules/users/user.repository.ts`
- Modify: `server/modules/roles/role.repository.ts`

- [ ] **Step 1: `create` aceita executor**

Em `server/modules/users/user.repository.ts`, substituir o método `create` por:

```ts
  async create(
    data: { email: string; name: string; passwordHash: string },
    executor: Queryable = this.pool,
  ): Promise<UserRow> {
    const r = await executor.query<UserRow>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *`,
      [data.email, data.name, data.passwordHash],
    )
    return r.rows[0]
  }
```

- [ ] **Step 2: `assignRole` aceita executor**

No mesmo arquivo, substituir `assignRole` por:

```ts
  async assignRole(userId: string, roleId: string, executor: Queryable = this.pool): Promise<void> {
    await executor.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, roleId],
    )
  }
```

(`Queryable` já está importado no topo do arquivo.)

- [ ] **Step 3: Extensões no RoleRepository**

Em `server/modules/roles/role.repository.ts`, adicionar ao topo a interface de linha e os métodos novos dentro da classe:

```ts
export interface RoleRow {
  id: string
  key: string
  name: string
}
```

Métodos novos (adicionar dentro de `class RoleRepository`):

```ts
  async listRoles(): Promise<RoleRow[]> {
    const r = await this.pool.query<RoleRow>('SELECT id, key, name FROM roles ORDER BY name')
    return r.rows
  }

  async exists(roleId: string): Promise<boolean> {
    const r = await this.pool.query('SELECT 1 FROM roles WHERE id = $1', [roleId])
    return r.rowCount === 1
  }

  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await this.pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId])
  }

  async roleHasPermission(roleId: string, key: string): Promise<boolean> {
    const r = await this.pool.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = $1 AND p.key = $2
       ) AS ok`,
      [roleId, key],
    )
    return r.rows[0].ok
  }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/modules/users/user.repository.ts server/modules/roles/role.repository.ts
git commit -m "feat(repos): UserRepository transacional + extensões do RoleRepository [US-07/11]"
```

---

## Task 6: roles — RoleService (assign/remove + guard "último admin")

**Files:**
- Create: `server/modules/roles/role.service.ts`

- [ ] **Step 1: Criar o service**

`server/modules/roles/role.service.ts`:

```ts
import { ConflictError, NotFoundError } from '../../core/errors.js'
import type { RoleRepository, RoleRow } from './role.repository.js'
import type { UserRepository } from '../users/user.repository.js'
import type { PermissionRepository } from '../authz/permission.repository.js'

// Permissão que define um "administrador" para o guard do último admin (US-11 CA-04).
const ADMIN_PERMISSION = 'roles:assign'

export class RoleService {
  constructor(
    private readonly roles: RoleRepository,
    private readonly users: UserRepository,
    private readonly permissions: PermissionRepository,
  ) {}

  listRoles(): Promise<RoleRow[]> {
    return this.roles.listRoles()
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    const user = await this.users.findById(userId)
    if (!user) throw new NotFoundError('Usuário não encontrado.')
    if (!(await this.roles.exists(roleId))) throw new NotFoundError('Papel não encontrado.')
    await this.users.assignRole(userId, roleId) // idempotente (ON CONFLICT DO NOTHING)
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    const user = await this.users.findById(userId)
    if (!user) throw new NotFoundError('Usuário não encontrado.')

    // Guard "último admin": só se a role removida concede a permissão administrativa
    // e o usuário é ativo. Bloqueia se a remoção zeraria os admins ativos.
    if (user.status === 'active' && (await this.roles.roleHasPermission(roleId, ADMIN_PERMISSION))) {
      const keepsViaOther = await this.permissions.userHasPermissionViaOtherRole(
        userId, ADMIN_PERMISSION, roleId,
      )
      if (!keepsViaOther) {
        const others = await this.permissions.countActiveUsersWithPermissionExcept(ADMIN_PERMISSION, userId)
        if (others === 0) {
          throw new ConflictError('Operação bloqueada: o sistema ficaria sem administrador.')
        }
      }
    }

    await this.roles.removeUserRole(userId, roleId)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/modules/roles/role.service.ts
git commit -m "feat(roles): RoleService com guard do último administrador [US-11]"
```

---

## Task 7: roles — DTO, controller e rotas

**Files:**
- Create: `server/modules/roles/dto/role.dto.ts`
- Create: `server/modules/roles/role.controller.ts`
- Create: `server/modules/roles/role.routes.ts`

- [ ] **Step 1: DTO**

`server/modules/roles/dto/role.dto.ts`:

```ts
import { z } from 'zod'

export const assignRoleDto = z.object({
  roleId: z.uuid('roleId inválido.'),
})
```

- [ ] **Step 2: Controller**

`server/modules/roles/role.controller.ts`:

```ts
import type { Request, Response } from 'express'
import { assignRoleDto } from './dto/role.dto.js'
import type { RoleService } from './role.service.js'

export class RoleController {
  constructor(private readonly roles: RoleService) {}

  list = async (_req: Request, res: Response) => {
    res.json({ roles: await this.roles.listRoles() })
  }

  assign = async (req: Request, res: Response) => {
    const { roleId } = assignRoleDto.parse(req.body)
    await this.roles.assignRole(req.params.id, roleId)
    res.status(204).end()
  }

  remove = async (req: Request, res: Response) => {
    await this.roles.removeRole(req.params.id, req.params.roleId)
    res.status(204).end()
  }
}
```

- [ ] **Step 3: Rotas**

`server/modules/roles/role.routes.ts`:

```ts
import { Router, type RequestHandler } from 'express'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import type { RoleController } from './role.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

export function makeRoleAdminRoutes(
  controller: RoleController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const perm = requirePermission('roles:assign')
  r.get('/roles', wrap(requireAuth), perm, wrap(controller.list))
  r.post('/users/:id/roles', wrap(requireAuth), perm, requireCsrf, wrap(controller.assign))
  r.delete('/users/:id/roles/:roleId', wrap(requireAuth), perm, requireCsrf, wrap(controller.remove))
  return r
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/modules/roles/dto/role.dto.ts server/modules/roles/role.controller.ts server/modules/roles/role.routes.ts
git commit -m "feat(roles): rotas admin GET/POST/DELETE de papéis [US-11]"
```

---

## Task 8: invitations — DTO e repositório

**Files:**
- Create: `server/modules/invitations/dto/invitation.dto.ts`
- Create: `server/modules/invitations/invitation.repository.ts`

- [ ] **Step 1: DTO**

`server/modules/invitations/dto/invitation.dto.ts`:

```ts
import { z } from 'zod'

export const inviteDto = z.object({
  email: z.email(),
  roleKey: z.string().min(1),
})

export const acceptInviteDto = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(120),
  password: z.string().min(1), // política aplicada no value object Password (422)
})
```

- [ ] **Step 2: Repositório**

`server/modules/invitations/invitation.repository.ts`:

```ts
import type { Pool } from 'pg'
import type { Queryable } from '../../core/db.js'

export interface InvitationRow {
  id: string
  email: string
  role_id: string
  token_hash: string
  invited_by: string | null
  status: 'pending' | 'accepted' | 'revoked'
  expires_at: Date
  accepted_at: Date | null
}

export class InvitationRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: {
    email: string
    roleId: string
    tokenHash: string
    invitedBy: string | null
    expiresAt: Date
  }): Promise<InvitationRow> {
    const r = await this.pool.query<InvitationRow>(
      `INSERT INTO invitations (email, role_id, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.email, data.roleId, data.tokenHash, data.invitedBy, data.expiresAt],
    )
    return r.rows[0]
  }

  async findByHash(hash: string): Promise<InvitationRow | null> {
    const r = await this.pool.query<InvitationRow>(
      'SELECT * FROM invitations WHERE token_hash = $1',
      [hash],
    )
    return r.rows[0] ?? null
  }

  async revokePendingForEmail(email: string, executor: Queryable = this.pool): Promise<void> {
    await executor.query(
      `UPDATE invitations SET status = 'revoked' WHERE email = $1 AND status = 'pending'`,
      [email],
    )
  }

  async markAccepted(id: string, executor: Queryable = this.pool): Promise<void> {
    await executor.query(
      `UPDATE invitations SET status = 'accepted', accepted_at = now() WHERE id = $1`,
      [id],
    )
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/modules/invitations/dto/invitation.dto.ts server/modules/invitations/invitation.repository.ts
git commit -m "feat(invitations): DTO + InvitationRepository [US-06/07]"
```

---

## Task 9: auth — `issueSession` público + invitations Service

**Files:**
- Modify: `server/modules/auth/auth.service.ts`
- Create: `server/modules/invitations/invitation.service.ts`

- [ ] **Step 1: Tornar `issueSession` público**

Em `server/modules/auth/auth.service.ts`, mudar a assinatura do método privado para público (reuso no aceite — US-07 CA-04). Trocar:

```ts
  /** Cria uma nova família de refresh token + emite access. */
  private async issueSession(userId: string, familyId = randomUUID()): Promise<SessionTokens> {
```

por:

```ts
  /** Cria uma nova família de refresh token + emite access. Público: reusado no aceite de convite. */
  async issueSession(userId: string, familyId = randomUUID()): Promise<SessionTokens> {
```

- [ ] **Step 2: Criar o service de convites**

`server/modules/invitations/invitation.service.ts`:

```ts
import { config } from '../../core/config.js'
import { withTransaction } from '../../core/db.js'
import { BadRequestError, ConflictError, ValidationError } from '../../core/errors.js'
import { Password } from '../../core/security/password.js'
import { sendInvitationEmail } from '../../mail/auth-mail.js'
import type { TokenService } from '../../core/security/token.service.js'
import type { UserRepository } from '../users/user.repository.js'
import type { RoleRepository } from '../roles/role.repository.js'
import type { InvitationRepository } from './invitation.repository.js'
import type { AuthService, PublicUser, SessionTokens } from '../auth/auth.service.js'

const DAY_MS = 86_400_000

export class InvitationService {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  /** US-06 — cria (ou reemite) um convite e envia o e-mail. Retorna metadados SEM o token. */
  async invite(input: { email: string; roleKey: string; invitedBy: string | null }) {
    const existing = await this.users.findByEmail(input.email)
    if (existing) throw new ConflictError('Já existe um usuário com este e-mail.')

    const roleId = await this.roles.findRoleIdByKey(input.roleKey)
    if (!roleId) throw new ValidationError('Papel inválido.')

    await this.invitations.revokePendingForEmail(input.email) // CA-04: reemissão invalida o anterior

    const { token, hash } = this.tokens.generateOpaqueToken()
    const expiresAt = new Date(Date.now() + config.invitationTtlDays * DAY_MS)
    const invite = await this.invitations.create({
      email: input.email,
      roleId,
      tokenHash: hash,
      invitedBy: input.invitedBy,
      expiresAt,
    })

    await sendInvitationEmail(input.email, token)
    return { id: invite.id, email: invite.email, expiresAt: invite.expires_at }
  }

  /** US-07 — aceita o convite, cria a conta ativa com a role e devolve a sessão (auto-login). */
  async acceptInvite(input: { token: string; name: string; password: string }): Promise<{ user: PublicUser } & SessionTokens> {
    // Política primeiro (422), sem consumir o convite (CA-03).
    const password = Password.create(input.password)

    const invite = await this.invitations.findByHash(this.tokens.hashToken(input.token))
    if (!invite || invite.status !== 'pending' || invite.expires_at.getTime() <= Date.now()) {
      throw new BadRequestError('Convite inválido ou expirado.')
    }

    // Corrida: o e-mail pode ter virado usuário por outra via desde o convite.
    const existing = await this.users.findByEmail(invite.email)
    if (existing) throw new ConflictError('Já existe um usuário com este e-mail.')

    const passwordHash = await password.hash()
    const user = await withTransaction(async (tx) => {
      const created = await this.users.create(
        { email: invite.email, name: input.name, passwordHash },
        tx,
      )
      await this.users.assignRole(created.id, invite.role_id, tx)
      await this.invitations.markAccepted(invite.id, tx)
      return created
    })

    const session = await this.auth.issueSession(user.id)
    return { user: { id: user.id, name: user.name, email: user.email }, ...session }
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/modules/auth/auth.service.ts server/modules/invitations/invitation.service.ts
git commit -m "feat(invitations): InvitationService convidar/aceitar + auto-login [US-06/07]"
```

---

## Task 10: invitations — controller e rotas

**Files:**
- Create: `server/modules/invitations/invitation.controller.ts`
- Create: `server/modules/invitations/invitation.routes.ts`

- [ ] **Step 1: Controller**

`server/modules/invitations/invitation.controller.ts`:

```ts
import type { Request, Response } from 'express'
import { inviteDto, acceptInviteDto } from './dto/invitation.dto.js'
import { setAccessCookie, setRefreshCookie } from '../auth/auth.cookies.js'
import type { InvitationService } from './invitation.service.js'

export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}

  invite = async (req: Request, res: Response) => {
    const dto = inviteDto.parse(req.body)
    const invite = await this.invitations.invite({
      email: dto.email,
      roleKey: dto.roleKey,
      invitedBy: req.user!.id,
    })
    res.status(201).json({ invite })
  }

  accept = async (req: Request, res: Response) => {
    const dto = acceptInviteDto.parse(req.body)
    const { user, accessToken, refreshToken } = await this.invitations.acceptInvite(dto)
    setAccessCookie(res, accessToken)
    setRefreshCookie(res, refreshToken)
    res.status(201).json({ user })
  }
}
```

- [ ] **Step 2: Rotas (admin + pública)**

`server/modules/invitations/invitation.routes.ts`:

```ts
import { Router, type RequestHandler } from 'express'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import type { InvitationController } from './invitation.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

/** Montado em /api/admin. Convidar exige users:invite. */
export function makeInvitationAdminRoutes(
  controller: InvitationController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  r.post(
    '/invitations',
    wrap(requireAuth),
    requirePermission('users:invite'),
    requireCsrf,
    wrap(controller.invite),
  )
  return r
}

/** Montado em /api/auth (público). Aceite de convite — sem autenticação, com CSRF. */
export function makeInvitationPublicRoutes(controller: InvitationController): Router {
  const r = Router()
  r.post('/accept-invite', requireCsrf, wrap(controller.accept))
  return r
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/modules/invitations/invitation.controller.ts server/modules/invitations/invitation.routes.ts
git commit -m "feat(invitations): controller + rotas admin/pública [US-06/07]"
```

---

## Task 11: Composition root + montagem das rotas

**Files:**
- Modify: `server/container.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Wiring no container**

Em `server/container.ts`, adicionar os imports (após os imports existentes):

```ts
import { RoleRepository } from './modules/roles/role.repository.js'
import { PermissionRepository } from './modules/authz/permission.repository.js'
import { InvitationRepository } from './modules/invitations/invitation.repository.js'
import { makeRequirePermission } from './modules/authz/middleware/require-permission.js'
import { RoleService } from './modules/roles/role.service.js'
import { RoleController } from './modules/roles/role.controller.js'
import { makeRoleAdminRoutes } from './modules/roles/role.routes.js'
import { InvitationService } from './modules/invitations/invitation.service.js'
import { InvitationController } from './modules/invitations/invitation.controller.js'
import {
  makeInvitationAdminRoutes, makeInvitationPublicRoutes,
} from './modules/invitations/invitation.routes.js'
```

E, após a linha `export const authRoutes = makeAuthRoutes(authController, requireAuth)`, adicionar:

```ts
// --- Área administrativa (RBAC + gestão de usuários) ---
const roleRepo = new RoleRepository(pool)
const permissionRepo = new PermissionRepository(pool)
const invitationRepo = new InvitationRepository(pool)

const requirePermission = makeRequirePermission(permissionRepo)

const roleService = new RoleService(roleRepo, userRepo, permissionRepo)
const roleController = new RoleController(roleService)

const invitationService = new InvitationService(invitationRepo, userRepo, roleRepo, tokens, authService)
const invitationController = new InvitationController(invitationService)

export const roleRoutes = makeRoleAdminRoutes(roleController, requireAuth, requirePermission)
export const invitationAdminRoutes = makeInvitationAdminRoutes(invitationController, requireAuth, requirePermission)
export const invitationPublicRoutes = makeInvitationPublicRoutes(invitationController)
```

- [ ] **Step 2: Montar as rotas no index**

Em `server/index.ts`, trocar o import do container:

```ts
import { authRoutes, bootstrap } from './container.js'
```

por:

```ts
import {
  authRoutes, roleRoutes, invitationAdminRoutes, invitationPublicRoutes, bootstrap,
} from './container.js'
```

E logo após a linha `app.use('/api/auth', authRoutes)`, adicionar:

```ts
app.use('/api/auth', invitationPublicRoutes) // aceite público de convite
app.use('/api/admin', invitationAdminRoutes)
app.use('/api/admin', roleRoutes)
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Validar boot e rotas em runtime**

Run: `docker compose up -d db mailpit && npm run dev:server`
Expected: server sobe sem erro. Em outro terminal:

```bash
curl -i http://localhost:3001/api/admin/roles
```
Expected: `401 Unauthorized` (sem cookie) — confirma que `/api/admin/*` está montado e protegido por `requireAuth` antes da permissão (US-10 CA-03). Parar o server depois.

- [ ] **Step 5: Commit**

```bash
git add server/container.ts server/index.ts
git commit -m "feat(admin): monta /api/admin (papéis + convites) e aceite público [US-06/07/10/11]"
```

---

## Task 12: Frontend — página pública de aceite

**Files:**
- Modify: `src/schemas/auth.ts`
- Create: `src/pages/AceitarConvite.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Schema do aceite**

Em `src/schemas/auth.ts`, ao final do arquivo, adicionar (espelha a política do server — convenção de schemas duplicados do `CLAUDE.md`):

```ts
export const aceitarConviteSchema = z.object({
  name: z.string().min(1, 'Informe seu nome'),
  password: z.string()
    .min(8, 'Mínimo de 8 caracteres')
    .regex(/[A-Z]/, 'Inclua uma letra maiúscula')
    .regex(/[0-9]/, 'Inclua um número')
    .regex(/[^A-Za-z0-9]/, 'Inclua um símbolo'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'As senhas não conferem', path: ['confirm'] })
```

- [ ] **Step 2: Página de aceite**

`src/pages/AceitarConvite.tsx` (padrão de `RedefinirSenha.tsx`; em sucesso, faz reload completo para `/painel` para o `AuthProvider` recarregar `/me` com os cookies novos):

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams, Link } from 'react-router-dom'
import { z } from 'zod'
import { aceitarConviteSchema } from '@/schemas/auth'
import { apiFetch, ensureCsrf } from '@/auth/auth-api'

type Input = z.infer<typeof aceitarConviteSchema>

export default function AceitarConvite() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [erro, setErro] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Input>({ resolver: zodResolver(aceitarConviteSchema) })

  async function onSubmit(data: Input) {
    setErro('')
    await ensureCsrf()
    const res = await apiFetch('/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, name: data.name, password: data.password }),
    })
    if (res.ok) {
      // Reload completo: o AuthProvider roda /me no boot e pega a sessão recém-criada.
      window.location.href = '/painel'
    } else {
      const body = await res.json().catch(() => ({}))
      setErro(body.error || 'Não foi possível aceitar o convite.')
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
        <p className="text-gray-700">Convite inválido. <Link to="/login" className="text-iasd-accent underline">Ir para o login</Link>.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-4">
        <h1 className="text-xl font-heading font-bold text-iasd-dark text-center">Ativar acesso</h1>
        {erro && <p className="text-red-600 text-sm text-center">{erro}</p>}
        <div>
          <label className="block text-sm mb-1">Seu nome</label>
          <input type="text" {...register('name')} className="w-full border rounded px-3 py-2" />
          {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm mb-1">Senha</label>
          <input type="password" {...register('password')} className="w-full border rounded px-3 py-2" />
          {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-sm mb-1">Confirmar senha</label>
          <input type="password" {...register('confirm')} className="w-full border rounded px-3 py-2" />
          {errors.confirm && <p className="text-red-600 text-xs mt-1">{errors.confirm.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full bg-iasd-dark text-white rounded py-2 hover:bg-iasd-accent transition disabled:opacity-60">
          Ativar acesso
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Rota no App**

Em `src/App.tsx`, adicionar o import junto aos demais de páginas:

```tsx
import AceitarConvite from './pages/AceitarConvite'
```

E a rota, logo após a linha de `/redefinir-senha`:

```tsx
        <Route path="/aceitar-convite" element={<AceitarConvite />} />
```

- [ ] **Step 4: Build (typecheck do frontend)**

Run: `npm run build`
Expected: build conclui sem erros de tipo (Vite + tsc do server). 

- [ ] **Step 5: Commit**

```bash
git add src/schemas/auth.ts src/pages/AceitarConvite.tsx src/App.tsx
git commit -m "feat(ui): página pública /aceitar-convite [US-07]"
```

---

## Task 13: Validação manual ponta-a-ponta

Sem testes automatizados (convenção do projeto). Validar o fluxo completo no ambiente de dev.

**Pré-requisitos:**
- `docker compose up -d db mailpit`
- `.env.dev.local`/`.env.local` com `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` (senha conforme política).
- Backend: `npm run dev:server` · Frontend: `npm run dev`
- Mailpit UI: http://localhost:8025

- [ ] **US-06 — Convidar (caminho feliz):** logar no painel como admin (capturando cookies/CSRF) e chamar `POST /api/admin/invitations` com `{ "email": "novo@teste.com", "roleKey": "admin" }`. Esperado: `201`; e-mail aparece no Mailpit com link `/aceitar-convite?token=...`.
- [ ] **US-06 — E-mail já cadastrado:** convidar o e-mail do admin → `409`.
- [ ] **US-06 — Autorização:** sem a permissão `users:invite` → `403` (ver passo de RBAC abaixo). Sem cookie → `401`.
- [ ] **US-06 — Reemissão (CA-04):** convidar `novo@teste.com` de novo → novo e-mail; o token anterior deixa de funcionar no aceite (`400`).
- [ ] **US-07 — Aceite (caminho feliz):** abrir o link do Mailpit no browser, definir nome + senha válida → redireciona para `/painel` já logado; a conta tem a role do convite.
- [ ] **US-07 — Token inválido/expirado/reusado:** reabrir o mesmo link após aceitar → `400`.
- [ ] **US-07 — Senha fraca (CA-03):** tentar aceitar com senha fora da política → `422`; o convite continua `pending` (o aceite seguinte com senha válida funciona).
- [ ] **US-10 — RBAC:** criar uma 2ª role sem `users:invite` (inserir linhas em `roles`/`role_permissions`, sem migration), atribuí-la a um usuário de teste e confirmar `403` ao convidar; confirmar `401` sem access token.
- [ ] **US-11 — Papéis:** `GET /api/admin/roles` retorna o catálogo; `POST /api/admin/users/:id/roles` atribui (repetir é idempotente, sem duplicar); `DELETE /api/admin/users/:id/roles/:roleId` remove.
- [ ] **US-11 — Guard último admin (CA-04):** com apenas um admin no sistema, tentar remover a role `admin` dele → `409`; com dois admins, a remoção de um é permitida.
- [ ] **Commit final (se houver ajustes):**

```bash
git add -A
git commit -m "chore(admin): ajustes da validação manual do épico de gestão de usuários"
```

---

## Pós-implementação

- [ ] Atualizar `docs/historias/README.md`: marcar US-06, US-07, US-10, US-11 como ✅ com os commits principais.
- [ ] Usar superpowers:finishing-a-development-branch para decidir merge/PR.
