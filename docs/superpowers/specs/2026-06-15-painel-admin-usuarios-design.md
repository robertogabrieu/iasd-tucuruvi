# Spec — Épico Painel: Administração de Usuários

**Data:** 2026-06-15 · **Branch:** `feat/area-administrativa`
**Histórias cobertas:** US-23 (listar usuários), US-24 (detalhe do usuário), US-25 (tela de convites), US-26 (permissões refletidas no painel).
**Origem:** [issue #8](https://github.com/robertogabrieu/iasd-tucuruvi/issues/8) — telas de administração de usuários ausentes; menu leva a stubs "Em breve".
**Superfície nova:** endpoints `GET/PATCH/POST` em `/api/admin/users/*`, `GET/DELETE /api/admin/invitations*`, `permissions` no `GET /api/auth/me`, e as telas `/painel/usuarios`, `/painel/usuarios/:id`, `/painel/usuarios/convites`.

## Contexto

O backend de gestão de usuários já está entregue (US-06 convidar, US-07 aceitar, US-10 autorizar por
permissão, US-11 papéis), assim como o shell do painel (US-13) e a tela de Configurações (US-14). O que
falta — e esta spec entrega — são **as telas de administração de usuários** e os **endpoints de
listagem** que ninguém cobriu (a spec de gestão adiou para "o épico do painel"; a spec do painel marcou
essas telas como stubs).

Estado relevante no início:
- **Backend pronto e reutilizável:**
  - `POST /api/admin/invitations` (perm `users:invite`) — `invitation.routes.ts:15`.
  - `GET /api/admin/roles`, `POST /api/admin/users/:id/roles`, `DELETE /api/admin/users/:id/roles/:roleId`
    (perm `roles:assign`, guard "último admin") — `role.routes.ts:15-17`.
  - `requirePermission(key)` — `authz/middleware/require-permission.ts`.
  - `AuthService.forgotPassword(email)` (US-04) e `RefreshTokenRepository.revokeAllForUser(userId)`.
  - `PermissionRepository` resolve permissões filtrando `users.status = 'active'`.
- **Tabelas existentes** já bastam: `users` (com `status 'active'|'disabled'`, `failed_login_count`,
  `locked_until`, `lock_cycle_count`, `last_login_at`) e `invitations` (`status`, `expires_at`,
  `invited_by`). **Esta entrega não precisa de migration.**
- **Catálogo de permissões** (`server/seed/permissions.catalog.ts`) já tem `users:read`, `users:invite`,
  `roles:assign`. O seed religa **todas** as permissões ao papel `admin` no boot (`runSeed → linkAllPermissions`),
  então adicionar uma permissão é **só uma linha**, sem migration.
- **Frontend:** `nav-config.tsx` define o menu (grupo "Usuários" → Lista/Convites/Papéis, todos caindo
  no catch-all `EmBreve`); `AuthContext` lê `GET /api/auth/me` (hoje devolve só `roles`); `admin-api.ts`
  fixa o prefixo `/api/admin`; `Configuracoes.tsx` é o padrão de página do painel (form + mensagem
  `{kind:'ok'|'err'}`).

## Decisões de arquitetura

Todo código novo segue a arquitetura em camadas obrigatória do `CLAUDE.md`
(`routes → controller → service → repository → db`), por módulo, com os 4 design patterns (Repository,
Service Layer, DI por construtor no `container.ts`, hierarquia de erros + handler central). Classe só com
estado + comportamento coeso e mais de um consumidor; caso contrário, função pura.

### Decisão 1 — Paginação padrão no backend (nova convenção do projeto)

Toda listagem de coleção que **cresce** é paginada **no servidor**. Contrato único:

- **Request:** `?page=<int≥1, default 1>&limit=<int 1..100, default 20>`.
- **Response (envelope):** `{ "data": T[], "pagination": { "page", "limit", "total", "totalPages" } }`.
- **Infra compartilhada** em `server/core/pagination.ts`:
  - `paginationQuery` — schema Zod que coage/valida `page`/`limit` e expõe `offset = (page-1)*limit`.
  - `paginate(data, total, { page, limit })` — função pura que monta o envelope (calcula `totalPages`).
- **Camadas:** o repositório recebe `{ limit, offset }` e retorna as linhas **+** um `count` total
  (consulta `count(*)` paralela); o service chama `paginate(...)`; o controller só serializa.
- **Isenção:** catálogos de referência fixos (`GET /api/admin/roles`, e qualquer `permissions`) **não**
  paginam — alimentam `<select>` e precisam vir inteiros.
- **Documentação:** registrar a convenção no `CLAUDE.md` (seção *Convenções de código*).
- **Por quê:** evita carregar tabelas que crescem (usuários, convites, futuros boletins) de uma vez e
  padroniza o contrato consumido pelo front. **Alternativa rejeitada:** paginar no client (não escala) ou
  cursor-based (complexidade desnecessária para o volume de uma igreja).

### Decisão 2 — Uma permissão `users:manage` para os mutadores de conta

Editar nome/e-mail, ativar/desativar, desbloquear e disparar redefinição de senha ficam sob **uma**
permissão nova, `users:manage`. `users:read` cobre as **listagens/leitura**; `users:invite` cobre a tela
de convites; `roles:assign` (já existe) cobre papéis.

- **Por quê:** 5 chaves granulares (`users:update`, `users:disable`, `users:unlock`...) só adicionariam
  ruído num app com **1 papel** que detém tudo. Uma permissão coesa "administrar contas" é suficiente e
  ainda permite, no futuro, um papel que lê mas não muda.
- **Custo:** zero migration — uma linha em `permissions.catalog.ts`, religada ao `admin` no seed.

### Decisão 3 — `/me` passa a expor `permissions`; gating no front é conveniência, não barreira

`GET /api/auth/me` passa a devolver `permissions: string[]` (além de `roles`), resolvidas pela cadeia
`users → user_roles → roles → role_permissions → permissions` (mesma cadeia do `requirePermission`). O
front usa isso para **esconder** itens de menu e **bloquear** rotas. A autorização **real** continua no
backend (`requirePermission` → `403`).

- **Por quê:** o menu/rotas precisam refletir o que o usuário pode fazer (US-26), mas segurança não pode
  depender do client. **Alternativa rejeitada:** embutir permissões no JWT (ficariam *stale* após troca de
  papel, ~15 min, e incham o token — coerente com a Decisão 1 da spec de gestão).

### Decisão 4 — Desativar conta: guard "último admin" + revogação de sessão

Desativar (`status = 'disabled'`) reaproveita o guard de US-11 (bloqueia `409` se zeraria os usuários
ativos com `roles:assign`) e, ao desativar, chama `revokeAllForUser` para derrubar os refresh tokens.

- **Sem mexer no `requireAuth`:** ele só valida o JWT, mas o `requirePermission` já filtra
  `status = 'active'` — então toda ação protegida do usuário desativado falha **na hora**, e o access
  token curto (~15 min) expira logo depois. Revogar os refresh tokens impede a renovação. Isso é
  suficiente; checar status em todo request seria custo extra sem ganho relevante.

### Decisão 5 — Reaproveitar o que já existe (sem duplicar regra)

- **Convidar/reenviar** (US-25) reusam o `POST /api/admin/invitations` de US-06 (reenvio já revoga o
  pendente e reemite).
- **Papéis** nos modais/detalhe (US-23/24) reusam os endpoints de US-11.
- **Redefinição de senha** (US-24) reusa `AuthService.forgotPassword` — admin dispara o mesmo fluxo de
  US-04/05; resposta genérica preservada.

## Modelo de dados

**Nenhuma migration.** Tudo opera sobre `users` e `invitations` existentes. Única mudança de
"configuração de dados": adicionar `{ key: 'users:manage', description: 'Administrar contas (editar, ativar/desativar, desbloquear, redefinir senha)' }`
a `server/seed/permissions.catalog.ts` — religada ao `admin` no próximo boot.

## Backend — estrutura de módulos

```
server/
├── core/
│   └── pagination.ts                 # NOVO: paginationQuery (Zod) + paginate() (envelope)
├── modules/
│   ├── users/                        # hoje só tem user.repository.ts — ganha as camadas de admin
│   │   ├── user.repository.ts        # +listWithRoles, +findByIdWithRoles, +updateProfile, +setStatus, +unlock, +countAll
│   │   ├── user.service.ts           # NOVO: regra de listagem/edição/status/unlock/reset
│   │   ├── user.controller.ts        # NOVO
│   │   ├── user.routes.ts            # NOVO: makeUserAdminRoutes(...)
│   │   └── dto/user.dto.ts           # NOVO: updateUserDto, setStatusDto
│   ├── invitations/
│   │   ├── invitation.repository.ts  # +listPending (paginado), +findById, +revoke
│   │   ├── invitation.service.ts     # +listPending, +revoke
│   │   ├── invitation.controller.ts  # +list, +revoke
│   │   └── invitation.routes.ts      # +GET /invitations, +DELETE /invitations/:id
│   ├── authz/
│   │   └── permission.repository.ts  # +listPermissionKeys(userId)
│   └── auth/
│       └── auth.service.ts           # me() passa a incluir permissions
├── seed/permissions.catalog.ts       # +users:manage
└── container.ts                      # instancia UserService/Controller, monta userRoutes; AuthService recebe permissionRepo
```

### Endpoints (montados em `/api/admin`, salvo indicação)

| Método | Rota | Permissão | História | Notas |
|--------|------|-----------|----------|-------|
| `GET` | `/users` | `users:read` | US-23 | Paginado. Cada item: `{ id, name, email, status, roles[], lastLoginAt }` |
| `GET` | `/users/:id` | `users:read` | US-24 | `{ ...campos, createdAt }` + papéis; `404` se inexistente |
| `PATCH` | `/users/:id` | `users:manage` | US-24 | Body parcial `{ name?, email? }`; e-mail duplicado ⇒ `409` |
| `PATCH` | `/users/:id/status` | `users:manage` | US-24 | `{ status: 'active'\|'disabled' }`; guard último admin (`409`); ao desativar ⇒ `revokeAllForUser` |
| `POST` | `/users/:id/unlock` | `users:manage` | US-24 | Zera `failed_login_count`/`locked_until`/`lock_cycle_count` |
| `POST` | `/users/:id/password-reset` | `users:manage` | US-24 | Reusa `forgotPassword(user.email)`; `204`/resposta genérica |
| `GET` | `/invitations` | `users:invite` | US-25 | Paginado; pendentes com `{ id, email, roleName, invitedBy, expiresAt }` |
| `DELETE` | `/invitations/:id` | `users:invite` | US-25 | Revoga pendente (`status='revoked'`); idempotente |
| `GET` | `/api/auth/me` | (autenticado) | US-26 | Passa a incluir `permissions: string[]` |

Endpoints reaproveitados sem mudança: `POST /api/admin/invitations` (US-06), `GET /api/admin/roles` +
`POST/DELETE /api/admin/users/:id/roles` (US-11).

### Detalhe das camadas

- **`core/pagination.ts`** — `paginationQuery` (Zod: `page`/`limit` com defaults e `max(100)`),
  `paginate(data, total, {page, limit})`. Funções/objetos puros, sem classe (sem estado).
- **`UserRepository`** (estende o existente):
  - `listWithRoles({ limit, offset }): { rows, total }` — `JOIN` agregando `roles` por usuário
    (`array_agg`/subquery) + `count(*)` total.
  - `findByIdWithRoles(id)` — detalhe + papéis.
  - `updateProfile(id, { name?, email? })` — `UPDATE` parcial; colisão de e-mail tratada como `23505` →
    `ConflictError` (ou checagem prévia `findByEmail`).
  - `setStatus(id, status)`, `unlock(id)` (zera os 3 campos de lockout), `countAll()`.
- **`UserService`** — orquestra: listagem paginada; edição (valida existência → `404`); `setStatus`
  (guard último admin via `PermissionRepository.countActiveUsersWithPermissionExcept('roles:assign', id)`
  quando `disabled`; `revokeAllForUser` ao desativar); `unlock`; `resetPassword` delega a
  `AuthService.forgotPassword`. Não toca `req/res`.
- **`InvitationRepository`** — `listPending({limit, offset})` (`JOIN roles` p/ nome do papel e `LEFT JOIN
  users` p/ o nome de quem convidou, `WHERE status='pending'`, `ORDER BY created_at DESC`, + total),
  `findById(id)`, `revoke(id)`. O item exposto traz `invitedBy` como **nome** do autor (ou `null` quando o
  autor foi removido — `invited_by` é `ON DELETE SET NULL`; a UI renderiza "—").
- **`InvitationService`/`Controller`** — `+listPending` (paginado), `+revoke` (`404` se não pendente).
- **`PermissionRepository.listPermissionKeys(userId)`** — `SELECT DISTINCT p.key` pela cadeia, filtrando
  `status='active'`. `AuthService.me` injeta `permissions` no retorno (o `container.ts` passa o
  `permissionRepo` ao `AuthService`, ou o `UserRepository` ganha o método — decisão do plano; preferir
  manter no `PermissionRepository` para coesão).

### Composition root (`container.ts`)

Instancia `UserService`/`UserController` e exporta `userRoutes = makeUserAdminRoutes(controller,
requireAuth, requirePermission)`; `index.ts` mantém `app.use('/api/admin', ...)` (acrescenta `userRoutes`
ao conjunto admin). `AuthService` passa a receber `permissionRepo` para o `me()` retornar `permissions`.

## Frontend

### Navegação e rotas
- **`nav-config.tsx`:** remover o leaf **Papéis**; grupo "Usuários" → **Lista** (`/painel/usuarios`) e
  **Convites** (`/painel/usuarios/convites`). Cada `NavEntry` ganha um campo opcional `perm?: string`
  (ex.: Usuários → `users:read`).
- **`App.tsx`** (sob `/painel`): `usuarios` → `UsuariosLista`; `usuarios/:id` → `UsuarioDetalhe`;
  `usuarios/convites` → `Convites`. O catch-all `EmBreve` permanece para os stubs de Conteúdo.

### Gating de permissão (US-26)
- **`AuthContext`:** `User` ganha `permissions?: string[]`; expõe helper `hasPermission(key)`.
- **`Sidebar`:** filtra entradas/grupos do `NAV` por `perm` (esconde o que o usuário não pode).
- **`RequirePermission`** (novo wrapper, composto com `ProtectedRoute`): se faltar a permissão, mostra
  "Sem acesso" ou redireciona. Aplica nas rotas de usuários.

### Telas
1. **`UsuariosLista`** — tabela paginada (consome `GET /users`): colunas nome, e-mail, badge de status,
   chips de papéis, último login. Por linha: "Gerenciar papéis" (abre `RolesModal`) e link para o
   detalhe. Botão "Convidar" → `/painel/usuarios/convites`. Pager (Anterior/Próxima + "página X de Y").
2. **`UsuarioDetalhe`** (`/painel/usuarios/:id`) — form nome + e-mail (`PATCH /users/:id`); toggle de
   status (`PATCH /users/:id/status`); botões "Desbloquear" (`POST .../unlock`) e "Enviar redefinição de
   senha" (`POST .../password-reset`); papéis inline (endpoints US-11). Leitura: último login, criado em.
   Trata `409` (e-mail/último admin) e `404`.
3. **`Convites`** — form de convite (e-mail + `<select>` de papel via `GET /roles`) → `POST /invitations`;
   tabela paginada de pendentes (`GET /invitations`) com "Revogar" (`DELETE /invitations/:id`) e
   "Reenviar" (re-`POST /invitations`). Trata `409` (e-mail já cadastrado).

### UI compartilhada
- **`Modal`** simples (overlay) para o `RolesModal`.
- **`Pager`** reutilizável + hook leve de estado de paginação (`page`/`limit`).
- Tabela e mensagens `{kind:'ok'|'err'}` no padrão de `Configuracoes.tsx`; paleta `iasd-dark`/`iasd-accent`.
- **Schemas Zod** (`src/schemas/usuarios.ts`) espelham os DTOs do servidor (convenção do `CLAUDE.md` de
  manter client/server em sincronia).

## Fluxo de dados e mapeamento de erros

| Situação | Status | Erro |
|----------|--------|------|
| Sem `access_token` em `/api/admin/*` | 401 | `UnauthorizedError` (via `requireAuth`) |
| Autenticado sem a permissão exigida | 403 | `ForbiddenError` (via `requirePermission`) |
| `GET/PATCH /users/:id` com id inexistente | 404 | `NotFoundError` |
| `PATCH /users/:id` com e-mail já usado | 409 | `ConflictError` |
| Desativar o último admin ativo | 409 | `ConflictError` (guard) |
| `DELETE /invitations/:id` não pendente | 404 | `NotFoundError` |
| `page`/`limit` inválidos | 422 | `ValidationError` (via `paginationQuery`) |

Todos lançados nas camadas de serviço/middleware e traduzidos pelo handler central
(`core/error-handler.ts`). Sem `try/catch` nos controllers.

## Segurança

- Autorização sempre por **permissão** (`requirePermission`), nunca por nome de role; backend é a barreira
  real (o gating de UI é só conveniência — US-26 CA-04).
- Desativar conta revoga refresh tokens; permissões já filtram `status='active'`.
- Troca de e-mail valida unicidade (`409`); identidade da sessão é o `id` no JWT, não o e-mail (sem
  necessidade de revogar sessão na troca).
- Disparo de redefinição de senha mantém resposta **genérica** (não vaza existência/estado da conta).
- Guard de "último administrador" estendido à desativação, além da remoção de papel.
- `requireCsrf` em todas as mutações administrativas (padrão já vigente nas rotas admin).
- Sem multi-tenant; sem mudança no modelo de sessão/refresh.

## Validação (sem suíte de testes — convenção do projeto)

Validação manual no browser + `curl` + Mailpit:
1. **US-23:** logado como admin, `/painel/usuarios` lista os usuários paginados; alterar `limit`/`page`
   reflete no backend; modal de papéis adiciona/remove (idempotente) e mostra `409` ao tentar remover o
   último admin.
2. **US-24:** abrir `/painel/usuarios/:id`; editar nome/e-mail (e-mail duplicado ⇒ `409`); desativar ⇒ a
   sessão daquele usuário cai (refresh falha) e ações protegidas dão `403`; "Desbloquear" destrava um
   usuário em lockout; "Enviar redefinição" gera e-mail no Mailpit; desativar o último admin ⇒ `409`.
3. **US-25:** convidar pela tela (e-mail no Mailpit; e-mail já cadastrado ⇒ `409`); pendentes listados
   paginados; "Revogar" some da lista e invalida o link de aceite; "Reenviar" emite novo e invalida o
   anterior.
4. **US-26:** `GET /api/auth/me` traz `permissions`; com o papel admin tudo aparece; simular um papel sem
   `users:read` (inserindo linhas, sem migration) ⇒ item "Usuários" some do menu e a rota direta é
   bloqueada, enquanto a API responde `403`.

## Documentação

- **`CLAUDE.md`** — adicionar à seção *Convenções de código* a convenção de **paginação no backend**
  (contrato `page`/`limit` + envelope `{ data, pagination }`; catálogos de referência isentos).
- Histórias **US-23 a US-26** já criadas em `docs/historias/`; índice atualizado.

## Fora de escopo (incrementos futuros)

- **Criar usuário direto** pela UI (acesso permanece *invite-only*).
- **Definir senha manualmente** para outro usuário (apenas disparar redefinição).
- **Log de auditoria** das ações administrativas (não há infra de auditoria hoje).
- **Busca/filtro** na lista de usuários e convites (paginação entregue; busca é incremento).
- **CRUD de papéis** via UI (segue por seed/inserção de linhas, sem migration).
- **Endpoint paginado para papéis/permissões** (catálogos de referência permanecem isentos).
