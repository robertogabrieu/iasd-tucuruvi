# US-03 — Sessão persistente com refresh token rotativo

**Épico:** Autenticação · **Prioridade:** Must · **Estimativa:** 8 pts

## História

> **Como** Administrador,
> **eu quero** permanecer logado por um tempo sem digitar a senha a cada acesso,
> **para que** eu trabalhe no painel sem interrupções, mas sem abrir mão da segurança.

## Critérios de aceitação

### CA-01 — Renovação do access token
- **Given** que meu access token expirou mas o refresh ainda é válido
- **When** chamo `POST /api/auth/refresh`
- **Then** recebo um **novo par** (access + refresh) em cookies
- **And** o refresh token anterior é revogado (**rotação**).

### CA-02 — Detecção de reuso
- **Given** que um refresh token já foi rotacionado (revogado)
- **When** ele é apresentado novamente (possível roubo)
- **Then** recebo `401`
- **And** **toda a família** de refresh tokens daquele usuário é revogada, forçando novo login.

### CA-03 — Expiração do refresh
- **Given** que o refresh token expirou (passou o `JWT_REFRESH_TTL`)
- **When** tento renovar
- **Then** recebo `401` e preciso logar novamente.

### CA-04 — Access válido acessa rota protegida
- **Given** um access token válido
- **When** acesso uma rota `/api/admin/*`
- **Then** o middleware de autenticação me identifica sem consultar o refresh.

## Notas técnicas
- Família de tokens correlacionada por `user_id` (+ `family_id` opcional) em `refresh_tokens`.
- Rotação e detecção de reuso no `TokenService` + `RefreshTokenRepository`.
- TTLs configuráveis via env: `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`.
- Tokens guardados **hashados** no banco; comparação por hash.

## Definição de pronto
- [ ] Rotação emite novo par e revoga o anterior.
- [ ] Reuso de token revogado dispara revogação da família.
- [ ] Expiração tratada corretamente.
