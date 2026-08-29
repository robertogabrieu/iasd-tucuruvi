# US-29 — Cadastro e página de Eventos

**Épico:** Eventos · **Prioridade:** Should · **Estimativa:** 5 pts

> ⏳ **Pendente** — [issue #19](https://github.com/robertogabrieu/iasd-tucuruvi/issues/19). Spec em `docs/superpowers/specs/2026-08-29-eventos-design.md` (fecha as quatro decisões em aberto); plano ainda não escrito.

## História

> **Como** Administrador,
> **eu quero** cadastrar eventos da igreja num formulário com campos padronizados e publicá-los,
> **para que** cada evento tenha uma página própria de divulgação, com todos os detalhes, sem depender de quem programa.

## Contexto

Diferente do Boletim (US-16 — conteúdo livre em blocos), o Evento tem **campos fixos** e **layout fixo**: o administrador só preenche um formulário e a página é montada automaticamente num template padronizado. Reaproveita a infraestrutura já existente do Boletim — **biblioteca de mídia** (US-17), **publicação por slug** + **Open Graph** (US-18/US-19), **RBAC** (US-10), **kit de UI do painel** e o **contrato de listagem paginada**.

## Campos fixos propostos *(a confirmar)*

| Campo | Tipo | Obrigatório |
|-------|------|:-----------:|
| Título | texto curto | ✅ |
| Descrição | texto rico (negrito/itálico/listas/links) | ✅ |
| Data/hora de início | datetime | ✅ |
| Data/hora de término | datetime | — |
| Local | texto (default: endereço da igreja) | ✅ |
| Banner/capa | imagem da biblioteca (US-17) | — |
| Categoria | seleção (ex.: Culto especial, Jovens, Música, Desbravadores…) | — |
| Link de inscrição (CTA) | URL | — |
| Departamento/organizador | texto | — |

## Critérios de aceitação

### CA-01 — Cadastrar evento
- **Given** que tenho a permissão `eventos:write`
- **When** crio um novo evento e preencho o formulário de campos fixos
- **Then** o evento é criado no estado **rascunho**
- **And** os campos obrigatórios (título, descrição, data de início, local) são exigidos.

### CA-02 — Validação
- **Given** o formulário de evento
- **When** deixo um obrigatório vazio ou informo data de término anterior à de início
- **Then** recebo mensagem de validação clara indicando o que corrigir.

### CA-03 — Editar evento
- **Given** um evento existente
- **When** abro e altero seus campos
- **Then** as mudanças são salvas
- **And** se estiver publicado, a página pública reflete a atualização.

### CA-04 — Listar e gerenciar
- **Given** que tenho `eventos:write`
- **When** abro a área de Eventos
- **Then** vejo a lista com **título**, **data do evento**, **status** (rascunho/publicado) e ações
- **And** posso filtrar por status e por próximos/passados, e **excluir** (com confirmação).

### CA-05 — Publicar / despublicar
- **Given** um evento em rascunho com os obrigatórios preenchidos
- **When** o publico (permissão `eventos:publish`)
- **Then** é gerado um **link público por slug** (ex.: `/eventos/:slug`)
- **And** posso **copiar o link** e **despublicar** depois (o link deixa de responder).

### CA-06 — Página pública do evento (layout fixo)
- **Given** um evento **publicado**
- **When** acesso `/eventos/:slug`
- **Then** vejo uma página em layout padronizado com: **banner + título**, **data/hora**, **local** (com mapa quando for na igreja), **descrição**, botão de **inscrição** (se houver link) e **compartilhar no WhatsApp**
- **And** um evento **rascunho** ou inexistente retorna **404**
- **And** o layout respeita a identidade visual e o grid do site (`max-w-5xl`, AOS, divisórias diagonais).

### CA-07 — Compartilhamento (Open Graph)
- **Given** um evento publicado com banner
- **When** o link é compartilhado no WhatsApp
- **Then** o cartão exibe o **banner**, o **título** e a **data** (og tags injetadas server-side em produção, como no boletim — US-19).

### CA-08 — Eventos passados *(Could)*
- **Given** um evento cuja data já passou
- **When** vejo a lista administrativa
- **Then** ele aparece marcado como "encerrado" (a página pública continua acessível pelo link, como registro).

### CA-09 — Listagem pública / seção na home *(Could — fora do escopo v1)*
- Página pública `/eventos` com os **próximos eventos** e/ou uma seção "Próximos eventos" na home. *(Avaliar em história separada.)*

## Notas técnicas (orientação para implementação)

- **Backend em camadas** (padrão obrigatório): novo módulo `server/modules/eventos/` (`controller` → `service` → `repository` → `routes` + `dto/`), sem lógica solta em `server/lib/`.
- **Modelo de dados:** tabela `eventos` com **colunas fixas** (não JSONB — os campos são estruturados), migration nova. Campos: `title`, `description`, `starts_at`, `ends_at`, `location`, `banner_media_id` (FK → `media`), `category`, `registration_url`, `organizer`, `slug`, `status` (`draft`/`published`), `published_at`, `created_by`, timestamps.
- **RBAC:** novas permissões `eventos:write` e `eventos:publish` (o papel `admin` recebe todas automaticamente no seed — ver CLAUDE.md › RBAC).
- **Datas:** persistir com timezone; exibir em `America/Sao_Paulo`.
- **Reuso:** biblioteca de mídia (US-17) para o banner; geração de slug e injeção de Open Graph reaproveitando a infra do boletim (US-18/US-19, `PUBLIC_BASE_URL`); **kit de UI** do painel (`src/painel/ui/`) para as telas; **contrato de paginação** `?page=&limit=` na listagem.
- **Página pública:** componente/renderer próprio de layout fixo (mais simples que o `BulletinRenderer`, pois os campos são fixos); rota registrada no React Router (`src/App.tsx`).
- **Descrição:** texto rico com o mesmo editor/renderer básico já usado (TipTap) para não introduzir dependência nova.

## Dependências

- **US-17** (biblioteca de mídia) — banner do evento.
- Reaproveita infraestrutura de **US-18** (publicação/slug) e **US-19** (página pública + Open Graph).

## Definição de pronto

- [ ] Formulário administrativo de evento com os campos fixos + validação.
- [ ] Listar/editar/excluir eventos (com filtro por status e confirmação de exclusão).
- [ ] Publicar/despublicar gerando link público por slug + copiar link.
- [ ] Página pública `/eventos/:slug` em layout fixo (banner, data/hora, local, descrição, inscrição, WhatsApp); 404 para rascunho.
- [ ] Open Graph do evento (banner + título + data) em produção.
- [ ] Permissões `eventos:write` / `eventos:publish` aplicadas.

## Decisões em aberto

1. **Conjunto exato de campos fixos** (tabela acima é proposta — remover/adicionar?).
2. **Listagem pública `/eventos` e/ou seção na home** — incluir já ou deixar para história separada (CA-09).
3. **Eventos recorrentes** (semanal/mensal) — provavelmente **fora do escopo v1**; confirmar.
4. **Nomenclatura das permissões** — `eventos:*` (pt) vs. `events:*` (o boletim usa `boletim:*`/`bulletins:*` de forma mista; padronizar).
