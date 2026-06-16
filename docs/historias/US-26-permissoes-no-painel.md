# US-26 — Permissões refletidas no painel

**Épico:** Painel — Administração de Usuários · **Prioridade:** Should · **Estimativa:** 3 pts

> ✅ **Entregue** em `a67e607`, `8d55f7b`, `658efbb`, `55faac9` — branch `feat/area-administrativa`. Origem: [issue #8](https://github.com/robertogabrieu/iasd-tucuruvi/issues/8). Ver [spec](../superpowers/specs/2026-06-15-painel-admin-usuarios-design.md) e [plano](../superpowers/plans/2026-06-15-painel-admin-usuarios.md).

## História

> **Como** Administrador,
> **eu quero** que o painel mostre apenas o que eu posso fazer — escondendo itens de menu e bloqueando rotas sem permissão,
> **para que** a interface fique coerente com meu nível de acesso, já preparada para quando existirem papéis além de `admin`.

## Critérios de aceitação

### CA-01 — `/me` expõe permissões
- **Given** que estou autenticado
- **When** o painel chama `GET /api/auth/me`
- **Then** a resposta inclui `permissions: string[]` (além de `roles`), resolvidas pela cadeia `users → user_roles → roles → role_permissions → permissions`.

### CA-02 — Menu esconde itens sem permissão
- **Given** que **não** tenho a permissão exigida por um item do menu (ex.: `users:read` para "Usuários")
- **When** o menu lateral é renderizado
- **Then** esse item (ou grupo, se vazio) **não** aparece.

### CA-03 — Rotas protegidas por permissão
- **Given** que **não** tenho a permissão de uma rota do painel
- **When** acesso a URL diretamente
- **Then** sou bloqueado (aviso "Sem acesso" ou redirecionamento), em vez de ver a tela.

### CA-04 — Backend continua a fonte de verdade
- **Given** o gating de UI
- **When** uma chamada protegida é feita mesmo assim
- **Then** o backend ainda responde `403` via `requirePermission` (**US-10**) — o front é conveniência, não a barreira de segurança.

### CA-05 — Sem regressão para o admin atual
- **Given** o papel `admin` (com todas as permissões)
- **When** uso o painel
- **Then** todos os itens e rotas continuam visíveis e acessíveis como hoje.

## Notas técnicas
- `PermissionRepository.listPermissionKeys(userId)` (novo) alimenta o `/me`; `AuthService.me` passa a devolver `permissions`.
- Frontend: `AuthContext` expõe `permissions` + helper `hasPermission(key)`; `Sidebar` filtra o `NAV` (cada entrada ganha um campo `perm` opcional); wrapper `RequirePermission` protege as rotas, composto com o `ProtectedRoute` atual.
- Mantém a decisão de RBAC do `CLAUDE.md`: autorizar **por permissão**, nunca por nome de role.

## Dependências
- **US-10** (autorização por permissão), **US-13** (menu lateral). Habilita o gating citado em US-23/24/25.

## Definição de pronto
- [ ] `/me` retorna `permissions`.
- [ ] Itens de menu escondidos e rotas bloqueadas conforme permissão.
- [ ] `admin` segue com acesso total (sem regressão).
- [ ] Validado manualmente no browser.
