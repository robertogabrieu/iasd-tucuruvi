# Spec — Épico Painel: Gestão de Papéis e Permissões

**Data:** 2026-06-15 · **Branch:** `feat/area-administrativa`
**Histórias cobertas:** US-27 (CRUD de papéis), US-28 (editar permissões de um papel).
**Superfície nova:** `GET /api/admin/permissions`, `GET /api/admin/roles/manage`, `POST /api/admin/roles`, `PATCH /api/admin/roles/:id`, `PUT /api/admin/roles/:id/permissions`, `DELETE /api/admin/roles/:id`, e a tela `/painel/usuarios/papeis`.

## Contexto

O RBAC já está implementado e em uso: tabelas `roles`, `permissions`, `role_permissions`, `user_roles`
(todas N:N com `ON DELETE CASCADE`), `requirePermission` resolvendo por consulta ao banco a cada request
(US-10), e atribuição de papéis a usuários pela UI (US-11 + épico de administração de usuários). O que
**não existe** é uma forma de **gerenciar os papéis em si** e o **mapa papel↔permissão** sem SQL/seed —
é o que esta spec entrega.

Estado relevante no início:
- **Schema** (migration `001_auth_foundation.sql`): `roles { id, key UNIQUE, name, created_at }`,
  `permissions { id, key UNIQUE, description }`, `role_permissions { role_id, permission_id }` (PK
  composta, cascade), `user_roles` (idem). **Esta entrega não precisa de migration.**
- **Catálogo de permissões** em `server/seed/permissions.catalog.ts` — as permissões são **definidas em
  código** porque o código as exige (`requirePermission('users:read')`). O seed (`runSeed`) garante cada
  permissão (`ensurePermission`) e **religa todas ao papel `admin` a cada boot** (`linkAllPermissions`).
- **Módulo `roles`** já tem `role.repository.ts` (com `ensureRole`, `listRoles`, `findRoleIdByKey`,
  `exists`, `removeUserRole`, `roleHasPermission`, `linkAllPermissions`), `role.service.ts`,
  `role.controller.ts`, `role.routes.ts`. `GET /api/admin/roles` (perm `roles:assign`) devolve
  `{id,key,name}` e é consumido pelos seletores do `RolesModal` e da tela de Convites.
- **Frontend**: `nav-config.tsx` (grupo Usuários → Lista/Convites; o leaf "Papéis" foi removido no épico
  anterior), `RequirePermission`, `Modal`, `AuthContext.hasPermission`, padrão de página/`adminFetch`.

## Decisões de arquitetura

Segue a arquitetura em camadas obrigatória (`routes → controller → service → repository → db`) por
módulo, com os 4 design patterns do `CLAUDE.md`. Classe só com estado + comportamento coeso; senão,
função pura.

### Decisão 1 — Permissão `roles:manage`, distinta de `roles:assign`

Gerenciar papéis (criar/renomear/excluir + editar permissões) exige uma permissão nova **`roles:manage`**.
`roles:assign` (já existente) continua sendo apenas *atribuir papéis a usuários*. Separar os dois permite,
no futuro, um perfil que atribui papéis mas não redefine o RBAC.

- **Custo:** uma linha em `permissions.catalog.ts`; religada ao `admin` no seed, **sem migration**.

### Decisão 2 — O papel `admin` é protegido (imutável pela API)

`PATCH`, `PUT .../permissions` e `DELETE` sobre o papel `admin` respondem **`409 ConflictError`** ("papel
protegido"). A identificação do papel protegido é por **`key = 'admin'`** (o papel-semente).

- **Por quê:** o seed religa todas as permissões ao `admin` a cada boot, então editá-las pela UI seria
  sobrescrito — e o requisito do projeto é "admin sempre com todas as permissões". Proteger o papel
  resolve a contradição **e** elimina a necessidade de um guard de "último admin" nesta tela: como o
  `admin` é imutável e sempre detém `roles:assign`/`roles:manage`, nenhuma edição de **outros** papéis
  consegue deixar o sistema sem acesso administrativo. (O guard a nível de *usuário* — não remover o papel
  do último admin — permanece em US-11, intocado.)

### Decisão 3 — Permissões continuam catálogo de código

A UI **não cria nem exclui permissões** — só vincula/desvincula as **existentes** no catálogo. Criar
chaves de permissão que nenhum `requirePermission(...)` verifica não teria efeito. `GET
/api/admin/permissions` expõe o catálogo (referência fixa, **não paginada** — coerente com a isenção da
convenção de paginação).

### Decisão 4 — Endpoints de gestão separados, sem tocar o `GET /api/admin/roles` existente

O `GET /api/admin/roles` (perm `roles:assign`, retorna `{id,key,name}`) **fica intocado** para não quebrar
os seletores de `RolesModal`/Convites. A tela de gestão usa um endpoint próprio
`GET /api/admin/roles/manage` (perm `roles:manage`) que devolve, por papel,
`{ id, key, name, permissions: string[], userCount, protected: boolean }`.

- **Por quê:** responsabilidades e permissões distintas (ler para *atribuir* vs. ler para *gerenciar*).
  Evita acoplar o gating dos seletores à permissão de gestão.

### Decisão 5 — `key` gerada por slug, imutável; `name` editável

Ao criar, o admin informa só o **nome**; a **`key`** é derivada por slug (minúsculas, sem acento,
não-alfanuméricos → `-`, colapsa repetições; ex.: "Editor de Conteúdo" → `editor-de-conteudo`) e
**garantida única** (sufixo `-2`, `-3`… em colisão). A `key` é **imutável** após a criação (evita quebrar
referências como o `roleKey` de convites); o **nome** é editável.

### Decisão 6 — `setPermissions` substitui o conjunto, em transação

`PUT /roles/:id/permissions` recebe a **lista completa** de chaves e **substitui** `role_permissions` do
papel (apaga as atuais e insere as novas, em **transação**). Idempotente; valida que toda chave existe no
catálogo (senão `422`). Modelo "set" é mais simples e previsível para a UI de checkboxes do que
add/remove incremental.

## Modelo de dados

**Nenhuma migration.** Opera sobre `roles`/`permissions`/`role_permissions` existentes. Única mudança de
dados: adicionar `{ key: 'roles:manage', description: 'Criar/editar papéis e suas permissões' }` a
`server/seed/permissions.catalog.ts` — religada ao `admin` no próximo boot.

## Backend — estrutura

Estende o módulo `roles` existente:

```
server/modules/roles/
├── role.repository.ts   # + create, rename, deleteRole, countUsers, listForManagement,
│                        #   listPermissionKeys(roleId), setPermissions(roleId, keys)
├── role.service.ts      # + regras de CRUD, slug de key, proteção do admin, validação de permissões
├── role.controller.ts   # + create, rename, remove, listManaged, setPermissions
├── role.routes.ts       # + rotas sob roles:manage
└── dto/role.dto.ts      # + createRoleDto, renameRoleDto, setPermissionsDto
server/modules/authz/
└── permission.repository.ts  # + listCatalog() (ou reusa o catálogo direto)
server/seed/permissions.catalog.ts  # + roles:manage
```

### Endpoints (montados em `/api/admin`, todos perm `roles:manage`)

| Método | Rota | O quê | Notas |
|--------|------|-------|-------|
| `GET` | `/permissions` | Catálogo `{ key, description }[]` | Referência fixa, **não paginado** |
| `GET` | `/roles/manage` | Papéis `{ id, key, name, permissions[], userCount, protected }` | `protected = (key === 'admin')` |
| `POST` | `/roles` | Cria `{ name }` → gera `key` por slug única; `201` com o papel | Nome/chave em colisão ⇒ `409` |
| `PATCH` | `/roles/:id` | Renomeia `{ name }`; `key` imutável | `admin` ⇒ `409`; inexistente ⇒ `404` |
| `PUT` | `/roles/:id/permissions` | `{ permissionKeys: string[] }` substitui o conjunto | `admin` ⇒ `409`; chave fora do catálogo ⇒ `422` |
| `DELETE` | `/roles/:id` | Exclui (cascade) | `admin` ⇒ `409`; inexistente ⇒ `404` |

Todos com `requireAuth` + `requirePermission('roles:manage')`; mutações também com `requireCsrf`.

> **Ordem de rotas (Express):** registrar a rota estática `GET /roles/manage` **antes** das rotas com
> parâmetro (`PATCH/DELETE /roles/:id`, `PUT /roles/:id/permissions`), para `manage` não ser capturado
> como `:id`.

### Camadas

- **`RoleRepository`** (estende): `create(key, name)`; `rename(id, name)`; `deleteRole(id)`;
  `countUsers(roleId)` (`count(*) FROM user_roles WHERE role_id`); `listForManagement()` (papéis +
  `array_agg` de permission keys + `count` de usuários — via subselects ou joins agregados);
  `listPermissionKeys(roleId)`; `setPermissions(roleId, keys)` (transação: `DELETE` + `INSERT ... SELECT
  id FROM permissions WHERE key = ANY($keys)`); `findById(id)` / `findByIdRow` para checar `key` e
  existência. Reusa `findRoleIdByKey`/`exists`.
- **`PermissionRepository`** (ou util): `listCatalog()` — `SELECT key, description FROM permissions ORDER
  BY key`. (Alternativa: expor o `PERMISSIONS` do catálogo direto; preferir ler do banco para refletir o
  estado real, mas o catálogo de código é a fonte canônica — o plano decide. Recomendado: ler do banco,
  já que o seed o mantém sincronizado.)
- **`RoleService`** (estende): regra de negócio —
  - `slugify(name)` (função pura em `role.utils.ts`) + resolução de colisão (consulta `findRoleIdByKey`).
  - `createRole(name)`, `renameRole(id, name)`, `deleteRole(id)`, `setPermissions(id, keys)` — cada um
    rejeita o papel protegido (`key === 'admin'` ⇒ `ConflictError`) e valida existência (`404`).
  - `setPermissions` valida que todas as `keys` existem no catálogo (senão `ValidationError` → `422`).
  - `listManaged()` retorna a visão de gestão com `protected`.
- **`RoleController`** + **`role.routes.ts`**: HTTP fino (parse DTO, chama service, serializa); rotas
  acrescentadas a `makeRoleAdminRoutes` (ou um segundo factory `makeRoleManageRoutes` montado no mesmo
  `/api/admin` — o plano decide; manter coeso no módulo `roles`).
- **DTOs Zod**: `createRoleDto { name: string(1..60) }`, `renameRoleDto { name: string(1..60) }`,
  `setPermissionsDto { permissionKeys: string[] }`.

## Frontend

- **`nav-config.tsx`**: reintroduz o leaf **Papéis** no grupo Usuários (`{ label: 'Papéis', to:
  '/painel/usuarios/papeis' }`). O gating do grupo Usuários hoje usa `perm: 'users:read'`; como o leaf
  Papéis exige `roles:manage`, a rota é protegida por `RequirePermission perm="roles:manage"` (o leaf
  aparece para quem tem `users:read`; quem não tiver `roles:manage` vê "Sem acesso" ao entrar — coerente
  com o backend que responde `403`). *(Refinamento opcional: gating por-leaf; fora do escopo mínimo.)*
- **`App.tsx`**: rota `usuarios/papeis` → `RequirePermission perm="roles:manage"` → `Papeis` (antes do
  catch-all e na ordem correta em relação a `usuarios/:id`).
- **Tela `Papeis`** (`src/painel/pages/Papeis.tsx`): lista os papéis (`GET /roles/manage`) com nome,
  `key`, nº de permissões e nº de usuários; botão **"Novo papel"** (modal com o nome → `POST /roles`).
  Por papel, **"Editar"** abre um **modal** (reusa `Modal`) com:
  - campo **nome** (salva via `PATCH /roles/:id`);
  - **checkboxes** das permissões do catálogo (`GET /permissions`), marcadas conforme as atuais; **Salvar**
    chama `PUT /roles/:id/permissions`;
  - **Excluir** (modal de confirmação mostrando `userCount`) → `DELETE /roles/:id`.
  - O papel `admin` (`protected`) aparece com tudo marcado e **desabilitado**, sem Excluir.
- **Schemas Zod** (`src/schemas/papeis.ts`): `criarPapelSchema`/`renomearPapelSchema` (`name`).
- Reusa `adminFetch`, padrão de mensagem `{kind:'ok'|'err'}`, `RolesModal`/`Modal` como referência.

## Mapeamento de erros

| Situação | Status | Erro |
|----------|--------|------|
| Sem `roles:manage` | 403 | `ForbiddenError` (via `requirePermission`) |
| Operar sobre o papel `admin` (rename/permissions/delete) | 409 | `ConflictError` (papel protegido) |
| Criar papel cujo nome gera `key` já usada | — | **sem erro**: o slug recebe sufixo (`-2`, `-3`…) e o papel é criado (Decisão 5). O front trata `409` defensivamente, mas não é o caminho esperado. |
| `:id` de papel inexistente | 404 | `NotFoundError` |
| `permissionKeys` com chave fora do catálogo | 422 | `ValidationError` |
| Body inválido (Zod) | 422 | `ZodError` (handler central) |

## Segurança

- Autorização por **permissão** (`roles:manage`), nunca por nome de role; backend é a barreira (UI é
  conveniência).
- Papel `admin` imutável ⇒ o sistema nunca perde acesso administrativo por esta tela.
- `requireCsrf` em todas as mutações.
- Mudanças de permissão refletem **na hora** (resolução por request — US-10), sem invalidar tokens.
- Sem criação de permissões livres (catálogo de código é a fonte).

## Validação (sem suíte de testes — convenção do projeto)

Manual no browser + `curl`:
1. **US-27:** criar "Editor" (vira `key` `editor`), renomear, criar outro "Editor" (colisão de slug →
   `editor-2`); excluir um papel atribuído a um usuário de teste (confirmação mostra a contagem; após
   excluir, o usuário perde o papel). `admin`: rename/delete ⇒ `409`. Sem `roles:manage` ⇒ `403` e o
   leaf não acessível.
2. **US-28:** `GET /permissions` lista o catálogo; marcar um subconjunto num papel e salvar
   (`PUT`); reabrir confirma persistência; atribuir o papel a um usuário de teste e checar que ele passa
   a ter/perder acesso conforme as permissões (autorização reflete na hora). `admin` ⇒ controles
   desabilitados e `PUT` ⇒ `409`. Chave inválida ⇒ `422`.

## Fora de escopo

- **Criar/excluir permissões** pela UI (catálogo de código).
- **Herança/hierarquia** de papéis; papéis de sistema além do `admin`.
- **Auditoria** das mudanças de RBAC.
- Gating **por-leaf** fino no menu (o leaf Papéis fica sob o grupo Usuários; a rota é protegida por
  `roles:manage`).
