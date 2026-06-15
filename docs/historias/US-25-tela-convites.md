# US-25 — Tela de convites

**Épico:** Painel — Administração de Usuários · **Prioridade:** Must · **Estimativa:** 3 pts

> ⏳ **Pendente** — branch `feat/area-administrativa`. Origem: [issue #8](https://github.com/robertogabrieu/iasd-tucuruvi/issues/8).

## História

> **Como** Administrador,
> **eu quero** convidar pessoas e acompanhar os convites pendentes, podendo revogar ou reenviar,
> **para que** eu controle o acesso *invite-only* do painel inteiramente pela interface.

## Critérios de aceitação

### CA-01 — Convidar pela interface
- **Given** que tenho a permissão `users:invite`
- **When** preencho e-mail + papel e envio na tela `/painel/usuarios/convites`
- **Then** a UI chama `POST /api/admin/invitations` (**US-06**) e o convite é criado e enviado por e-mail
- **And** e-mail já cadastrado resulta em `409` exibido na tela (US-06 CA-03).

### CA-02 — Listar convites pendentes (paginado)
- **Given** que tenho `users:invite`
- **When** a tela carrega (`GET /api/admin/invitations?page=1&limit=20`)
- **Then** vejo os convites pendentes — e-mail, papel, quem convidou e expiração — no envelope paginado padrão `{ data, pagination }`
- **And** a paginação é feita **no backend** (convenção do `CLAUDE.md`).

### CA-03 — Revogar convite
- **Given** um convite pendente na lista
- **When** aciono "Revogar" (`DELETE /api/admin/invitations/:id`)
- **Then** o convite passa a `revoked` e some dos pendentes; o link de aceite correspondente deixa de funcionar (`400` em US-07).

### CA-04 — Reenviar convite
- **Given** um convite pendente
- **When** aciono "Reenviar"
- **Then** o `POST /api/admin/invitations` é chamado novamente para o mesmo e-mail, invalidando o anterior e emitindo um novo (US-06 CA-04).

### CA-05 — Autorização obrigatória
- **Given** que **não** tenho `users:invite`
- **When** tento convidar, listar ou revogar
- **Then** recebo `403` e a UI esconde a tela (ver **US-26**).

## Notas técnicas
- Endpoints novos: `GET /api/admin/invitations` e `DELETE /api/admin/invitations/:id` (ambos perm `users:invite`); o `InvitationRepository` ganha `listPending` (paginado), `findById` e `revoke`.
- Convidar e reenviar **reaproveitam** o `POST /api/admin/invitations` já entregue em **US-06**.
- O papel é escolhido a partir de `GET /api/admin/roles` (catálogo de referência, **não** paginado).

## Dependências
- **US-06** (convidar), **US-07** (aceitar), **US-26** (gating de permissão).

## Definição de pronto
- [ ] Convidar, listar (paginado), revogar e reenviar pela interface.
- [ ] Endpoints exigindo `users:invite`.
- [ ] Validado manualmente no browser + Mailpit.
