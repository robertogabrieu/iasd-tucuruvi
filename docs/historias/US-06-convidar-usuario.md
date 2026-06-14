# US-06 — Convidar novo usuário

**Épico:** Gestão de usuários · **Prioridade:** Must · **Estimativa:** 5 pts

## História

> **Como** Administrador,
> **eu quero** convidar uma nova pessoa por e-mail e já definir a role dela,
> **para que** apenas pessoas autorizadas entrem no painel (acesso *invite-only*).

## Critérios de aceitação

### CA-01 — Convite enviado
- **Given** que tenho a permissão `users:invite`
- **When** envio e-mail + role para `POST /api/admin/invitations`
- **Then** um convite com token de **uso único** e expiração (~7 dias) é criado (hashado)
- **And** um e-mail com o link de aceite é enviado (Mailpit em dev)
- **And** registra-se `invited_by` (quem convidou).

### CA-02 — Autorização obrigatória
- **Given** que **não** tenho a permissão `users:invite`
- **When** tento convidar
- **Then** recebo `403` (ver **US-10**).

### CA-03 — E-mail já cadastrado
- **Given** um e-mail que já pertence a um usuário existente
- **When** tento convidar
- **Then** recebo `409` e nenhum convite é criado.

### CA-04 — Reenvio de convite
- **Given** um convite pendente para um e-mail
- **When** convido o mesmo e-mail de novo
- **Then** o convite anterior é invalidado e um novo é emitido.

## Notas técnicas
- Convite em `invitations` (token **hashado**, `role_id`, `expires_at`, `invited_by`).
- A role atribuída deve existir em `roles`.
- Continua em **US-07** (aceite do convite).

## Definição de pronto
- [ ] Convite criado e e-mail entregue no Mailpit.
- [ ] Permissão `users:invite` exigida.
- [ ] Conflito de e-mail existente tratado.
