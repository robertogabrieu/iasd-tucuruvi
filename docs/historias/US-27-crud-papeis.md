# US-27 — CRUD de papéis no painel

**Épico:** Painel — Gestão de Papéis e Permissões · **Prioridade:** Should · **Estimativa:** 5 pts

> ✅ **Entregue** em `0635800`, `117ac7a`, `ccef82c`, `85a0a5e`, `be3ba37` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-15-painel-papeis-permissoes-design.md) e [plano](../superpowers/plans/2026-06-15-painel-papeis-permissoes.md).

## História

> **Como** Administrador,
> **eu quero** criar, renomear e excluir papéis no painel,
> **para que** eu modele níveis de acesso (ex.: `editor`, `viewer`) sem depender de SQL ou do seed.

## Critérios de aceitação

### CA-01 — Listar papéis para gestão
- **Given** que tenho a permissão `roles:manage`
- **When** abro `/painel/usuarios/papeis` (que chama `GET /api/admin/roles/manage`)
- **Then** vejo cada papel com **nome**, **chave (`key`)**, **nº de permissões** e **nº de usuários** que o possuem.

### CA-02 — Criar papel
- **Given** a tela de papéis
- **When** crio um papel informando o **nome** (`POST /api/admin/roles`)
- **Then** o papel é criado com uma **`key` gerada por slug** (minúsculas, sem acento, espaços → `-`; ex.: "Editor de Conteúdo" → `editor-de-conteudo`), única (sufixo numérico em colisão)
- **And** nome/chave que colida com papel existente resulta em `409`.

### CA-03 — Renomear papel
- **Given** um papel existente (não-`admin`)
- **When** altero o **nome** (`PATCH /api/admin/roles/:id`)
- **Then** o nome é atualizado
- **And** a **`key` é imutável** (não muda ao renomear), para não quebrar referências.

### CA-04 — Excluir papel
- **Given** um papel existente (não-`admin`)
- **When** aciono "Excluir" (`DELETE /api/admin/roles/:id`)
- **Then** a UI **confirma mostrando quantos usuários** perderão o papel
- **And** ao confirmar, o papel é excluído e os vínculos em `user_roles`/`role_permissions` são removidos (cascade).

### CA-05 — Papel `admin` protegido
- **Given** o papel `admin`
- **When** tento renomear ou excluir
- **Then** a API responde `409` ("papel protegido") e a UI bloqueia essas ações para ele.

### CA-06 — Autorização obrigatória
- **Given** que **não** tenho `roles:manage`
- **When** tento acessar a tela ou os endpoints
- **Then** recebo `403` e o item "Papéis" não aparece no menu (ver gating de **US-26**).

### CA-07 — Navegação
- **Given** o menu lateral
- **When** tenho `roles:manage`
- **Then** o grupo **Usuários** mostra **Lista · Convites · Papéis**, com **Papéis** levando a `/painel/usuarios/papeis`.

## Notas técnicas
- Nova permissão **`roles:manage`** no catálogo (distinta de `roles:assign`, que é *atribuir papéis a usuários*); religada ao `admin` no seed, **sem migration**.
- Estende o módulo `roles` (controller/service/repository/routes); o `GET /api/admin/roles` existente (perm `roles:assign`, usado pelos seletores de RolesModal/Convites) **fica intocado**.
- Edição de permissões de um papel é a **US-28**.

## Dependências
- **US-10** (autorização por permissão), **US-11** (atribuir papéis a usuários), **US-26** (gating no painel), **US-28** (permissões do papel).

## Definição de pronto
- [ ] Criar (slug de `key`), renomear e excluir papéis, exigindo `roles:manage`.
- [ ] `admin` protegido contra rename/delete.
- [ ] Exclusão confirma com a contagem de usuários afetados.
- [ ] Validado manualmente no browser.
