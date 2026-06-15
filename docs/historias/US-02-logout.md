# US-02 — Logout

**Épico:** Autenticação · **Prioridade:** Must · **Estimativa:** 2 pts

> ✅ **Entregue** em `d7ef99e` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-14-autenticacao-design.md) e [plano](../superpowers/plans/2026-06-15-autenticacao.md).

## História

> **Como** Administrador,
> **eu quero** encerrar minha sessão,
> **para que** ninguém consiga usar minha conta depois que eu sair, principalmente em computadores compartilhados.

## Critérios de aceitação

### CA-01 — Logout encerra a sessão
- **Given** que estou autenticado (cookies válidos)
- **When** chamo `POST /api/auth/logout`
- **Then** o **refresh token** atual é marcado como `revoked` no banco
- **And** os cookies de access e refresh são limpos na resposta (`Max-Age=0`)
- **And** recebo `204`.

### CA-02 — Refresh revogado não renova
- **Given** que fiz logout
- **When** tento usar o refresh token antigo em `POST /api/auth/refresh`
- **Then** recebo `401` e nenhum novo token é emitido.

### CA-03 — Logout idempotente
- **Given** que já não tenho sessão válida
- **When** chamo logout novamente
- **Then** recebo `204` mesmo assim (sem erro), e nada é alterado.

## Notas técnicas
- Revogação no `RefreshTokenRepository` (`revoked_at = now()`).
- Não depende de access token válido; aceita refresh token para identificar a sessão a revogar.
- Opcional (Could): `POST /api/auth/logout-all` revoga **toda a família** de tokens do usuário.

## Definição de pronto
- [ ] Refresh token revogado e cookies limpos.
- [ ] Refresh pós-logout falha com `401`.
- [ ] Idempotência verificada.
