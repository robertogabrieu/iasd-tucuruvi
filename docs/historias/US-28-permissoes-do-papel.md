# US-28 — Editar permissões de um papel

**Épico:** Painel — Gestão de Papéis e Permissões · **Prioridade:** Should · **Estimativa:** 3 pts

> ✅ **Entregue** em `e271fb2`, `117ac7a`, `ccef82c`, `be3ba37` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-15-painel-papeis-permissoes-design.md) e [plano](../superpowers/plans/2026-06-15-painel-papeis-permissoes.md).

## História

> **Como** Administrador,
> **eu quero** marcar quais permissões cada papel possui,
> **para que** eu controle com precisão o que cada nível de acesso pode fazer.

## Critérios de aceitação

### CA-01 — Ver permissões do papel e o catálogo
- **Given** que tenho a permissão `roles:manage`
- **When** edito um papel na tela de Papéis
- **Then** vejo a **lista de permissões do catálogo** (`GET /api/admin/permissions` → `{ key, description }`) como checkboxes
- **And** as permissões já vinculadas ao papel aparecem **marcadas** (vindas do `GET /api/admin/roles/manage`).

### CA-02 — Definir as permissões do papel
- **Given** um papel (não-`admin`)
- **When** marco/desmarco permissões e salvo (`PUT /api/admin/roles/:id/permissions` com `{ permissionKeys: string[] }`)
- **Then** o conjunto de permissões do papel é **substituído** pelo informado (atualiza `role_permissions`)
- **And** uma chave que não existe no catálogo resulta em `422`.

### CA-03 — Papel `admin` protegido
- **Given** o papel `admin`
- **When** tento alterar suas permissões
- **Then** a API responde `409` ("papel protegido")
- **And** na UI ele aparece com **todas as permissões marcadas e desabilitadas** (o seed garante isso a cada boot).

### CA-04 — Mudança reflete imediatamente
- **Given** que alterei as permissões de um papel
- **When** um usuário com esse papel faz uma ação protegida
- **Then** a autorização reflete a mudança **na hora** — as permissões são resolvidas por consulta ao banco a cada request (ver **US-10**), não embutidas no token.

### CA-05 — Autorização obrigatória
- **Given** que **não** tenho `roles:manage`
- **When** tento ver/alterar permissões de papéis
- **Then** recebo `403`.

### CA-06 — Permissões são catálogo de código
- **Given** a tela
- **When** procuro criar/excluir uma permissão
- **Then** **não há** essa opção — permissões são definidas em `permissions.catalog.ts` (o código as exige); a tela só vincula/desvincula as existentes.

## Notas técnicas
- `GET /api/admin/permissions` (perm `roles:manage`) expõe o catálogo (referência fixa — **não paginado**).
- `RoleRepository.setPermissions(roleId, keys)` substitui o conjunto **em transação** (apaga e reinsere `role_permissions`); valida as chaves contra o catálogo.
- Reaproveita a resolução de permissão por request de **US-10** (sem cache no token).

## Dependências
- **US-10** (autorização por permissão), **US-27** (CRUD de papéis — a tela e os endpoints base).

## Definição de pronto
- [ ] Marcar/desmarcar permissões do catálogo e persistir (`PUT .../permissions`).
- [ ] `admin` protegido; chave inválida ⇒ `422`.
- [ ] Mudança reflete na autorização imediatamente.
- [ ] Validado manualmente no browser.
