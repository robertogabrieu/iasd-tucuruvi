# US-20 — Listar e gerenciar boletins

**Épico:** Boletim Informativo · **Prioridade:** Should · **Estimativa:** 3 pts

## História

> **Como** Administrador,
> **eu quero** ver todos os boletins num só lugar e gerenciá-los,
> **para que** eu acompanhe o histórico, retome rascunhos e reuse/edite o que já publiquei.

## Critérios de aceitação

### CA-01 — Listagem
- **Given** que tenho a permissão `bulletins:write`
- **When** abro a área de Boletins
- **Then** vejo a lista com **título**, **status** (rascunho/publicado), **data** e ações
- **And** os mais recentes aparecem primeiro.

### CA-02 — Filtrar por status
- **Given** a lista de boletins
- **When** filtro por "rascunhos" ou "publicados"
- **Then** a lista mostra apenas os do status escolhido.

### CA-03 — Ações por boletim
- **Given** um boletim na lista
- **When** uso suas ações
- **Then** posso **editar** (abre o editor — US-16), **publicar/despublicar** (US-18) e **copiar o link** (US-19) quando publicado.

### CA-04 — Excluir
- **Given** um boletim
- **When** o excluo
- **Then** é pedida confirmação
- **And** após confirmar, o boletim é removido (e seu link público deixa de existir).

### CA-05 — Duplicar (opcional — Could)
- **Given** um boletim existente
- **When** escolho "duplicar"
- **Then** um novo rascunho é criado com o mesmo conteúdo, para eu adaptar — útil para o boletim semanal recorrente.

## Notas técnicas (orientação para implementação)
- Listagem paginada/ordenada por data de criação/publicação.
- Reaproveita os serviços/repositório de boletim das demais histórias (sem duplicar lógica).
- Guard `bulletins:write` (US-10); exclusão pode exigir `bulletins:publish` ou permissão própria.

## Dependências
- Integra **US-16**, **US-18** e **US-19**.

## Definição de pronto
- [ ] Lista com título, status, data e ações.
- [ ] Filtro por status.
- [ ] Editar, publicar/despublicar, copiar link e excluir (com confirmação).
