# US-24 — Detalhe do usuário

**Épico:** Painel — Administração de Usuários · **Prioridade:** Should · **Estimativa:** 5 pts

> ✅ **Entregue** em `858d59b`, `fca84f3`, `1a63721`, `4aafb7d` — branch `feat/area-administrativa`. Origem: [issue #8](https://github.com/robertogabrieu/iasd-tucuruvi/issues/8). Ver [spec](../superpowers/specs/2026-06-15-painel-admin-usuarios-design.md) e [plano](../superpowers/plans/2026-06-15-painel-admin-usuarios.md).

## História

> **Como** Administrador,
> **eu quero** abrir a página de um usuário e editar seus dados, ativar/desativar a conta, desbloquear o acesso e disparar a redefinição de senha,
> **para que** eu administre cada conta de ponta a ponta pela interface, sem precisar do banco.

## Critérios de aceitação

### CA-01 — Ver o detalhe
- **Given** que tenho a permissão `users:read`
- **When** acesso `/painel/usuarios/:id` (que chama `GET /api/admin/users/:id`)
- **Then** vejo nome, e-mail, status, papéis, último login e data de criação
- **And** um `:id` inexistente resulta em `404` tratado na tela.

### CA-02 — Editar nome e e-mail
- **Given** o detalhe de um usuário
- **When** altero nome e/ou e-mail e salvo (`PATCH /api/admin/users/:id`, perm `users:manage`)
- **Then** os dados são atualizados
- **And** se o e-mail já pertence a outro usuário, recebo `409` e a alteração é rejeitada.

### CA-03 — Ativar / desativar conta
- **Given** o detalhe de um usuário
- **When** alterno o status (`PATCH /api/admin/users/:id/status`, perm `users:manage`)
- **Then** a conta passa a `active`/`disabled`
- **And** ao **desativar**, os refresh tokens do usuário são revogados (a sessão dele cai)
- **And** desativar o **último** admin ativo é bloqueado com `409` (mesmo guard de US-11 CA-04).

### CA-04 — Desbloquear conta
- **Given** um usuário travado por tentativas de login (lockout de **US-08**)
- **When** aciono "Desbloquear" (`POST /api/admin/users/:id/unlock`, perm `users:manage`)
- **Then** `failed_login_count`, `locked_until` e `lock_cycle_count` são zerados e o usuário volta a poder logar.

### CA-05 — Disparar redefinição de senha
- **Given** o detalhe de um usuário
- **When** aciono "Enviar redefinição de senha" (`POST /api/admin/users/:id/password-reset`, perm `users:manage`)
- **Then** o fluxo de **US-04/05** é reaproveitado (`AuthService.forgotPassword`) e um e-mail com token de uso único é enviado (Mailpit em dev)
- **And** a resposta da API é genérica (não confirma detalhes da conta).

### CA-06 — Gerenciar papéis no detalhe
- **Given** o detalhe de um usuário
- **When** adiciono/removo papéis inline
- **Then** os endpoints de **US-11** são consumidos, com o `409` do último admin tratado.

### CA-07 — Autorização obrigatória
- **Given** que tenho `users:read` mas **não** `users:manage`
- **When** tento qualquer mutação (editar, status, desbloquear, reset)
- **Then** recebo `403` e a UI esconde/desabilita essas ações (ver **US-26**).

## Notas técnicas
- Endpoints novos no módulo `users`: `GET /users/:id`, `PATCH /users/:id`, `PATCH /users/:id/status`, `POST /users/:id/unlock`, `POST /users/:id/password-reset`.
- **Nova permissão** `users:manage` no `permissions.catalog.ts` (cobre editar/status/desbloquear/reset) — religada ao `admin` no seed, **sem migration**.
- Desativação reaproveita `RefreshTokenRepository.revokeAllForUser`; como `requirePermission` já filtra `status = 'active'`, o acesso protegido cai de imediato e o access token curto expira em seguida.
- Redefinição de senha reaproveita `AuthService.forgotPassword` — sem duplicar a lógica de token de reset.

## Dependências
- **US-04/05** (reset de senha), **US-08** (lockout), **US-11** (papéis), **US-23** (lista), **US-26** (gating).

## Definição de pronto
- [ ] Editar nome/e-mail com unicidade (`409`).
- [ ] Ativar/desativar com revogação de sessão e guard do último admin.
- [ ] Desbloquear e disparar redefinição de senha funcionando.
- [ ] Mutações exigem `users:manage`; validado manualmente no browser.
