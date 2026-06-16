# Histórias de Usuário — Área Administrativa (Auth + RBAC)

Backlog da expansão de **área de usuário** do site IASD Tucuruvi: autenticação, recuperação de senha e segurança, com backend Express + PostgreSQL e autorização RBAC.

As histórias seguem o padrão **Mountain Goat Software** ([referência](https://www.mountaingoatsoftware.com/agile/user-stories)):

> **Como** `<persona>`, **eu quero** `<objetivo>`, **para que** `<benefício>`.

Cada arquivo contém: a narrativa da história, critérios de aceitação no formato **Given / When / Then**, notas técnicas e a definição de pronto (DoD).

## Personas

- **Administrador** — pessoa da equipe/secretaria da igreja com acesso ao painel para gerenciar o conteúdo do site. Hoje todos os usuários têm a role `admin`.
- **Sistema** — rotinas automáticas (seed, expiração de tokens) descritas como ator quando não há pessoa envolvida.

## Status de entrega

**Épico de Autenticação — ENTREGUE** ✅ (branch `feat/area-administrativa`). Inclui US-01, US-02,
US-03, US-04, US-05, US-08 e o bootstrap US-09, mais a fundação compartilhada (schema, `core/security`,
hierarquia de erros, `requireAuth`, CSRF) e as telas mínimas de auth (login, esqueci, redefinir, painel).

- **Spec:** [`docs/superpowers/specs/2026-06-14-autenticacao-design.md`](../superpowers/specs/2026-06-14-autenticacao-design.md)
- **Plano:** [`docs/superpowers/plans/2026-06-15-autenticacao.md`](../superpowers/plans/2026-06-15-autenticacao.md)
- **Fora deste épico (specs próprias):** RBAC granular (US-10/11), convites (US-06/07), painel/configurações (US-13/14) e demais.

Legenda: ✅ Entregue · ⏳ Pendente. A coluna *Commits* aponta os commits principais de cada história
(commits de fundação que as sustentam: `6f5de4f` deps · `2bfe5ca` config · `e231e8f` erros · `77db8ac`
schema · `823a962` Password · `196b760` TokenService · `f726a39` CSRF · `625a526` repos · `8efd5cc`
cookies/DTO/requireAuth · `7a2167c` transações · telas `7ad1775`/`1b36e9a`).

## Backlog

| Épico | # | História | Status | Commits |
|-------|---|----------|--------|---------|
| **Autenticação** | [US-01](US-01-login.md) | Login com e-mail e senha | ✅ | `7d4a445`, `0364f08` |
| | [US-02](US-02-logout.md) | Logout | ✅ | `d7ef99e` |
| | [US-03](US-03-sessao-persistente.md) | Sessão persistente com refresh token rotativo | ✅ | `d7ef99e` |
| | [US-04](US-04-esqueci-senha.md) | Esqueci minha senha | ✅ | `a3c9853` |
| | [US-05](US-05-redefinir-senha.md) | Redefinir senha via token de uso único | ✅ | `a3c9853` |
| | [US-08](US-08-protecao-forca-bruta.md) | Proteção contra força bruta | ✅ | `7d4a445`, `0364f08` |
| **Autorização (RBAC)** | [US-10](US-10-autorizacao-por-permissao.md) | Autorizar ações por permissão | ✅ | `5b707e6`, `5ce9572`, `c4e0cca` |
| | [US-11](US-11-gerenciar-papeis.md) | Gerenciar papéis de um usuário | ✅ | `c03d5cc`, `ada4b59`, `e40cda7` |
| **Gestão de usuários** | [US-06](US-06-convidar-usuario.md) | Convidar novo usuário | ✅ | `7415ffb`, `d5b1108`, `f6685cb`, `440d165` |
| | [US-07](US-07-aceitar-convite.md) | Aceitar convite e definir senha | ✅ | `f6685cb`, `440d165`, `f9cc9d4` |
| **Bootstrap** | [US-09](US-09-seed-inicial.md) | Seed do usuário e role iniciais | ✅ | `b8c1843` |
| **Interface do Painel** | [US-13](US-13-menu-lateral.md) | Menu lateral colapsável do painel | ✅ | `77a69cb`, `2509a18`, `f30cc4a`, `90307d5`, `a0547f3` |
| | [US-14](US-14-configuracoes-email.md) | Tela de configurações (e-mail do sistema) | ✅ | `bc67dda`, `b043b78`, `85e8573`, `fa6ff42`, `38124ad` |
| **Segurança (transversal)** | [US-15](US-15-criptografia-segredos.md) | Criptografia de segredos de configuração | ✅ | `7ca3764`, `c2143d3`, `9f50003` |
| **Boletim Informativo** | [US-16](US-16-editor-boletim.md) | Editor de boletim (blocos) | ⏳ | — |
| | [US-17](US-17-biblioteca-midia.md) | Biblioteca de mídia (upload e reuso de imagens) | ⏳ | — |
| | [US-18](US-18-publicar-gerar-link.md) | Publicar boletim e gerar link | ⏳ | — |
| | [US-19](US-19-pagina-publica-preview.md) | Página pública do boletim + preview no WhatsApp | ⏳ | — |
| | [US-20](US-20-gerenciar-boletins.md) | Listar e gerenciar boletins | ⏳ | — |
| | [US-21](US-21-templates-boletim.md) | Templates de boletim | ⏳ | — |
| **Redirecionamento de Links** | [US-22](US-22-redirecionamento-links.md) | Encurtador/redirecionador de links próprio | ⏳ | — |
| **Painel — Administração de Usuários** | [US-23](US-23-listar-usuarios.md) | Listar usuários no painel | ✅ | `65cb7e9`, `fe46828`, `82ae51e`, `ec6876b` |
| | [US-24](US-24-detalhe-usuario.md) | Detalhe do usuário (editar/ativar/desbloquear/reset) | ✅ | `858d59b`, `fca84f3`, `1a63721`, `4aafb7d` |
| | [US-25](US-25-tela-convites.md) | Tela de convites (convidar/listar/revogar/reenviar) | ✅ | `7eb108e`, `b1fa971` |
| | [US-26](US-26-permissoes-no-painel.md) | Permissões refletidas no painel | ✅ | `a67e607`, `8d55f7b`, `658efbb`, `55faac9` |
| **Painel — Gestão de Papéis e Permissões** | [US-27](US-27-crud-papeis.md) | CRUD de papéis no painel | ⏳ | — |
| | [US-28](US-28-permissoes-do-papel.md) | Editar permissões de um papel | ⏳ | — |

> **Épico "Painel — Administração de Usuários"** — preenche o gap da [issue #8](https://github.com/robertogabrieu/iasd-tucuruvi/issues/8): o backend de gestão de usuários (US-06/07/10/11) está pronto, mas faltavam as telas do painel (`/painel/usuarios/*`) e os endpoints de **listagem** (`GET /api/admin/users`, `GET /api/admin/invitations`). Spec própria, reaproveitando as APIs `/api/admin` existentes.

> **Épico "Painel — Gestão de Papéis e Permissões"** — UI para **CRUD de papéis** e **vínculo papel↔permissão** (tela `/painel/usuarios/papeis`, perm `roles:manage`). Permissões continuam catálogo de código (`permissions.catalog.ts`); o papel `admin` é **protegido** (imutável, sempre com todas as permissões via seed). Fecha a lacuna de "criar papéis / editar permissões pela interface" deixada como fora de escopo no épico anterior.

## Convenções

- **Prioridade:** `MoSCoW` (Must / Should / Could).
- **Estimativa:** story points (escala de Fibonacci), referencial — a serem revisados no planning.
- **Listagens paginadas no backend:** todo `GET` de coleção que cresce (usuários, convites, futuros boletins) é paginado no servidor pelo contrato padrão `?page=&limit=` + envelope `{ data, pagination }`. Catálogos de referência fixos (papéis, permissões) são isentos. Padrão registrado no `CLAUDE.md`.
- Detalhes de arquitetura/segurança no `CLAUDE.md`, seção *Backend — Área Administrativa, Autenticação e RBAC*.
