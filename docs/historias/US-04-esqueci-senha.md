# US-04 — Esqueci minha senha

**Épico:** Autenticação · **Prioridade:** Must · **Estimativa:** 5 pts

> ✅ **Entregue** em `a3c9853` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-14-autenticacao-design.md) e [plano](../superpowers/plans/2026-06-15-autenticacao.md).

## História

> **Como** Administrador que esqueceu a senha,
> **eu quero** solicitar um link de redefinição por e-mail,
> **para que** eu recupere o acesso ao painel sem depender de outra pessoa.

## Critérios de aceitação

### CA-01 — Solicitação gera link por e-mail
- **Given** que existo como usuário `active`
- **When** envio meu e-mail para `POST /api/auth/forgot-password`
- **Then** um token de redefinição de **uso único** é criado (hashado, com expiração curta — ~30 min)
- **And** recebo por e-mail (via Mailpit em dev) um link contendo o token.

### CA-02 — Não vaza existência de conta
- **Given** um e-mail que **não** existe ou de conta `disabled`
- **When** faço a solicitação
- **Then** recebo a **mesma** resposta genérica de sucesso (`200`), sem revelar se a conta existe
- **And** nenhum e-mail é enviado.

### CA-03 — Invalida tokens anteriores
- **Given** que já solicitei antes
- **When** solicito de novo
- **Then** tokens de redefinição anteriores não usados são invalidados (só o mais recente vale).

### CA-04 — Rate limit
- **Given** várias solicitações para o mesmo e-mail/IP em curto intervalo
- **When** excedo o limite
- **Then** recebo `429`.

## Notas técnicas
- Reaproveita a infra de e-mail existente (`server/lib/mail.ts` / Nodemailer + Mailpit).
- Token persistido em `password_reset_tokens` (apenas o **hash**).
- Continua em **US-05** (consumo do token).

## Definição de pronto
- [ ] E-mail entregue no Mailpit com link válido.
- [ ] Resposta idêntica para conta existente e inexistente.
- [ ] Rate limit ativo.
