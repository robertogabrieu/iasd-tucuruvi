# Painel — Gestão de Papéis e Permissões — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a tela `/painel/usuarios/papeis` e os endpoints `/api/admin` para CRUD de papéis e edição do vínculo papel↔permissão (US-27, US-28), com o papel `admin` protegido.

**Architecture:** Estende o módulo `roles` (arquitetura em camadas `routes → controller → service → repository → db`). Nova permissão `roles:manage`. Permissões seguem o catálogo de código; a UI só vincula/desvincula as existentes. O `GET /api/admin/roles` atual (perm `roles:assign`, usado pelos seletores) fica intocado; os endpoints de gestão entram na mesma factory `makeRoleAdminRoutes` sob `roles:manage`. Spec: [`docs/superpowers/specs/2026-06-15-painel-papeis-permissoes-design.md`](../specs/2026-06-15-painel-papeis-permissoes-design.md).

**Tech Stack:** Express 5 (ESM, imports com sufixo `.js`), PostgreSQL 16 (`pg`), Zod v4, React 18 + React Router v7 + React Hook Form + Zod.

> **Convenção de verificação deste projeto:** **sem suíte de testes automatizada** (CLAUDE.md — "validação manual no browser"). Cada tarefa verifica com **typecheck** (`npx tsc -p tsconfig.server.json --noEmit`) no backend e **`npm run build`** no frontend, mais validação manual em runtime quando aplicável. Não adicionar testes.

---

## Mapa de arquivos

**Criar (backend):**
- `server/modules/roles/role.utils.ts` — `slugify(name)` (função pura).

**Modificar (backend):**
- `server/seed/permissions.catalog.ts` — `+roles:manage`.
- `server/modules/authz/permission.repository.ts` — `+listCatalog()`.
- `server/modules/roles/role.repository.ts` — `findById`, `create`, `rename`, `deleteRole`, `countUsers`, `listForManagement`, `setPermissions`.
- `server/modules/roles/dto/role.dto.ts` — `createRoleDto`, `renameRoleDto`, `setPermissionsDto`.
- `server/modules/roles/role.service.ts` — `listManaged`, `listPermissionCatalog`, `createRole`, `renameRole`, `deleteRole`, `setPermissions` (+ proteção do `admin`).
- `server/modules/roles/role.controller.ts` — `listManaged`, `listPermissions`, `create`, `rename`, `remove?`/`deleteRole`, `setPermissions`.
- `server/modules/roles/role.routes.ts` — rotas novas sob `roles:manage`.

**Criar (frontend):**
- `src/schemas/papeis.ts` — schemas Zod.
- `src/painel/components/RoleEditModal.tsx` — modal de edição (nome + permissões + excluir).
- `src/painel/pages/Papeis.tsx` — tela de papéis.

**Modificar (frontend):**
- `src/painel/nav-config.tsx` — reintroduz o leaf "Papéis".
- `src/App.tsx` — rota `usuarios/papeis` protegida por `roles:manage`.

> **Sem mudança em `container.ts`/`index.ts`:** `RoleService`/`RoleController`/`roleRoutes` já estão instanciados e montados; o construtor do `RoleService` já recebe `(roleRepo, userRepo, permissionRepo)`.

---

## Task 1: Permissão `roles:manage` + catálogo no repositório

**Files:**
- Modify: `server/seed/permissions.catalog.ts`
- Modify: `server/modules/authz/permission.repository.ts`

- [ ] **Step 1: Adicionar a permissão ao catálogo**

Em `server/seed/permissions.catalog.ts`, adicionar ao array `PERMISSIONS` (após `users:manage`):

```ts
  { key: 'roles:manage', description: 'Criar/editar papéis e suas permissões' },
```

- [ ] **Step 2: Listar o catálogo no `PermissionRepository`**

Em `server/modules/authz/permission.repository.ts`, adicionar dentro de `class PermissionRepository`:

```ts
  /** Catálogo de permissões (referência fixa) para a UI de papéis. */
  async listCatalog(): Promise<{ key: string; description: string }[]> {
    const r = await this.pool.query<{ key: string; description: string }>(
      'SELECT key, description FROM permissions ORDER BY key',
    )
    return r.rows
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/seed/permissions.catalog.ts server/modules/authz/permission.repository.ts
git commit -m "feat(authz): permissão roles:manage + listCatalog [US-27/28]"
```

---

## Task 2: `role.utils.ts` (slug) + extensões do `RoleRepository`

**Files:**
- Create: `server/modules/roles/role.utils.ts`
- Modify: `server/modules/roles/role.repository.ts`

- [ ] **Step 1: Util de slug**

`server/modules/roles/role.utils.ts`:

```ts
/** Gera uma chave (slug) a partir do nome: minúsculas, sem acento, não-alfanumérico → '-'. */
export function slugify(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'papel'
}
```

- [ ] **Step 2: Métodos novos no `RoleRepository`**

Em `server/modules/roles/role.repository.ts`, adicionar dentro de `class RoleRepository`. (Importar `withTransaction` no topo: `import { withTransaction } from '../../core/db.js'`.)

```ts
  async findById(id: string): Promise<RoleRow | null> {
    const r = await this.pool.query<RoleRow>('SELECT id, key, name FROM roles WHERE id = $1', [id])
    return r.rows[0] ?? null
  }

  async create(key: string, name: string): Promise<RoleRow> {
    const r = await this.pool.query<RoleRow>(
      'INSERT INTO roles (key, name) VALUES ($1, $2) RETURNING id, key, name',
      [key, name],
    )
    return r.rows[0]
  }

  async rename(id: string, name: string): Promise<void> {
    await this.pool.query('UPDATE roles SET name = $2 WHERE id = $1', [id, name])
  }

  async deleteRole(id: string): Promise<void> {
    await this.pool.query('DELETE FROM roles WHERE id = $1', [id]) // cascade limpa role_permissions/user_roles
  }

  async countUsers(roleId: string): Promise<number> {
    const r = await this.pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM user_roles WHERE role_id = $1', [roleId],
    )
    return r.rows[0].count
  }

  async listForManagement(): Promise<{ id: string; key: string; name: string; permissions: string[]; user_count: number }[]> {
    const r = await this.pool.query<{ id: string; key: string; name: string; permissions: string[]; user_count: number }>(
      `SELECT r.id, r.key, r.name,
              COALESCE(array_remove(array_agg(DISTINCT p.key), NULL), '{}') AS permissions,
              (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
         FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         LEFT JOIN permissions p       ON p.id = rp.permission_id
        GROUP BY r.id
        ORDER BY r.name`,
    )
    return r.rows
  }

  /** Substitui o conjunto de permissões do papel (em transação). */
  async setPermissions(roleId: string, keys: string[]): Promise<void> {
    await withTransaction(async (tx) => {
      await tx.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId])
      if (keys.length > 0) {
        await tx.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, id FROM permissions WHERE key = ANY($2::text[])`,
          [roleId, keys],
        )
      }
    })
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/modules/roles/role.utils.ts server/modules/roles/role.repository.ts
git commit -m "feat(roles): slug util + extensões do RoleRepository (CRUD + setPermissions) [US-27/28]"
```

---

## Task 3: DTOs de papel

**Files:**
- Modify: `server/modules/roles/dto/role.dto.ts`

- [ ] **Step 1: Adicionar os DTOs**

Em `server/modules/roles/dto/role.dto.ts`, acrescentar (mantendo o `assignRoleDto` existente):

```ts
export const createRoleDto = z.object({
  name: z.string().min(1, 'Informe o nome.').max(60),
})

export const renameRoleDto = z.object({
  name: z.string().min(1, 'Informe o nome.').max(60),
})

export const setPermissionsDto = z.object({
  permissionKeys: z.array(z.string()),
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/modules/roles/dto/role.dto.ts
git commit -m "feat(roles): DTOs de criar/renomear/definir permissões [US-27/28]"
```

---

## Task 4: `RoleService` — gestão de papéis + proteção do admin

**Files:**
- Modify: `server/modules/roles/role.service.ts`

- [ ] **Step 1: Imports e constante do papel protegido**

Em `server/modules/roles/role.service.ts`, ajustar os imports do topo (acrescentar `ValidationError` e o `slugify`):

```ts
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js'
import { slugify } from './role.utils.js'
```

E, abaixo da constante `ADMIN_PERMISSION`, adicionar:

```ts
// Papel-semente protegido: imutável pela UI (o seed religa todas as permissões a cada boot).
const PROTECTED_ROLE_KEY = 'admin'
```

- [ ] **Step 2: Métodos de gestão**

Adicionar dentro de `class RoleService` (ex.: após `removeRole`):

```ts
  listManaged(): Promise<{ id: string; key: string; name: string; permissions: string[]; userCount: number; protected: boolean }[]> {
    return this.roles.listForManagement().then(rows =>
      rows.map(r => ({
        id: r.id, key: r.key, name: r.name, permissions: r.permissions,
        userCount: r.user_count, protected: r.key === PROTECTED_ROLE_KEY,
      })),
    )
  }

  listPermissionCatalog(): Promise<{ key: string; description: string }[]> {
    return this.permissions.listCatalog()
  }

  async createRole(name: string): Promise<{ id: string; key: string; name: string }> {
    // Nota: colisão de nome NÃO retorna 409 — o slug recebe sufixo automático e o papel é criado
    // (Decisão 5 da spec). Não há checagem de unicidade de nome.
    let key = slugify(name)
    // Resolve colisão de chave com sufixo numérico.
    if (await this.roles.findRoleIdByKey(key)) {
      let n = 2
      while (await this.roles.findRoleIdByKey(`${key}-${n}`)) n++
      key = `${key}-${n}`
    }
    return this.roles.create(key, name)
  }

  async renameRole(id: string, name: string): Promise<void> {
    await this.ensureEditable(id)
    await this.roles.rename(id, name)
  }

  async deleteRole(id: string): Promise<void> {
    await this.ensureEditable(id)
    await this.roles.deleteRole(id)
  }

  async setPermissions(id: string, keys: string[]): Promise<void> {
    await this.ensureEditable(id)
    const catalog = new Set((await this.permissions.listCatalog()).map(p => p.key))
    const invalid = keys.filter(k => !catalog.has(k))
    if (invalid.length > 0) throw new ValidationError(`Permissão(ões) inválida(s): ${invalid.join(', ')}`)
    await this.roles.setPermissions(id, keys)
  }

  /** Garante que o papel existe e não é o protegido (admin). */
  private async ensureEditable(id: string): Promise<void> {
    const role = await this.roles.findById(id)
    if (!role) throw new NotFoundError('Papel não encontrado.')
    if (role.key === PROTECTED_ROLE_KEY) throw new ConflictError('Papel protegido: não pode ser alterado ou excluído.')
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/modules/roles/role.service.ts
git commit -m "feat(roles): RoleService de gestão (CRUD + setPermissions + proteção do admin) [US-27/28]"
```

---

## Task 5: `RoleController` + rotas sob `roles:manage`

**Files:**
- Modify: `server/modules/roles/role.controller.ts`
- Modify: `server/modules/roles/role.routes.ts`

- [ ] **Step 1: Métodos novos no controller**

Em `server/modules/roles/role.controller.ts`, ajustar o import dos DTOs e adicionar os handlers:

```ts
import { assignRoleDto, createRoleDto, renameRoleDto, setPermissionsDto } from './dto/role.dto.js'
```

E dentro de `class RoleController`:

```ts
  listManaged = async (_req: Request, res: Response) => {
    res.json({ roles: await this.roles.listManaged() })
  }

  listPermissions = async (_req: Request, res: Response) => {
    res.json({ permissions: await this.roles.listPermissionCatalog() })
  }

  create = async (req: Request, res: Response) => {
    const { name } = createRoleDto.parse(req.body)
    res.status(201).json({ role: await this.roles.createRole(name) })
  }

  rename = async (req: Request, res: Response) => {
    const { name } = renameRoleDto.parse(req.body)
    await this.roles.renameRole(String(req.params.id), name)
    res.status(204).end()
  }

  setPermissions = async (req: Request, res: Response) => {
    const { permissionKeys } = setPermissionsDto.parse(req.body)
    await this.roles.setPermissions(String(req.params.id), permissionKeys)
    res.status(204).end()
  }

  deleteRole = async (req: Request, res: Response) => {
    await this.roles.deleteRole(String(req.params.id))
    res.status(204).end()
  }
```

- [ ] **Step 2: Registrar as rotas**

Em `server/modules/roles/role.routes.ts`, dentro de `makeRoleAdminRoutes`, adicionar um middleware `manage` e as rotas **antes** do `return r` (a estática `/roles/manage` vem antes das rotas com `:id`):

```ts
  const manage = requirePermission('roles:manage')
  r.get('/permissions', wrap(requireAuth), manage, wrap(controller.listPermissions))
  r.get('/roles/manage', wrap(requireAuth), manage, wrap(controller.listManaged))
  r.post('/roles', wrap(requireAuth), manage, requireCsrf, wrap(controller.create))
  r.patch('/roles/:id', wrap(requireAuth), manage, requireCsrf, wrap(controller.rename))
  r.put('/roles/:id/permissions', wrap(requireAuth), manage, requireCsrf, wrap(controller.setPermissions))
  r.delete('/roles/:id', wrap(requireAuth), manage, requireCsrf, wrap(controller.deleteRole))
```

> O `GET /roles` (perm `roles:assign`) e as rotas `/users/:id/roles` existentes permanecem como estão. `/roles/manage` é registrada antes de `/roles/:id`, evitando captura pelo parâmetro.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Validar rotas em runtime**

Run: `docker compose up -d db && npm run dev:server` (ou reinicie seu dev:server com o env de dev).
Expected: server sobe. Em outro terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/admin/roles/manage
```
Expected: `401` (sem cookie) — confirma rota montada e protegida. Parar depois.

- [ ] **Step 5: Commit**

```bash
git add server/modules/roles/role.controller.ts server/modules/roles/role.routes.ts
git commit -m "feat(roles): rotas de gestão de papéis sob roles:manage [US-27/28]"
```

---

## Task 6: Validação manual do backend (curl)

Autenticado como admin (ver fluxo de login por curl do épico anterior). Pré: `docker compose up -d db`, dev:server no ar.

- [ ] **US-27 listar:** `GET /api/admin/roles/manage` → `200` com cada papel `{ id, key, name, permissions[], userCount, protected }` (`admin` com `protected: true` e todas as permissões).
- [ ] **US-27 criar:** `POST /api/admin/roles` `{"name":"Editor de Conteúdo"}` → `201`, `key` = `editor-de-conteudo`. Criar de novo com o mesmo nome → `key` `editor-de-conteudo-2`.
- [ ] **US-27 renomear/excluir:** `PATCH /api/admin/roles/:id` `{"name":"Editor"}` → `204`. `DELETE /api/admin/roles/:id` → `204`. Papel inexistente → `404`.
- [ ] **US-27 admin protegido:** `PATCH`/`DELETE`/`PUT permissions` no id do papel `admin` → `409`.
- [ ] **US-28 permissões:** `GET /api/admin/permissions` → catálogo; `PUT /api/admin/roles/:id/permissions` `{"permissionKeys":["users:read"]}` → `204`; reler em `/roles/manage` mostra a permissão. Chave fora do catálogo → `422`.
- [ ] **Autorização:** com um papel/usuário sem `roles:manage`, qualquer endpoint → `403`.

(Tarefa de verificação — sem commit, salvo ajustes.)

---

## Task 7: Frontend — nav + rota

**Files:**
- Modify: `src/painel/nav-config.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Reintroduzir o leaf "Papéis"**

Em `src/painel/nav-config.tsx`, no grupo `usuarios`, adicionar o leaf após "Convites":

```tsx
      { label: 'Papéis', to: '/painel/usuarios/papeis' },
```

- [ ] **Step 2: Rota protegida**

Em `src/App.tsx`, adicionar o import:

```tsx
import Papeis from './painel/pages/Papeis'
```

E a rota dentro do bloco `/painel`, junto às demais de `usuarios` e **antes** do catch-all (ordem: depois de `usuarios/:id` tudo bem, pois `papeis` é caminho literal):

```tsx
          <Route path="usuarios/papeis" element={<RequirePermission perm="roles:manage"><Papeis /></RequirePermission>} />
```

> Coloque `usuarios/papeis` **antes** de `usuarios/:id` para o literal não cair no parâmetro.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/painel/nav-config.tsx src/App.tsx
git commit -m "feat(painel): leaf e rota de Papéis (roles:manage) [US-27]"
```

---

## Task 8: Frontend — tela de Papéis + modal de edição

**Files:**
- Create: `src/schemas/papeis.ts`
- Create: `src/painel/components/RoleEditModal.tsx`
- Create: `src/painel/pages/Papeis.tsx`

- [ ] **Step 1: Schemas**

`src/schemas/papeis.ts`:

```ts
import { z } from 'zod'

export const papelNomeSchema = z.object({
  name: z.string().min(1, 'Informe o nome').max(60),
})
export type PapelNomeForm = z.infer<typeof papelNomeSchema>
```

- [ ] **Step 2: Modal de edição de papel**

`src/painel/components/RoleEditModal.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import Modal from './Modal'

interface Perm { key: string; description: string }
export interface ManagedRole { id: string; key: string; name: string; permissions: string[]; userCount: number; protected: boolean }

export default function RoleEditModal(
  { role, onClose, onChanged }: { role: ManagedRole; onClose: () => void; onChanged: () => void },
) {
  const [catalog, setCatalog] = useState<Perm[]>([])
  const [name, setName] = useState(role.name)
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions))
  const [confirmDel, setConfirmDel] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      const res = await adminFetch('/permissions')
      if (res.ok) setCatalog((await res.json()).permissions)
    })()
  }, [])

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function save() {
    setErr('')
    if (name !== role.name) {
      const res = await adminFetch(`/roles/${role.id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
      if (!res.ok) { setErr('Não foi possível renomear.'); return }
    }
    const res = await adminFetch(`/roles/${role.id}/permissions`, {
      method: 'PUT', body: JSON.stringify({ permissionKeys: [...selected] }),
    })
    if (res.ok) { onChanged(); onClose() }
    else setErr('Não foi possível salvar as permissões.')
  }

  async function remove() {
    setErr('')
    const res = await adminFetch(`/roles/${role.id}`, { method: 'DELETE' })
    if (res.ok) { onChanged(); onClose() }
    else setErr('Não foi possível excluir.')
  }

  const ro = role.protected
  return (
    <Modal title={ro ? `Papel — ${role.name} (protegido)` : `Editar papel — ${role.name}`} onClose={onClose}>
      {err && <p className="text-red-600 text-sm mb-3">{err}</p>}

      <label className="block text-sm mb-1">Nome</label>
      <input value={name} onChange={e => setName(e.target.value)} disabled={ro}
        className="w-full border rounded px-3 py-2 mb-4 disabled:bg-gray-100" />

      <p className="text-sm font-medium mb-2">Permissões</p>
      <div className="max-h-60 overflow-y-auto border rounded p-3 space-y-2">
        {catalog.map(p => (
          <label key={p.key} className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={ro ? true : selected.has(p.key)} disabled={ro}
              onChange={() => toggle(p.key)} className="mt-1" />
            <span><code className="text-xs">{p.key}</code> — {p.description}</span>
          </label>
        ))}
      </div>

      {!ro && (
        <div className="flex items-center justify-between mt-5">
          <div>
            {confirmDel ? (
              <span className="text-sm">
                {role.userCount} usuário(s) perderão este papel.{' '}
                <button onClick={remove} className="text-red-600 hover:underline">Confirmar exclusão</button>
                {' · '}
                <button onClick={() => setConfirmDel(false)} className="text-gray-600 hover:underline">Cancelar</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="text-red-600 hover:underline text-sm">Excluir papel</button>
            )}
          </div>
          <button onClick={save} className="bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition">Salvar</button>
        </div>
      )}
    </Modal>
  )
}
```

- [ ] **Step 3: Página de papéis**

`src/painel/pages/Papeis.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { papelNomeSchema, type PapelNomeForm } from '@/schemas/papeis'
import Modal from '@/painel/components/Modal'
import RoleEditModal, { type ManagedRole } from '@/painel/components/RoleEditModal'

export default function Papeis() {
  const [roles, setRoles] = useState<ManagedRole[]>([])
  const [editing, setEditing] = useState<ManagedRole | null>(null)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<PapelNomeForm>({ resolver: zodResolver(papelNomeSchema) })

  const load = useCallback(async () => {
    await ensureCsrf()
    const res = await adminFetch('/roles/manage')
    if (res.ok) setRoles((await res.json()).roles)
  }, [])

  useEffect(() => { load() }, [load])

  async function onCreate(data: PapelNomeForm) {
    setMsg(null)
    const res = await adminFetch('/roles', { method: 'POST', body: JSON.stringify(data) })
    if (res.ok) { setCreating(false); reset({ name: '' }); load(); setMsg({ kind: 'ok', text: 'Papel criado.' }) }
    else if (res.status === 409) setMsg({ kind: 'err', text: 'Já existe um papel com esse nome.' })
    else setMsg({ kind: 'err', text: 'Não foi possível criar.' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark">Papéis</h1>
        <button onClick={() => setCreating(true)}
          className="bg-iasd-dark text-white rounded px-4 py-2 text-sm hover:bg-iasd-accent transition">Novo papel</button>
      </div>

      {msg && <p className={`mb-4 text-sm ${msg.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Chave</th>
              <th className="px-4 py-2">Permissões</th>
              <th className="px-4 py-2">Usuários</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">{r.name} {r.protected && <span className="text-xs text-gray-500">(protegido)</span>}</td>
                <td className="px-4 py-2"><code className="text-xs">{r.key}</code></td>
                <td className="px-4 py-2">{r.permissions.length}</td>
                <td className="px-4 py-2">{r.userCount}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setEditing(r)} className="text-iasd-dark hover:underline">{r.protected ? 'Ver' : 'Editar'}</button>
                </td>
              </tr>
            ))}
            {roles.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Nenhum papel.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <RoleEditModal role={editing} onClose={() => setEditing(null)} onChanged={load} />}

      {creating && (
        <Modal title="Novo papel" onClose={() => setCreating(false)}>
          <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Nome</label>
              <input {...register('name')} className="w-full border rounded px-3 py-2" placeholder="Ex.: Editor de Conteúdo" />
              {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
              <p className="text-xs text-gray-500 mt-1">A chave (key) é gerada automaticamente a partir do nome.</p>
            </div>
            <button type="submit" disabled={isSubmitting}
              className="bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition disabled:opacity-60">Criar</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/papeis.ts src/painel/components/RoleEditModal.tsx src/painel/pages/Papeis.tsx
git commit -m "feat(painel): tela de Papéis + modal de edição (permissões) [US-27/28]"
```

---

## Task 9: Validação manual ponta-a-ponta (browser)

Pré: `docker compose up -d db`; backend e frontend no ar; logado como admin.

- [ ] **US-27:** `/painel/usuarios/papeis` lista os papéis; "Novo papel" cria (a `key` aparece em slug); "Editar" renomeia; "Excluir papel" mostra a contagem de usuários e remove ao confirmar; o papel `admin` aparece como "protegido" e abre só em modo leitura (sem Salvar/Excluir, checkboxes desabilitados).
- [ ] **US-28:** no modal, marcar/desmarcar permissões e Salvar; reabrir confirma a persistência; criar um papel com `users:read`, atribuí-lo a um usuário de teste (tela de Usuários) e verificar que ele passa a ver o menu/itens correspondentes; remover a permissão e confirmar que o acesso cai.
- [ ] **Permissão/gate:** simular um usuário sem `roles:manage` → o leaf "Papéis" leva a "Sem acesso" e a API responde `403`.
- [ ] **Commit final (se houver ajustes):**

```bash
git add -A
git commit -m "chore(painel): ajustes da validação manual da gestão de papéis"
```

---

## Pós-implementação

- [ ] Atualizar `docs/historias/README.md`: marcar **US-27, US-28** como ✅ com os commits principais.
- [ ] Usar superpowers:finishing-a-development-branch para decidir merge/PR.
