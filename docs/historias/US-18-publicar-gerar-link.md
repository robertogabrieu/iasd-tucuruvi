# US-18 — Publicar boletim e gerar link

**Épico:** Boletim Informativo · **Prioridade:** Must · **Estimativa:** 5 pts

## História

> **Como** Administrador,
> **eu quero** publicar um boletim e obter um link baseado no título,
> **para que** eu possa compartilhá-lo no grupo de WhatsApp da igreja.

## Contexto
Todo boletim nasce como **rascunho** (US-16). Publicar o torna acessível publicamente numa URL derivada do título (slug). O conteúdo público em si é a **US-19**.

## Critérios de aceitação

### CA-01 — Slug a partir do título
- **Given** um boletim com título (ex.: "Boletim — 14 de junho")
- **When** ele é publicado
- **Then** é gerado um **slug** legível e seguro para URL (ex.: `boletim-14-de-junho`), sem acentos, espaços ou caracteres especiais.

### CA-02 — Unicidade do slug
- **Given** que já existe um boletim publicado com o mesmo slug
- **When** publico outro com título equivalente
- **Then** o sistema garante unicidade (ex.: sufixo incremental `-2`), sem sobrescrever o anterior.

### CA-03 — Publicar
- **Given** um rascunho com título, ao menos um bloco e os metadados mínimos (resumo/capa para o preview)
- **When** clico em **Publicar**
- **Then** o boletim passa ao estado **publicado**, registra `published_at`, e o link público passa a funcionar
- **And** tenho a permissão `bulletins:publish`.

### CA-04 — Estabilidade do link
- **Given** um boletim já publicado e compartilhado
- **When** edito o título depois
- **Then** o slug **não muda** automaticamente (links já enviados continuam válidos)
- **And** qualquer mudança de slug é uma ação explícita e avisada.

### CA-05 — Despublicar
- **Given** um boletim publicado
- **When** o despublico
- **Then** ele volta a rascunho e o link público deixa de exibir o conteúdo (passa a indisponível).

### CA-06 — Bloqueio de publicação incompleta
- **Given** um rascunho sem os requisitos mínimos (ex.: sem título ou sem conteúdo)
- **When** tento publicar
- **Then** a publicação é bloqueada com a indicação do que falta.

## Notas técnicas (orientação para implementação)
- Campos em `bulletins`: `status` (`draft`/`published`), `slug` (único), `published_at`.
- Geração de slug com transliteração (remover acentos) + normalização; checagem de colisão no repositório.
- Slug imutável após a primeira publicação por padrão (preserva links já distribuídos).
- Guard `bulletins:publish` (US-10).

## Dependências
- **US-16** (conteúdo) e **US-19** (página pública que o link aponta).

## Definição de pronto
- [x] Slug gerado do título, sem acentos/caracteres inválidos, único.
- [x] Publicar/despublicar com transição de estado e `published_at`.
- [x] Slug estável após publicado.
- [x] Publicação incompleta bloqueada; permissão `boletim:publish` exigida.

> **Entregue** na branch `feat/boletim`. Spec: `docs/superpowers/specs/2026-06-16-boletim-editor-publicacao-design.md` · Plano: `docs/superpowers/plans/2026-06-16-boletim.md`.
