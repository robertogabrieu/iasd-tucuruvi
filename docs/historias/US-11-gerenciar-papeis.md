# US-11 — Gerenciar papéis de um usuário

**Épico:** Autorização (RBAC) · **Prioridade:** Should · **Estimativa:** 5 pts

> ✅ **Entregue** em `c03d5cc`, `ada4b59`, `e40cda7` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-15-gestao-usuarios-design.md) e [plano](../superpowers/plans/2026-06-15-gestao-usuarios.md).

## História

> **Como** Administrador,
> **eu quero** atribuir e remover papéis (roles) de um usuário,
> **para que** eu controle o que cada pessoa pode fazer — já preparado para quando existir mais de uma role.

## Critérios de aceitação

### CA-01 — Listar roles disponíveis
- **Given** que tenho a permissão `roles:assign`
- **When** chamo `GET /api/admin/roles`
- **Then** recebo o catálogo de roles existentes (hoje, ao menos `admin`).

### CA-02 — Atribuir role
- **Given** um usuário e uma role válidos
- **When** chamo `POST /api/admin/users/:id/roles` com a role
- **Then** o vínculo é criado em `user_roles`
- **And** atribuir uma role que o usuário já possui é idempotente (não duplica).

### CA-03 — Remover role
- **Given** um usuário que possui uma role
- **When** chamo `DELETE /api/admin/users/:id/roles/:roleId`
- **Then** o vínculo é removido.

### CA-04 — Não deixar o sistema sem administrador
- **Given** que estou removendo a última role com permissões administrativas do **último** admin
- **When** confirmo a remoção
- **Then** recebo `409` e a operação é bloqueada (sempre deve sobrar ao menos um admin).

### CA-05 — Autorização obrigatória
- **Given** que não tenho `roles:assign`
- **When** tento atribuir/remover roles
- **Then** recebo `403`.

## Notas técnicas
- Opera sobre `user_roles` via repositório dedicado; serviço valida a regra do "último admin".
- A infra suporta múltiplas roles desde já; criação de novas roles (`editor`, `viewer`) é um incremento futuro (Could) que **não** exige migration.
- Reaproveita `requirePermission` de **US-10**.

## Definição de pronto
- [ ] Atribuir/remover roles funcionando e idempotente.
- [ ] Proteção do "último administrador" garantida.
- [ ] Permissão `roles:assign` exigida.
