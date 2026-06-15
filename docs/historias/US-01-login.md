# US-01 — Login com e-mail e senha

**Épico:** Autenticação · **Prioridade:** Must · **Estimativa:** 5 pts

> ✅ **Entregue** em `7d4a445`, `0364f08` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-14-autenticacao-design.md) e [plano](../superpowers/plans/2026-06-15-autenticacao.md).

## História

> **Como** Administrador,
> **eu quero** entrar no painel com meu e-mail e senha,
> **para que** eu possa acessar as áreas restritas de gestão do site com segurança.

## Critérios de aceitação

### CA-01 — Login bem-sucedido
- **Given** que existo como usuário `active` com a senha correta
- **When** envio e-mail e senha válidos para `POST /api/auth/login`
- **Then** recebo `200`, um cookie de **access token** e um de **refresh token** (`httpOnly`, `Secure`, `SameSite=Strict`)
- **And** meu `last_login_at` é atualizado e meu `failed_login_count` é zerado.

### CA-02 — Credenciais inválidas
- **Given** um e-mail inexistente **ou** uma senha incorreta
- **When** tento logar
- **Then** recebo `401` com mensagem **genérica** ("Credenciais inválidas")
- **And** a resposta não revela se o e-mail existe ou não.

### CA-03 — Conta desabilitada
- **Given** que meu usuário está com status `disabled`
- **When** informo credenciais corretas
- **Then** recebo `403` e nenhum token é emitido.

### CA-04 — Validação de entrada
- **Given** um corpo sem e-mail válido ou sem senha
- **When** chamo o endpoint
- **Then** recebo `422` com os erros de validação (Zod), sem consultar o banco.

## Notas técnicas
- Senha verificada com **argon2id** (`core/security/password.ts`).
- Tokens emitidos por `TokenService`; sessão registrada em `refresh_tokens` (hash).
- Camadas: `auth.routes → auth.controller → auth.service → admin-user.repository`.
- Cooperar com **US-08** (incrementa `failed_login_count` a cada falha).

## Definição de pronto
- [ ] Endpoint implementado seguindo a arquitetura em camadas.
- [ ] Respostas de erro não vazam existência de conta.
- [ ] Cookies com flags de segurança corretas.
- [ ] Validado manualmente no browser + via Mailpit/DB quando aplicável.
