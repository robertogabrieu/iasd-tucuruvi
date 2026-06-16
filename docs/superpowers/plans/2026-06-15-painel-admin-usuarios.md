# Painel — Administração de Usuários — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as telas de administração de usuários no painel (`/painel/usuarios`, `/painel/usuarios/:id`, `/painel/usuarios/convites`) e os endpoints `/api/admin` que faltavam (listar/editar usuários, listar/revogar convites, `permissions` no `/me`), preenchendo o gap da [issue #8](https://github.com/robertogabrieu/iasd-tucuruvi/issues/8).

**Architecture:** Arquitetura em camadas por módulo (`routes → controller → service → repository → db`) com os 4 design patterns do `CLAUDE.md`. Reaproveita o backend já entregue (convites US-06, papéis US-11, `requirePermission` US-10, `forgotPassword` US-04, `revokeAllForUser`). Introduz a convenção de **paginação no backend** (contrato `page`/`limit` + envelope `{ data, pagination }`). Gating de permissão no front é conveniência; a barreira real continua no `requirePermission`. Spec: [`docs/superpowers/specs/2026-06-15-painel-admin-usuarios-design.md`](../specs/2026-06-15-painel-admin-usuarios-design.md).

**Tech Stack:** Express 5 (ESM, imports com sufixo `.js`), PostgreSQL 16 (`pg`), Zod v4, React 18 + React Router v7 + React Hook Form + Zod. Mailpit em dev.

> **Convenção de verificação deste projeto:** **sem suíte de testes automatizada** (decisão registrada no `CLAUDE.md` — "validação manual no browser"). Cada tarefa verifica com **typecheck** e, quando aplicável, **validação manual em runtime** (curl/Mailpit/browser). Não adicionar testes.
>
> **Typecheck backend:** `npx tsc -p tsconfig.server.json --noEmit` → Esperado: sem saída, exit 0.
> **Typecheck/build frontend:** `npm run build` → Esperado: conclui sem erros.

---

## Mapa de arquivos

**Criar (backend):**
- `server/core/pagination.ts` — `paginationQuery` (Zod), `paginate()`, `toOffset()`.
- `server/modules/users/user.service.ts` — regra de listagem/edição/status/unlock/reset.
- `server/modules/users/user.controller.ts` — HTTP fino dos usuários.
- `server/modules/users/user.routes.ts` — `makeUserAdminRoutes(...)`.
- `server/modules/users/dto/user.dto.ts` — Zod de edição/status.

**Modificar (backend):**
- `server/seed/permissions.catalog.ts` — `+users:manage`.
- `server/modules/users/user.repository.ts` — `listWithRoles`, `findByIdWithRoles`, `updateProfile`, `setStatus`, `unlock`, `getPermissionKeys`.
- `server/modules/auth/auth.service.ts` — `PublicUser.permissions`; `me()` inclui permissões.
- `server/modules/invitations/invitation.repository.ts` — `listPending`, `revoke`.
- `server/modules/invitations/invitation.service.ts` — `listPending`, `revoke`.
- `server/modules/invitations/invitation.controller.ts` — `list`, `revoke`.
- `server/modules/invitations/invitation.routes.ts` — `+GET /invitations`, `+DELETE /invitations/:id`.
- `server/container.ts` — instanciar `UserService`/`UserController`, exportar `userRoutes`.
- `server/index.ts` — montar `userRoutes` em `/api/admin`.

**Criar (frontend):**
- `src/auth/RequirePermission.tsx` — wrapper de rota por permissão.
- `src/painel/components/Modal.tsx` — overlay simples.
- `src/painel/components/Pager.tsx` — controle de paginação.
- `src/painel/usePagination.ts` — estado `page`/`limit`.
- `src/schemas/usuarios.ts` — schemas Zod (editar usuário, convite).
- `src/painel/pages/UsuariosLista.tsx` + `src/painel/components/RolesModal.tsx`.
- `src/painel/pages/UsuarioDetalhe.tsx`.
- `src/painel/pages/Convites.tsx`.

**Modificar (frontend):**
- `src/auth/AuthContext.tsx` — `permissions` + `hasPermission`.
- `src/painel/nav-config.tsx` — remover "Papéis"; campo `perm` opcional.
- `src/painel/Sidebar.tsx` — filtrar `NAV` por permissão.
- `src/App.tsx` — rotas de usuários protegidas por `RequirePermission`.

**Documentação:**
- `CLAUDE.md` — convenção de paginação no backend.
- `docs/historias/README.md` — marcar US-23 a US-26 como ✅ (pós-implementação).

---

## Task 1: Convenção de paginação (`core/pagination.ts`) + doc no CLAUDE.md

**Files:**
- Create: `server/core/pagination.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Criar o utilitário de paginação**

`server/core/pagination.ts`:

```ts
import { z } from 'zod'

/** Contrato padrão de paginação de listagens (CLAUDE.md › Convenções de código). */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type PaginationParams = z.infer<typeof paginationQuery>

export interface Paginated<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/** Deslocamento SQL a partir de page/limit (1-based). */
export function toOffset(p: { page: number; limit: number }): number {
  return (p.page - 1) * p.limit
}

/** Monta o envelope padrão `{ data, pagination }`. */
export function paginate<T>(data: T[], total: number, p: { page: number; limit: number }): Paginated<T> {
  return {
    data,
    pagination: { page: p.page, limit: p.limit, total, totalPages: Math.max(1, Math.ceil(total / p.limit)) },
  }
}
```

- [ ] **Step 2: Documentar a convenção no CLAUDE.md**

Em `CLAUDE.md`, na seção **Convenções de código**, adicionar um novo item (após o item "Cache em memória"):

```markdown
- **Listagens paginadas no backend:** todo `GET` de coleção que cresce (usuários, convites, futuros boletins) é paginado no servidor pelo contrato padrão `?page=&limit=` (`page` ≥ 1, default 1; `limit` 1–100, default 20) com envelope de resposta `{ data, pagination: { page, limit, total, totalPages } }`. Utilitário compartilhado em `server/core/pagination.ts` (`paginationQuery`, `toOffset`, `paginate`). Catálogos de referência fixos (papéis, permissões) são **isentos** — alimentam `<select>` e vêm inteiros.
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/core/pagination.ts CLAUDE.md
git commit -m "feat(core): convenção de paginação no backend (page/limit + envelope) [US-23/25]"
```

---

## Task 2: Permissão `users:manage` no catálogo

**Files:**
- Modify: `server/seed/permissions.catalog.ts`

- [ ] **Step 1: Adicionar a permissão**

Em `server/seed/permissions.catalog.ts`, adicionar uma linha ao array `PERMISSIONS` (após `roles:assign`):

```ts
  { key: 'users:manage', description: 'Administrar contas (editar, ativar/desativar, desbloquear, redefinir senha)' },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 3: Validar que o seed religa ao admin**

Run: `docker compose up -d db && npm run dev:server`
Expected: boot sem erro (o seed roda `linkAllPermissions` e vincula `users:manage` ao papel `admin`). Parar o server depois (`Ctrl-C`).

- [ ] **Step 4: Commit**

```bash
git add server/seed/permissions.catalog.ts
git commit -m "feat(authz): permissão users:manage no catálogo [US-24]"
```

---

## Task 3: `UserRepository` — extensões de listagem/edição/permissões

**Files:**
- Modify: `server/modules/users/user.repository.ts`

- [ ] **Step 1: Tipos de linha das consultas administrativas**

Em `server/modules/users/user.repository.ts`, após a interface `UserRow`, adicionar:

```ts
export interface AdminUserListRow {
  id: string
  email: string
  name: string
  status: 'active' | 'disabled'
  last_login_at: Date | null
  roles: string[]
}

export interface AdminUserDetailRow extends AdminUserListRow {
  failed_login_count: number
  locked_until: Date | null
  created_at: Date
}
```

- [ ] **Step 2: Métodos novos no `UserRepository`**

Adicionar dentro de `class UserRepository` (ex.: após `getRoleKeys`):

```ts
  async listWithRoles(
    { limit, offset }: { limit: number; offset: number },
  ): Promise<{ rows: AdminUserListRow[]; total: number }> {
    const rows = await this.pool.query<AdminUserListRow>(
      `SELECT u.id, u.email, u.name, u.status, u.last_login_at,
              COALESCE(array_remove(array_agg(r.key), NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r       ON r.id = ur.role_id
        GROUP BY u.id
        ORDER BY u.name
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    )
    const count = await this.pool.query<{ count: number }>('SELECT count(*)::int AS count FROM users')
    return { rows: rows.rows, total: count.rows[0].count }
  }

  async findByIdWithRoles(id: string): Promise<AdminUserDetailRow | null> {
    const r = await this.pool.query<AdminUserDetailRow>(
      `SELECT u.id, u.email, u.name, u.status, u.last_login_at,
              u.failed_login_count, u.locked_until, u.created_at,
              COALESCE(array_remove(array_agg(r.key), NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r       ON r.id = ur.role_id
        WHERE u.id = $1
        GROUP BY u.id`,
      [id],
    )
    return r.rows[0] ?? null
  }

  async updateProfile(id: string, data: { name?: string; email?: string }): Promise<void> {
    await this.pool.query(
      `UPDATE users SET name = COALESCE($2, name), email = COALESCE($3, email), updated_at = now()
       WHERE id = $1`,
      [id, data.name ?? null, data.email ?? null],
    )
  }

  async setStatus(id: string, status: 'active' | 'disabled'): Promise<void> {
    await this.pool.query('UPDATE users SET status = $2, updated_at = now() WHERE id = $1', [id, status])
  }

  async unlock(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL, lock_cycle_count = 0, updated_at = now()
       WHERE id = $1`,
      [id],
    )
  }

  /** Chaves de permissão do usuário (união das roles), filtrando conta ativa. Alimenta o /me (US-26). */
  async getPermissionKeys(userId: string): Promise<string[]> {
    const r = await this.pool.query<{ key: string }>(
      `SELECT DISTINCT p.key
         FROM users u
         JOIN user_roles ur      ON ur.user_id = u.id
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p       ON p.id = rp.permission_id
        WHERE u.id = $1 AND u.status = 'active'`,
      [userId],
    )
    return r.rows.map(x => x.key)
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/modules/users/user.repository.ts
git commit -m "feat(users): extensões do UserRepository (listagem/edição/permissões) [US-23/24/26]"
```

---

## Task 4: `/me` passa a expor `permissions`

**Files:**
- Modify: `server/modules/auth/auth.service.ts`

- [ ] **Step 1: Adicionar `permissions` ao `PublicUser`**

Em `server/modules/auth/auth.service.ts`, na interface `PublicUser`, adicionar o campo:

```ts
export interface PublicUser {
  id: string
  name: string
  email: string
  roles?: string[]
  permissions?: string[]
}
```

- [ ] **Step 2: `me()` resolve permissões**

No mesmo arquivo, substituir o método `me`:

```ts
  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId)
    if (!user) throw new UnauthorizedError('Não autenticado.')
    const [roles, permissions] = await Promise.all([
      this.users.getRoleKeys(userId),
      this.users.getPermissionKeys(userId),
    ])
    return { ...this.toPublic(user), roles, permissions }
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/modules/auth/auth.service.ts
git commit -m "feat(auth): /me retorna permissions [US-26]"
```

---

## Task 5: DTOs de usuário

**Files:**
- Create: `server/modules/users/dto/user.dto.ts`

- [ ] **Step 1: Criar os DTOs**

`server/modules/users/dto/user.dto.ts`:

```ts
import { z } from 'zod'

/** Edição parcial: pelo menos um campo. */
export const updateUserDto = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.email().optional(),
}).refine(d => d.name !== undefined || d.email !== undefined, {
  message: 'Informe ao menos um campo para atualizar.',
})

export const setStatusDto = z.object({
  status: z.enum(['active', 'disabled']),
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/modules/users/dto/user.dto.ts
git commit -m "feat(users): DTOs de edição/status [US-24]"
```

---

## Task 6: `UserService` (listagem, edição, status, unlock, reset)

**Files:**
- Create: `server/modules/users/user.service.ts`

- [ ] **Step 1: Criar o service**

`server/modules/users/user.service.ts`:

```ts
import { ConflictError, NotFoundError } from '../../core/errors.js'
import { paginate, type Paginated } from '../../core/pagination.js'
import type { UserRepository, AdminUserListRow, AdminUserDetailRow } from './user.repository.js'
import type { PermissionRepository } from '../authz/permission.repository.js'
import type { RefreshTokenRepository } from '../tokens/refresh-token.repository.js'
import type { AuthService } from '../auth/auth.service.js'

// Permissão que caracteriza um administrador (mesmo critério do guard de US-11).
const ADMIN_PERMISSION = 'roles:assign'

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly permissions: PermissionRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly auth: AuthService,
  ) {}

  async list(params: { page: number; limit: number }): Promise<Paginated<AdminUserListRow>> {
    const offset = (params.page - 1) * params.limit
    const { rows, total } = await this.users.listWithRoles({ limit: params.limit, offset })
    return paginate(rows, total, params)
  }

  async get(id: string): Promise<AdminUserDetailRow> {
    const user = await this.users.findByIdWithRoles(id)
    if (!user) throw new NotFoundError('Usuário não encontrado.')
    return user
  }

  async update(id: string, data: { name?: string; email?: string }): Promise<void> {
    const user = await this.users.findById(id)
    if (!user) throw new NotFoundError('Usuário não encontrado.')
    if (data.email) {
      const other = await this.users.findByEmail(data.email)
      if (other && other.id !== id) throw new ConflictError('Já existe um usuário com este e-mail.')
    }
    await this.users.updateProfile(id, data)
  }

  async setStatus(id: string, status: 'active' | 'disabled'): Promise<void> {
    const user = await this.users.findById(id)
    if (!user) throw new NotFoundError('Usuário não encontrado.')

    if (status === 'disabled') {
      // Guard "último admin": não pode zerar os administradores ativos.
      const isAdmin = await this.permissions.userHasPermission(id, ADMIN_PERMISSION)
      if (isAdmin) {
        const others = await this.permissions.countActiveUsersWithPermissionExcept(ADMIN_PERMISSION, id)
        if (others === 0) {
          throw new ConflictError('Operação bloqueada: o sistema ficaria sem administrador.')
        }
      }
    }

    await this.users.setStatus(id, status)
    if (status === 'disabled') await this.refreshTokens.revokeAllForUser(id) // derruba a sessão
  }

  async unlock(id: string): Promise<void> {
    const user = await this.users.findById(id)
    if (!user) throw new NotFoundError('Usuário não encontrado.')
    await this.users.unlock(id)
  }

  /** Dispara o e-mail de redefinição reusando o fluxo de US-04 (resposta sempre genérica). */
  async triggerPasswordReset(id: string): Promise<void> {
    const user = await this.users.findById(id)
    if (!user) throw new NotFoundError('Usuário não encontrado.')
    await this.auth.forgotPassword(user.email)
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/modules/users/user.service.ts
git commit -m "feat(users): UserService (listagem/edição/status/unlock/reset) [US-23/24]"
```

---

## Task 7: `UserController` + rotas admin de usuários

**Files:**
- Create: `server/modules/users/user.controller.ts`
- Create: `server/modules/users/user.routes.ts`

- [ ] **Step 1: Controller**

`server/modules/users/user.controller.ts`:

```ts
import type { Request, Response } from 'express'
import { paginationQuery } from '../../core/pagination.js'
import { updateUserDto, setStatusDto } from './dto/user.dto.js'
import type { UserService } from './user.service.js'

export class UserController {
  constructor(private readonly users: UserService) {}

  list = async (req: Request, res: Response) => {
    const params = paginationQuery.parse(req.query)
    res.json(await this.users.list(params))
  }

  get = async (req: Request, res: Response) => {
    res.json({ user: await this.users.get(String(req.params.id)) })
  }

  update = async (req: Request, res: Response) => {
    const dto = updateUserDto.parse(req.body)
    await this.users.update(String(req.params.id), dto)
    res.status(204).end()
  }

  setStatus = async (req: Request, res: Response) => {
    const { status } = setStatusDto.parse(req.body)
    await this.users.setStatus(String(req.params.id), status)
    res.status(204).end()
  }

  unlock = async (req: Request, res: Response) => {
    await this.users.unlock(String(req.params.id))
    res.status(204).end()
  }

  passwordReset = async (req: Request, res: Response) => {
    await this.users.triggerPasswordReset(String(req.params.id))
    res.status(204).end()
  }
}
```

- [ ] **Step 2: Rotas**

`server/modules/users/user.routes.ts`:

```ts
import { Router, type RequestHandler } from 'express'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import type { UserController } from './user.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

/** Montado em /api/admin. Leitura exige users:read; mutações exigem users:manage. */
export function makeUserAdminRoutes(
  controller: UserController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const read = requirePermission('users:read')
  const manage = requirePermission('users:manage')
  r.get('/users', wrap(requireAuth), read, wrap(controller.list))
  r.get('/users/:id', wrap(requireAuth), read, wrap(controller.get))
  r.patch('/users/:id', wrap(requireAuth), manage, requireCsrf, wrap(controller.update))
  r.patch('/users/:id/status', wrap(requireAuth), manage, requireCsrf, wrap(controller.setStatus))
  r.post('/users/:id/unlock', wrap(requireAuth), manage, requireCsrf, wrap(controller.unlock))
  r.post('/users/:id/password-reset', wrap(requireAuth), manage, requireCsrf, wrap(controller.passwordReset))
  return r
}
```

> **Nota de roteamento:** as rotas `POST/DELETE /users/:id/roles` (US-11) vivem em `role.routes.ts` (router separado, mesmo mount `/api/admin`). Não há conflito: `/users/:id` e `/users/:id/roles` são caminhos distintos.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/modules/users/user.controller.ts server/modules/users/user.routes.ts
git commit -m "feat(users): controller + rotas admin de usuários [US-23/24]"
```

---

## Task 8: Convites — listagem paginada + revogação

**Files:**
- Modify: `server/modules/invitations/invitation.repository.ts`
- Modify: `server/modules/invitations/invitation.service.ts`
- Modify: `server/modules/invitations/invitation.controller.ts`
- Modify: `server/modules/invitations/invitation.routes.ts`

- [ ] **Step 1: Repositório — `listPending` + `revoke`**

Em `server/modules/invitations/invitation.repository.ts`, adicionar a interface da linha de listagem (após `InvitationRow`):

```ts
export interface PendingInvitationRow {
  id: string
  email: string
  role_name: string
  invited_by_name: string | null
  expires_at: Date
  created_at: Date
}
```

E os métodos dentro de `class InvitationRepository`:

```ts
  async listPending(
    { limit, offset }: { limit: number; offset: number },
  ): Promise<{ rows: PendingInvitationRow[]; total: number }> {
    const rows = await this.pool.query<PendingInvitationRow>(
      `SELECT i.id, i.email, r.name AS role_name, u.name AS invited_by_name,
              i.expires_at, i.created_at
         FROM invitations i
         JOIN roles r      ON r.id = i.role_id
         LEFT JOIN users u ON u.id = i.invited_by
        WHERE i.status = 'pending'
        ORDER BY i.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    )
    const count = await this.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM invitations WHERE status = 'pending'`,
    )
    return { rows: rows.rows, total: count.rows[0].count }
  }

  /** Revoga um convite pendente. Retorna false se não havia pendente com esse id. */
  async revoke(id: string): Promise<boolean> {
    const r = await this.pool.query(
      `UPDATE invitations SET status = 'revoked' WHERE id = $1 AND status = 'pending'`,
      [id],
    )
    return r.rowCount === 1
  }
```

- [ ] **Step 2: Service — `listPending` + `revoke`**

Em `server/modules/invitations/invitation.service.ts`, adicionar os imports no topo:

```ts
import { NotFoundError } from '../../core/errors.js'
import { paginate, type Paginated } from '../../core/pagination.js'
import type { PendingInvitationRow } from './invitation.repository.js'
```

> Se `ConflictError`/`ValidationError`/`BadRequestError` já vêm de `../../core/errors.js`, apenas acrescente `NotFoundError` à lista de imports existente em vez de duplicar a linha.

E os métodos dentro de `class InvitationService`:

```ts
  async listPending(params: { page: number; limit: number }): Promise<Paginated<PendingInvitationRow>> {
    const offset = (params.page - 1) * params.limit
    const { rows, total } = await this.invitations.listPending({ limit: params.limit, offset })
    return paginate(rows, total, params)
  }

  async revoke(id: string): Promise<void> {
    const ok = await this.invitations.revoke(id)
    if (!ok) throw new NotFoundError('Convite pendente não encontrado.')
  }
```

- [ ] **Step 3: Controller — `list` + `revoke`**

Em `server/modules/invitations/invitation.controller.ts`, adicionar o import:

```ts
import { paginationQuery } from '../../core/pagination.js'
```

E os métodos dentro de `class InvitationController`:

```ts
  list = async (req: Request, res: Response) => {
    const params = paginationQuery.parse(req.query)
    res.json(await this.invitations.listPending(params))
  }

  revoke = async (req: Request, res: Response) => {
    await this.invitations.revoke(String(req.params.id))
    res.status(204).end()
  }
```

- [ ] **Step 4: Rotas admin — registrar os endpoints**

Em `server/modules/invitations/invitation.routes.ts`, dentro de `makeInvitationAdminRoutes`, adicionar (após o `r.post('/invitations', ...)` existente):

```ts
  r.get(
    '/invitations',
    wrap(requireAuth),
    requirePermission('users:invite'),
    wrap(controller.list),
  )
  r.delete(
    '/invitations/:id',
    wrap(requireAuth),
    requirePermission('users:invite'),
    requireCsrf,
    wrap(controller.revoke),
  )
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/modules/invitations/
git commit -m "feat(invitations): listar pendentes (paginado) + revogar [US-25]"
```

---

## Task 9: Composition root + montagem das rotas de usuários

**Files:**
- Modify: `server/container.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Wiring no container**

Em `server/container.ts`, adicionar os imports (junto aos demais do bloco administrativo):

```ts
import { UserService } from './modules/users/user.service.js'
import { UserController } from './modules/users/user.controller.js'
import { makeUserAdminRoutes } from './modules/users/user.routes.js'
```

E, no bloco "Área administrativa" (após a criação de `invitationController`/`roleRoutes`), adicionar:

```ts
const userService = new UserService(userRepo, permissionRepo, refreshRepo, authService)
const userController = new UserController(userService)
export const userRoutes = makeUserAdminRoutes(userController, requireAuth, requirePermission)
```

> `userRepo`, `permissionRepo`, `refreshRepo`, `authService`, `requireAuth` e `requirePermission` já existem no `container.ts` — apenas reutilizar.

- [ ] **Step 2: Montar no index**

Em `server/index.ts`, acrescentar `userRoutes` ao import do container:

```ts
import {
  authRoutes, roleRoutes, invitationAdminRoutes, invitationPublicRoutes, settingsRoutes, userRoutes, bootstrap,
} from './container.js'
```

> Ajuste a lista conforme o import atual do arquivo — o ponto é **acrescentar `userRoutes`**, mantendo os demais.

E, junto aos outros `app.use('/api/admin', ...)`, adicionar:

```ts
app.use('/api/admin', userRoutes)
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Validar boot + rota protegida**

Run: `docker compose up -d db mailpit && npm run dev:server`
Expected: server sobe sem erro. Em outro terminal:

```bash
curl -i http://localhost:3001/api/admin/users
```
Expected: `401 Unauthorized` (sem cookie) — confirma que `/api/admin/users` está montado e protegido por `requireAuth`. Parar o server depois.

- [ ] **Step 5: Commit**

```bash
git add server/container.ts server/index.ts
git commit -m "feat(admin): monta /api/admin/users (UserService) [US-23/24]"
```

---

## Task 10: Validação manual do backend (curl + Mailpit)

Sem testes automatizados. Validar os endpoints novos autenticado como admin. Pré-requisitos: `docker compose up -d db mailpit`, `.env` com `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, `npm run dev:server`.

> **Dica:** obtenha cookies fazendo login e salvando o cookie jar:
> `curl -i -c jar.txt http://localhost:3001/api/auth/csrf` então
> `curl -i -b jar.txt -c jar.txt -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -H "X-CSRF-Token: <csrf do cookie>" -d '{"email":"<admin>","password":"<senha>"}'`. Reuse `-b jar.txt` nas chamadas seguintes.

- [ ] **US-23 listar:** `curl -b jar.txt 'http://localhost:3001/api/admin/users?page=1&limit=10'` → `200` com `{ data:[...], pagination:{...} }`; cada item tem `roles`.
- [ ] **US-23 paginação inválida:** `...?page=0` → `422`.
- [ ] **US-24 detalhe:** `curl -b jar.txt http://localhost:3001/api/admin/users/<id>` → `200`; id inexistente → `404`.
- [ ] **US-24 editar e-mail duplicado:** `PATCH /api/admin/users/<id>` com o e-mail de outro usuário → `409`.
- [ ] **US-24 desativar último admin:** havendo só um admin, `PATCH /api/admin/users/<adminId>/status` com `{"status":"disabled"}` → `409`.
- [ ] **US-24 desbloquear/reset:** `POST /api/admin/users/<id>/unlock` → `204`; `POST /api/admin/users/<id>/password-reset` → `204` e e-mail de reset no Mailpit (se a conta estiver ativa).
- [ ] **US-25 convites:** `GET /api/admin/invitations` → `200` paginado; criar um convite (US-06), confirmar que aparece; `DELETE /api/admin/invitations/<id>` → `204` e some dos pendentes; repetir o `DELETE` → `404`.
- [ ] **US-26 /me:** `GET /api/auth/me` → inclui `permissions: [...]` com `users:read`, `users:invite`, `users:manage`, `roles:assign`.

(Tarefa de verificação — sem commit, salvo ajustes pontuais.)

---

## Task 11: Frontend — `AuthContext` com permissões + `RequirePermission`

**Files:**
- Modify: `src/auth/AuthContext.tsx`
- Create: `src/auth/RequirePermission.tsx`

- [ ] **Step 1: Expor `permissions` + `hasPermission`**

Em `src/auth/AuthContext.tsx`, atualizar a interface `User`, o tipo `AuthCtx` e o `Provider`:

```tsx
interface User { id: string; name: string; email: string; roles?: string[]; permissions?: string[] }
interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (key: string) => boolean
}
```

E, dentro do `AuthProvider`, antes do `return`, adicionar o helper e incluí-lo no value:

```tsx
  const hasPermission = (key: string) => !!user?.permissions?.includes(key)

  return <Ctx.Provider value={{ user, loading, login, logout, hasPermission }}>{children}</Ctx.Provider>
```

- [ ] **Step 2: Wrapper de rota por permissão**

`src/auth/RequirePermission.tsx`:

```tsx
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext.js'

/** Esconde a tela quando falta a permissão. A barreira real é o backend (requirePermission/403). */
export function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { hasPermission } = useAuth()
  if (!hasPermission(perm)) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark mb-2">Sem acesso</h1>
        <p className="text-gray-700">Você não tem permissão para acessar esta área.</p>
      </div>
    )
  }
  return <>{children}</>
}
```

- [ ] **Step 3: Build (typecheck frontend)**

Run: `npm run build`
Expected: conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/auth/AuthContext.tsx src/auth/RequirePermission.tsx
git commit -m "feat(painel): permissions no AuthContext + RequirePermission [US-26]"
```

---

## Task 12: Frontend — menu filtra por permissão

**Files:**
- Modify: `src/painel/nav-config.tsx`
- Modify: `src/painel/Sidebar.tsx`

- [ ] **Step 1: Tipos com `perm`, remover "Papéis"**

Em `src/painel/nav-config.tsx`, adicionar `perm?: string` aos tipos e tirar o leaf "Papéis":

```tsx
export interface NavLeaf { label: string; to: string }
export interface NavGroup { key: string; label: string; icon: ReactNode; perm?: string; children: NavLeaf[] }
export interface NavItem { key: string; label: string; icon: ReactNode; to: string; perm?: string }
```

E o grupo "Usuários" (sem o leaf Papéis, com `perm`):

```tsx
  {
    key: 'usuarios', label: 'Usuários', icon: icon(I.users), perm: 'users:read', children: [
      { label: 'Lista', to: '/painel/usuarios' },
      { label: 'Convites', to: '/painel/usuarios/convites' },
    ],
  },
```

- [ ] **Step 2: Sidebar filtra entradas por permissão**

Em `src/painel/Sidebar.tsx`, importar `useAuth` (já importado) e filtrar o `NAV` antes do `.map`. Logo após `const { logout } = useAuth()`, trocar para:

```tsx
  const { logout, hasPermission } = useAuth()
```

E, dentro do `<nav>`, trocar `{NAV.map(entry => {` por uma lista filtrada:

```tsx
        {NAV.filter(e => !e.perm || hasPermission(e.perm)).map(entry => {
```

> `perm` existe tanto em `NavItem` quanto em `NavGroup`; entradas sem `perm` (Dashboard, Conteúdo, Configurações) seguem sempre visíveis nesta entrega.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/painel/nav-config.tsx src/painel/Sidebar.tsx
git commit -m "feat(painel): menu sem 'Papéis' e filtrado por permissão [US-26]"
```

---

## Task 13: Frontend — UI compartilhada (schemas, Modal, Pager, usePagination)

**Files:**
- Create: `src/schemas/usuarios.ts`
- Create: `src/painel/components/Modal.tsx`
- Create: `src/painel/components/Pager.tsx`
- Create: `src/painel/usePagination.ts`

- [ ] **Step 1: Schemas (espelham o server — convenção do CLAUDE.md)**

`src/schemas/usuarios.ts`:

```ts
import { z } from 'zod'

export const editarUsuarioSchema = z.object({
  name: z.string().min(1, 'Informe o nome').max(120),
  email: z.string().email('E-mail inválido'),
})
export type EditarUsuarioForm = z.infer<typeof editarUsuarioSchema>

export const convidarSchema = z.object({
  email: z.string().email('E-mail inválido'),
  roleKey: z.string().min(1, 'Escolha um papel'),
})
export type ConvidarForm = z.infer<typeof convidarSchema>
```

- [ ] **Step 2: Modal**

`src/painel/components/Modal.tsx`:

```tsx
import type { ReactNode } from 'react'

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold text-iasd-dark">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-gray-800">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: usePagination**

`src/painel/usePagination.ts`:

```ts
import { useState } from 'react'

export function usePagination(initialLimit = 20) {
  const [page, setPage] = useState(1)
  const [limit] = useState(initialLimit)
  return { page, limit, setPage }
}

export interface PageInfo { page: number; limit: number; total: number; totalPages: number }
```

- [ ] **Step 4: Pager**

`src/painel/components/Pager.tsx`:

```tsx
import type { PageInfo } from '../usePagination'

export default function Pager({ info, onPage }: { info: PageInfo; onPage: (p: number) => void }) {
  if (info.totalPages <= 1) return null
  const btn = 'px-3 py-1 rounded border text-sm disabled:opacity-50'
  return (
    <div className="flex items-center gap-3 mt-4">
      <button className={btn} disabled={info.page <= 1} onClick={() => onPage(info.page - 1)}>Anterior</button>
      <span className="text-sm text-gray-600">página {info.page} de {info.totalPages}</span>
      <button className={btn} disabled={info.page >= info.totalPages} onClick={() => onPage(info.page + 1)}>Próxima</button>
    </div>
  )
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: conclui sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/schemas/usuarios.ts src/painel/components/Modal.tsx src/painel/components/Pager.tsx src/painel/usePagination.ts
git commit -m "feat(painel): UI compartilhada (schemas, Modal, Pager, usePagination) [US-23/24/25]"
```

---

## Task 14: Frontend — Lista de usuários + modal de papéis

**Files:**
- Create: `src/painel/components/RolesModal.tsx`
- Create: `src/painel/pages/UsuariosLista.tsx`

- [ ] **Step 1: RolesModal**

`src/painel/components/RolesModal.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import Modal from './Modal'

interface Role { id: string; key: string; name: string }

export default function RolesModal(
  { userId, userName, current, onClose, onChanged }:
  { userId: string; userName: string; current: string[]; onClose: () => void; onChanged: () => void },
) {
  const [roles, setRoles] = useState<Role[]>([])
  const [mine, setMine] = useState<string[]>(current) // keys
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      const res = await adminFetch('/roles')
      if (res.ok) setRoles((await res.json()).roles)
    })()
  }, [])

  async function add(role: Role) {
    setErr('')
    const res = await adminFetch(`/users/${userId}/roles`, { method: 'POST', body: JSON.stringify({ roleId: role.id }) })
    if (res.ok) { setMine(prev => [...new Set([...prev, role.key])]); onChanged() }
    else setErr('Não foi possível adicionar o papel.')
  }

  async function remove(role: Role) {
    setErr('')
    const res = await adminFetch(`/users/${userId}/roles/${role.id}`, { method: 'DELETE' })
    if (res.ok) { setMine(prev => prev.filter(k => k !== role.key)); onChanged() }
    else if (res.status === 409) setErr('Bloqueado: o sistema ficaria sem administrador.')
    else setErr('Não foi possível remover o papel.')
  }

  const available = roles.filter(r => !mine.includes(r.key))

  return (
    <Modal title={`Papéis — ${userName}`} onClose={onClose}>
      {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
      <div className="flex flex-wrap gap-2 mb-4">
        {mine.length === 0 && <span className="text-sm text-gray-500">Nenhum papel.</span>}
        {roles.filter(r => mine.includes(r.key)).map(r => (
          <span key={r.id} className="inline-flex items-center gap-1 bg-iasd-light border rounded-full px-3 py-1 text-sm">
            {r.name}
            <button onClick={() => remove(r)} aria-label={`Remover ${r.name}`} className="text-gray-500 hover:text-red-600">✕</button>
          </span>
        ))}
      </div>
      {available.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-sm mb-2">Adicionar papel:</p>
          <div className="flex flex-wrap gap-2">
            {available.map(r => (
              <button key={r.id} onClick={() => add(r)}
                className="border border-iasd-dark text-iasd-dark rounded-full px-3 py-1 text-sm hover:bg-gray-100">
                + {r.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
```

- [ ] **Step 2: Página de lista**

`src/painel/pages/UsuariosLista.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import Pager from '@/painel/components/Pager'
import RolesModal from '@/painel/components/RolesModal'

interface Row { id: string; name: string; email: string; status: 'active' | 'disabled'; roles: string[]; last_login_at: string | null }

export default function UsuariosLista() {
  const { page, limit, setPage } = usePagination()
  const [rows, setRows] = useState<Row[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [editing, setEditing] = useState<Row | null>(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    await ensureCsrf()
    const res = await adminFetch(`/users?page=${page}&limit=${limit}`)
    if (res.ok) {
      const body = await res.json()
      setRows(body.data)
      setInfo(body.pagination)
    }
  }, [page, limit])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark">Usuários</h1>
        <Link to="/painel/usuarios/convites"
          className="bg-iasd-dark text-white rounded px-4 py-2 text-sm hover:bg-iasd-accent transition">Convidar</Link>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Papéis</th>
              <th className="px-4 py-2">Último login</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2">
                  <button onClick={() => navigate(`/painel/usuarios/${u.id}`)} className="text-iasd-accent hover:underline">{u.name}</button>
                </td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs rounded-full px-2 py-0.5 ${u.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                    {u.status === 'active' ? 'ativo' : 'desativado'}
                  </span>
                </td>
                <td className="px-4 py-2">{u.roles.join(', ') || '—'}</td>
                <td className="px-4 py-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('pt-BR') : '—'}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setEditing(u)} className="text-iasd-dark hover:underline">Gerenciar papéis</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Nenhum usuário.</td></tr>}
          </tbody>
        </table>
      </div>

      {info && <Pager info={info} onPage={setPage} />}

      {editing && (
        <RolesModal userId={editing.id} userName={editing.name} current={editing.roles}
          onClose={() => setEditing(null)} onChanged={load} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/painel/pages/UsuariosLista.tsx src/painel/components/RolesModal.tsx
git commit -m "feat(painel): lista de usuários + modal de papéis [US-23]"
```

---

## Task 15: Frontend — Detalhe do usuário

**Files:**
- Create: `src/painel/pages/UsuarioDetalhe.tsx`

- [ ] **Step 1: Página de detalhe**

`src/painel/pages/UsuarioDetalhe.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, Link } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { editarUsuarioSchema, type EditarUsuarioForm } from '@/schemas/usuarios'
import RolesModal from '@/painel/components/RolesModal'

interface Detail {
  id: string; name: string; email: string; status: 'active' | 'disabled'
  roles: string[]; last_login_at: string | null; created_at: string
  failed_login_count: number; locked_until: string | null
}

export default function UsuarioDetalhe() {
  const { id = '' } = useParams()
  const [user, setUser] = useState<Detail | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [showRoles, setShowRoles] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<EditarUsuarioForm>({ resolver: zodResolver(editarUsuarioSchema) })

  const load = useCallback(async () => {
    await ensureCsrf()
    const res = await adminFetch(`/users/${id}`)
    if (res.ok) {
      const u: Detail = (await res.json()).user
      setUser(u)
      reset({ name: u.name, email: u.email })
    } else if (res.status === 404) {
      setMsg({ kind: 'err', text: 'Usuário não encontrado.' })
    }
  }, [id, reset])

  useEffect(() => { load() }, [load])

  async function onSubmit(data: EditarUsuarioForm) {
    setMsg(null)
    const res = await adminFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
    if (res.ok) { setMsg({ kind: 'ok', text: 'Dados salvos.' }); load() }
    else if (res.status === 409) setMsg({ kind: 'err', text: 'E-mail já usado por outro usuário.' })
    else setMsg({ kind: 'err', text: 'Não foi possível salvar.' })
  }

  async function act(path: string, okText: string, body?: unknown) {
    setMsg(null)
    const res = await adminFetch(path, { method: path.endsWith('/status') ? 'PATCH' : 'POST', body: body ? JSON.stringify(body) : undefined })
    if (res.ok) { setMsg({ kind: 'ok', text: okText }); load() }
    else if (res.status === 409) setMsg({ kind: 'err', text: 'Bloqueado: o sistema ficaria sem administrador.' })
    else setMsg({ kind: 'err', text: 'Operação não permitida.' })
  }

  if (!user) {
    return (
      <div className="max-w-lg">
        {msg && <p className="text-red-600 text-sm">{msg.text}</p>}
        <Link to="/painel/usuarios" className="text-iasd-accent hover:underline">← Voltar</Link>
      </div>
    )
  }

  const field = 'w-full border rounded px-3 py-2'
  const locked = user.locked_until && new Date(user.locked_until) > new Date()

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link to="/painel/usuarios" className="text-iasd-accent hover:underline text-sm">← Voltar</Link>
        <h1 className="text-2xl font-heading font-bold text-iasd-dark mt-1">{user.name}</h1>
        <p className="text-sm text-gray-500">Criado em {new Date(user.created_at).toLocaleString('pt-BR')} ·
          Último login {user.last_login_at ? new Date(user.last_login_at).toLocaleString('pt-BR') : '—'}</p>
      </div>

      {msg && <p className={msg.kind === 'ok' ? 'text-green-700 text-sm' : 'text-red-600 text-sm'}>{msg.text}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Nome</label>
          <input {...register('name')} className={field} />
          {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm mb-1">E-mail</label>
          <input {...register('email')} className={field} />
          {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition disabled:opacity-60">Salvar</button>
      </form>

      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Papéis: <strong>{user.roles.join(', ') || '—'}</strong></span>
          <button onClick={() => setShowRoles(true)} className="text-iasd-dark hover:underline text-sm">Gerenciar papéis</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => act(`/users/${id}/status`, user.status === 'active' ? 'Conta desativada.' : 'Conta reativada.', { status: user.status === 'active' ? 'disabled' : 'active' })}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-100">
            {user.status === 'active' ? 'Desativar conta' : 'Reativar conta'}
          </button>
          <button onClick={() => act(`/users/${id}/unlock`, 'Conta desbloqueada.')} disabled={!locked}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50">Desbloquear</button>
          <button onClick={() => act(`/users/${id}/password-reset`, 'E-mail de redefinição enviado.')}
            className="border rounded px-4 py-2 text-sm hover:bg-gray-100">Enviar redefinição de senha</button>
        </div>
      </div>

      {showRoles && (
        <RolesModal userId={user.id} userName={user.name} current={user.roles}
          onClose={() => setShowRoles(false)} onChanged={load} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: conclui sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/painel/pages/UsuarioDetalhe.tsx
git commit -m "feat(painel): página de detalhe do usuário [US-24]"
```

---

## Task 16: Frontend — Tela de convites

**Files:**
- Create: `src/painel/pages/Convites.tsx`

- [ ] **Step 1: Página de convites**

`src/painel/pages/Convites.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { convidarSchema, type ConvidarForm } from '@/schemas/usuarios'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import Pager from '@/painel/components/Pager'

interface Role { id: string; key: string; name: string }
interface Pending { id: string; email: string; role_name: string; invited_by_name: string | null; expires_at: string }

export default function Convites() {
  const { page, limit, setPage } = usePagination()
  const [roles, setRoles] = useState<Role[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<ConvidarForm>({ resolver: zodResolver(convidarSchema) })

  const loadPending = useCallback(async () => {
    const res = await adminFetch(`/invitations?page=${page}&limit=${limit}`)
    if (res.ok) { const b = await res.json(); setPending(b.data); setInfo(b.pagination) }
  }, [page, limit])

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      const res = await adminFetch('/roles')
      if (res.ok) setRoles((await res.json()).roles)
      await loadPending()
    })()
  }, [loadPending])

  async function onInvite(data: ConvidarForm) {
    setMsg(null)
    const res = await adminFetch('/invitations', { method: 'POST', body: JSON.stringify(data) })
    if (res.ok) { setMsg({ kind: 'ok', text: 'Convite enviado.' }); reset({ email: '', roleKey: '' }); loadPending() }
    else if (res.status === 409) setMsg({ kind: 'err', text: 'Já existe um usuário com este e-mail.' })
    else setMsg({ kind: 'err', text: 'Não foi possível convidar.' })
  }

  async function revoke(id: string) {
    setMsg(null)
    const res = await adminFetch(`/invitations/${id}`, { method: 'DELETE' })
    if (res.ok) loadPending()
    else setMsg({ kind: 'err', text: 'Não foi possível revogar.' })
  }

  async function resend(email: string, roleName: string) {
    const role = roles.find(r => r.name === roleName)
    if (!role) return
    setMsg(null)
    const res = await adminFetch('/invitations', { method: 'POST', body: JSON.stringify({ email, roleKey: role.key }) })
    if (res.ok) { setMsg({ kind: 'ok', text: 'Convite reenviado.' }); loadPending() }
    else setMsg({ kind: 'err', text: 'Não foi possível reenviar.' })
  }

  const field = 'w-full border rounded px-3 py-2'

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-heading font-bold text-iasd-dark">Convites</h1>
      {msg && <p className={msg.kind === 'ok' ? 'text-green-700 text-sm' : 'text-red-600 text-sm'}>{msg.text}</p>}

      <form onSubmit={handleSubmit(onInvite)} className="max-w-lg space-y-4 border rounded-lg p-4">
        <h2 className="font-heading font-bold text-iasd-dark">Convidar pessoa</h2>
        <div>
          <label className="block text-sm mb-1">E-mail</label>
          <input {...register('email')} className={field} placeholder="pessoa@exemplo.com" />
          {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm mb-1">Papel</label>
          <select {...register('roleKey')} className={field} defaultValue="">
            <option value="" disabled>Selecione…</option>
            {roles.map(r => <option key={r.id} value={r.key}>{r.name}</option>)}
          </select>
          {errors.roleKey && <p className="text-red-600 text-xs mt-1">{errors.roleKey.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition disabled:opacity-60">Enviar convite</button>
      </form>

      <div>
        <h2 className="font-heading font-bold text-iasd-dark mb-3">Pendentes</h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Papel</th>
                <th className="px-4 py-2">Convidado por</th>
                <th className="px-4 py-2">Expira</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2">{p.email}</td>
                  <td className="px-4 py-2">{p.role_name}</td>
                  <td className="px-4 py-2">{p.invited_by_name ?? '—'}</td>
                  <td className="px-4 py-2">{new Date(p.expires_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2 text-right space-x-3">
                    <button onClick={() => resend(p.email, p.role_name)} className="text-iasd-dark hover:underline">Reenviar</button>
                    <button onClick={() => revoke(p.id)} className="text-red-600 hover:underline">Revogar</button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Nenhum convite pendente.</td></tr>}
            </tbody>
          </table>
        </div>
        {info && <Pager info={info} onPage={setPage} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: conclui sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/painel/pages/Convites.tsx
git commit -m "feat(painel): tela de convites (convidar/listar/revogar/reenviar) [US-25]"
```

---

## Task 17: Frontend — rotas no App protegidas por permissão

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Imports**

Em `src/App.tsx`, adicionar junto aos imports do painel:

```tsx
import UsuariosLista from './painel/pages/UsuariosLista'
import UsuarioDetalhe from './painel/pages/UsuarioDetalhe'
import Convites from './painel/pages/Convites'
import { RequirePermission } from './auth/RequirePermission'
```

- [ ] **Step 2: Rotas filhas do painel**

Em `src/App.tsx`, dentro do bloco `<Route path="/painel" ...>`, adicionar **antes** do catch-all `<Route path="*" element={<EmBreve />} />`:

```tsx
          <Route path="usuarios" element={<RequirePermission perm="users:read"><UsuariosLista /></RequirePermission>} />
          <Route path="usuarios/convites" element={<RequirePermission perm="users:invite"><Convites /></RequirePermission>} />
          <Route path="usuarios/:id" element={<RequirePermission perm="users:read"><UsuarioDetalhe /></RequirePermission>} />
```

> Ordem importa: `usuarios/convites` antes de `usuarios/:id` para o caminho literal não ser capturado pelo param.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(painel): rotas de usuários protegidas por permissão [US-23/24/25/26]"
```

---

## Task 18: Validação manual ponta-a-ponta (browser)

Pré-requisitos: `docker compose up -d db mailpit`; backend `npm run dev:server`; frontend `npm run dev`; logado no painel como admin; Mailpit em http://localhost:8025.

- [ ] **US-23:** `/painel/usuarios` lista os usuários com nome/e-mail/status/papéis/último login; o pager navega entre páginas (criar usuários extras via convites se necessário); "Gerenciar papéis" abre o modal, adiciona/remove (idempotente) e a linha reflete; remover o último papel admin do último admin mostra o aviso de bloqueio (`409`).
- [ ] **US-24:** abrir um usuário; editar nome/e-mail e salvar; e-mail de outro usuário → aviso de conflito; "Desativar conta" muda o status (e, ao reabrir o painel daquele usuário em outra sessão, ele cai); "Desbloquear" habilitado só quando há lockout; "Enviar redefinição de senha" gera e-mail no Mailpit; desativar o último admin → aviso de bloqueio.
- [ ] **US-25:** convidar pela tela (e-mail no Mailpit; e-mail já cadastrado → aviso); o convite aparece em "Pendentes"; "Reenviar" gera novo e-mail; "Revogar" remove da lista e o link de aceite antigo deixa de funcionar.
- [ ] **US-26:** `GET /api/auth/me` traz `permissions`; com o papel admin, "Usuários" aparece e as rotas abrem; simular um papel sem `users:read` (inserir linhas em `roles`/`role_permissions`, atribuir a um usuário de teste, relogar) → item "Usuários" some do menu e o acesso direto a `/painel/usuarios` mostra "Sem acesso", enquanto a API responde `403`.
- [ ] **Commit final (se houver ajustes):**

```bash
git add -A
git commit -m "chore(painel): ajustes da validação manual da administração de usuários"
```

---

## Pós-implementação

- [ ] Atualizar `docs/historias/README.md`: marcar **US-23, US-24, US-25, US-26** como ✅ com os commits principais.
- [ ] Comentar/fechar a [issue #8](https://github.com/robertogabrieu/iasd-tucuruvi/issues/8) referenciando os commits do épico.
- [ ] Usar superpowers:finishing-a-development-branch para decidir merge/PR.
