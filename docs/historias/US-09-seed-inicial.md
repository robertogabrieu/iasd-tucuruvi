# US-09 — Seed do usuário e role iniciais

**Épico:** Bootstrap · **Prioridade:** Must · **Estimativa:** 3 pts

> ✅ **Entregue** em `b8c1843` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-14-autenticacao-design.md) e [plano](../superpowers/plans/2026-06-15-autenticacao.md).

## História

> **Como** responsável pelo deploy,
> **eu quero** que o primeiro usuário administrador e a role padrão sejam criados automaticamente no primeiro boot,
> **para que** seja possível acessar o painel sem o problema do "ovo e a galinha" (não há ninguém para convidar o primeiro).

## Critérios de aceitação

### CA-01 — Seed da role e permissões
- **Given** um banco recém-criado (migrations aplicadas)
- **When** o servidor inicia
- **Then** a role `admin` é criada com **todas** as permissões do catálogo
- **And** o catálogo de `permissions` é populado.

### CA-02 — Seed do primeiro usuário
- **Given** as variáveis `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` definidas
- **When** o servidor inicia e ainda **não** existe nenhum usuário
- **Then** é criado um usuário `active` com essas credenciais (senha em argon2id)
- **And** ele recebe a role `admin`.

### CA-03 — Idempotência
- **Given** que o seed já rodou antes (já existem usuários/roles)
- **When** o servidor reinicia
- **Then** o seed **não** duplica nem sobrescreve dados existentes.

### CA-04 — Ausência de variáveis
- **Given** que `SEED_ADMIN_*` não estão definidas e não há usuários
- **When** o servidor inicia
- **Then** registra um aviso claro no log e segue sem criar o usuário (não quebra o boot).

## Notas técnicas
- Seed roda após as migrations, no startup (`core/db.ts` + rotina de seed).
- `deploy.sh` gera `SEED_ADMIN_PASSWORD` e a exibe **uma vez** ao final.
- Reaproveita os repositórios/serviços de usuário e role (não duplica SQL).

## Definição de pronto
- [ ] Role `admin` + permissões semeadas.
- [ ] Primeiro usuário criado a partir das envs.
- [ ] Reexecução não duplica dados.
