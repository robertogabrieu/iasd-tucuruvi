# US-07 — Aceitar convite e definir senha

**Épico:** Gestão de usuários · **Prioridade:** Must · **Estimativa:** 5 pts

> ✅ **Entregue** em `f6685cb`, `440d165`, `f9cc9d4` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-15-gestao-usuarios-design.md) e [plano](../superpowers/plans/2026-06-15-gestao-usuarios.md).

## História

> **Como** pessoa convidada,
> **eu quero** aceitar o convite e criar minha senha,
> **para que** eu ative minha conta e passe a acessar o painel.

## Critérios de aceitação

### CA-01 — Aceite cria a conta
- **Given** um token de convite válido, não expirado e não usado
- **When** envio nome + senha para `POST /api/auth/accept-invite`
- **Then** um usuário `active` é criado com a senha (argon2id)
- **And** a role definida no convite é vinculada em `user_roles`
- **And** o convite é marcado como `accepted` (uso único).

### CA-02 — Token inválido ou expirado
- **Given** um convite inexistente, expirado ou já aceito
- **When** tento aceitar
- **Then** recebo `400` e nenhuma conta é criada.

### CA-03 — Política de senha
- **Given** uma senha que não atende à política
- **When** submeto
- **Then** recebo `422`, sem consumir o convite.

### CA-04 — Login imediato (opcional — Should)
- **Given** que aceitei com sucesso
- **When** a conta é criada
- **Then** posso já receber os cookies de sessão, sem precisar logar de novo.

## Notas técnicas
- Reusa o value object `Password` e o `TokenService`.
- Criação transacional: usuário + vínculo de role + baixa do convite no mesmo `BEGIN/COMMIT`.
- E-mail do usuário herda o e-mail do convite (imutável no aceite).

## Definição de pronto
- [ ] Conta criada com a role correta.
- [ ] Convite consumido (uso único).
- [ ] Transação atômica garantida.
