# US-05 — Redefinir senha via token de uso único

**Épico:** Autenticação · **Prioridade:** Must · **Estimativa:** 5 pts

> ✅ **Entregue** em `a3c9853` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-14-autenticacao-design.md) e [plano](../superpowers/plans/2026-06-15-autenticacao.md).

## História

> **Como** Administrador que recebeu o link de redefinição,
> **eu quero** cadastrar uma nova senha usando o token do e-mail,
> **para que** eu volte a acessar o painel com uma credencial nova e segura.

## Critérios de aceitação

### CA-01 — Redefinição bem-sucedida
- **Given** um token válido, não expirado e ainda não usado
- **When** envio token + nova senha para `POST /api/auth/reset-password`
- **Then** minha senha é regravada com **argon2id**
- **And** o token é marcado como `used` (uso único)
- **And** **todas as sessões** ativas (refresh tokens) são revogadas, exigindo novo login.

### CA-02 — Token inválido ou expirado
- **Given** um token inexistente, expirado ou já usado
- **When** tento redefinir
- **Then** recebo `400` com mensagem genérica e a senha **não** é alterada.

### CA-03 — Política de senha
- **Given** uma nova senha que não atende à política (mínimo de caracteres, etc.)
- **When** submeto
- **Then** recebo `422` com o motivo, sem consumir o token.

## Notas técnicas
- Validação do token por **hash** em `password_reset_tokens`.
- Política de senha centralizada no value object `Password` (`core/security/password.ts`) e reutilizada em **US-07**.
- Revogação de sessões reaproveita o `RefreshTokenRepository` de **US-03**.

## Definição de pronto
- [ ] Token de uso único realmente consumido após sucesso.
- [ ] Sessões antigas revogadas.
- [ ] Política de senha aplicada server-side.
