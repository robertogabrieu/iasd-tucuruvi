# US-23 — Listar usuários no painel

**Épico:** Painel — Administração de Usuários · **Prioridade:** Must · **Estimativa:** 5 pts

> ✅ **Entregue** em `65cb7e9`, `fe46828`, `82ae51e`, `ec6876b` — branch `feat/area-administrativa`. Origem: [issue #8](https://github.com/robertogabrieu/iasd-tucuruvi/issues/8). Ver [spec](../superpowers/specs/2026-06-15-painel-admin-usuarios-design.md) e [plano](../superpowers/plans/2026-06-15-painel-admin-usuarios.md).

## História

> **Como** Administrador,
> **eu quero** ver a lista de todos os usuários do painel com seus papéis e status, e gerenciar os papéis de cada um ali mesmo,
> **para que** eu acompanhe quem tem acesso e ajuste permissões rapidamente, sem mexer no banco.

## Critérios de aceitação

### CA-01 — Listagem paginada
- **Given** que tenho a permissão `users:read`
- **When** chamo `GET /api/admin/users?page=1&limit=20`
- **Then** recebo os usuários no envelope paginado padrão `{ data, pagination: { page, limit, total, totalPages } }`
- **And** a paginação é feita **no backend** (ver convenção de paginação no `CLAUDE.md`), nunca no client.

### CA-02 — Conteúdo de cada usuário
- **Given** a lista renderizada no painel (`/painel/usuarios`)
- **When** vejo uma linha
- **Then** ela mostra **nome**, **e-mail**, **status** (ativo/desativado), **papéis** e **último login**.

### CA-03 — Gerenciar papéis pela própria lista
- **Given** um usuário na lista
- **When** aciono "Gerenciar papéis"
- **Then** abre um **modal** onde adiciono/removo papéis do usuário (consumindo os endpoints de **US-11**: `GET /api/admin/roles`, `POST`/`DELETE /api/admin/users/:id/roles`)
- **And** a lista reflete os papéis atualizados ao fechar.

### CA-04 — Guard "último administrador" no modal
- **Given** que tento remover o último papel administrativo do último admin pelo modal
- **When** confirmo a remoção
- **Then** o backend responde `409` (US-11 CA-04) e o modal exibe a mensagem de bloqueio sem quebrar a tela.

### CA-05 — Navegação para detalhe e convite
- **Given** a lista
- **When** clico em um usuário
- **Then** vou para a página de detalhe dele (**US-24**)
- **And** há um atalho "Convidar" que leva à tela de convites (**US-25**).

### CA-06 — Autorização obrigatória
- **Given** que **não** tenho `users:read`
- **When** tento acessar a lista
- **Then** a tela não é exibida (ver gating em **US-26**) e a API responde `403`.

## Notas técnicas
- Novo endpoint `GET /api/admin/users` (perm `users:read`, já no catálogo) — módulo `users` ganha controller/service/routes (hoje só há `user.repository.ts`).
- O repositório lista usuários **com seus papéis** e o `count` total para a paginação.
- Reaproveita os endpoints de papéis de **US-11** e o `requirePermission` de **US-10**.
- Catálogos de referência (papéis) **não** paginam — alimentam o `<select>` inteiros.

## Dependências
- **US-11** (papéis), **US-24** (detalhe), **US-25** (convites), **US-26** (gating de permissão).

## Definição de pronto
- [ ] `GET /api/admin/users` paginado no backend, exigindo `users:read`.
- [ ] Lista mostra nome/e-mail/status/papéis/último login.
- [ ] Modal de papéis funcionando, com `409` do último admin tratado.
- [ ] Validado manualmente no browser.
