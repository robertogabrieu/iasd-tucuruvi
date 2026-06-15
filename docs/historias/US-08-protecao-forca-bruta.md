# US-08 — Proteção contra força bruta

**Épico:** Autenticação · **Prioridade:** Must · **Estimativa:** 5 pts

> ✅ **Entregue** em `7d4a445`, `0364f08` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-14-autenticacao-design.md) e [plano](../superpowers/plans/2026-06-15-autenticacao.md).

## História

> **Como** responsável pela segurança do site,
> **eu quero** que tentativas repetidas de login sejam bloqueadas,
> **para que** ninguém consiga adivinhar senhas por tentativa e erro.

## Critérios de aceitação

### CA-01 — Rate limit por IP
- **Given** muitas tentativas de login a partir do mesmo IP em curto intervalo
- **When** o limite é excedido
- **Then** recebo `429 Too Many Requests` até a janela expirar.

### CA-02 — Lockout por conta
- **Given** que uma conta acumulou N falhas consecutivas (`failed_login_count`)
- **When** uma nova tentativa chega
- **Then** a conta fica bloqueada até `locked_until` (bloqueio **progressivo**: cresce a cada novo ciclo de falhas)
- **And** mesmo com a senha correta, o login é recusado até o bloqueio expirar.

### CA-03 — Reset ao logar com sucesso
- **Given** um login bem-sucedido dentro do permitido
- **When** ele ocorre
- **Then** `failed_login_count` é zerado e `locked_until` é limpo.

### CA-04 — Mensagens não vazam estado
- **Given** uma conta bloqueada
- **When** o login é recusado
- **Then** a mensagem é genérica, sem confirmar se a senha estava certa.

## Notas técnicas
- Rate limit por IP reaproveita/estende `server/lib/rate-limit.ts`.
- Lockout por conta usa `failed_login_count` e `locked_until` em `users`.
- Lógica encapsulada no `auth.service` (não no controller), reutilizável por testes.
- Parâmetros (N, janelas, backoff) configuráveis por env/constantes.

## Definição de pronto
- [ ] Rate limit por IP retornando `429`.
- [ ] Lockout progressivo por conta funcionando.
- [ ] Contadores zerados em login bem-sucedido.
