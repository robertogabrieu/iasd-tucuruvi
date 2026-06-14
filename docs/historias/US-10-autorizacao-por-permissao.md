# US-10 — Autorizar ações por permissão (RBAC)

**Épico:** Autorização (RBAC) · **Prioridade:** Must · **Estimativa:** 8 pts

## História

> **Como** responsável pela segurança do painel,
> **eu quero** que cada ação protegida exija uma permissão específica,
> **para que** cada pessoa só faça aquilo que sua role permite, hoje e quando houver mais de uma role.

## Critérios de aceitação

### CA-01 — Acesso autorizado
- **Given** que estou autenticado e minha role concede a permissão `X`
- **When** acesso uma rota protegida por `requirePermission('X')`
- **Then** a requisição prossegue normalmente.

### CA-02 — Acesso negado por falta de permissão
- **Given** que estou autenticado mas **nenhuma** das minhas roles concede `X`
- **When** tento acessar a rota
- **Then** recebo `403 Forbidden`.

### CA-03 — Sem autenticação
- **Given** que não estou autenticado (sem access token válido)
- **When** tento acessar qualquer rota `/api/admin/*`
- **Then** recebo `401 Unauthorized` antes mesmo da checagem de permissão.

### CA-04 — Permissões agregadas por múltiplas roles
- **Given** que tenho duas roles e a permissão `X` está em apenas uma delas
- **When** acesso a rota protegida por `X`
- **Then** o acesso é concedido (permissões são a **união** das roles).

### CA-05 — Catálogo de permissões versionado
- **Given** o catálogo de `permissions` (ex.: `users:invite`, `users:read`, `roles:assign`, `sermons:write`)
- **When** uma nova feature precisa de permissão
- **Then** basta inserir a permissão e vinculá-la a uma role, **sem** alterar o middleware.

## Notas técnicas
- Middleware `requireAuth` (valida JWT) + `requirePermission('chave')`.
- Permissões do usuário resolvidas via `users → user_roles → roles → role_permissions → permissions`, com possível cache por requisição.
- Autorização por **permissão**, nunca por nome de role (decisão de RBAC do `CLAUDE.md`).
- Erros via hierarquia `UnauthorizedError` / `ForbiddenError` + handler central.

## Definição de pronto
- [ ] `requireAuth` e `requirePermission` implementados e reutilizáveis.
- [ ] União de permissões de múltiplas roles respeitada.
- [ ] Distinção correta entre `401` (sem auth) e `403` (sem permissão).
