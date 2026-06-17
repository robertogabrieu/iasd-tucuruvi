# Spec — Boletim: editor de blocos, publicação e página pública (US-16 + US-18 + US-19)

- **Data:** 2026-06-16
- **Branch:** a criar (ex.: `feat/boletim`)
- **Histórias cobertas:** US-16 (editor de blocos), US-18 (publicar + slug), US-19 (página pública + Open Graph). Fecha também os itens adiados da **US-17**: CA-04 (modal-picker no editor) e CA-05 (bloqueio real de imagem em uso).
- **Épico:** Boletim Informativo — **sub-projeto 3 de 5** (decomposição abaixo)
- **Referência de arquitetura:** `CLAUDE.md` → seção *Backend — Área Administrativa, Autenticação e RBAC*
- **Referência visual:** `docs/patterns/area-administrativa-visual.md`
- **Backlog:** `docs/historias/US-16-editor-boletim.md`, `US-18-publicar-gerar-link.md`, `US-19-pagina-publica-preview.md`

---

## 1. Objetivo e contexto

O Boletim é o artigo semanal compartilhado no grupo de WhatsApp da igreja. Este sub-projeto
entrega o ciclo completo de produção e distribuição: o **administrador monta** o conteúdo
empilhando blocos discretos (US-16), **publica** gerando um link estável baseado no título
(US-18), e o **membro abre** uma página pública bonita com **cartão de preview** correto no
WhatsApp (US-19).

As três histórias são fortemente acopladas e tratadas como um sub-projeto único porque
compartilham o mesmo registro e o mesmo *renderer*: o editor produz um JSON de blocos,
publicar é só uma transição de estado desse registro, e a página pública renderiza **o mesmo
JSON** com **o mesmo componente** usado na pré-visualização do editor — garantindo fidelidade.

A fundação de mídia (US-17) já está entregue (`feat/biblioteca-midia`) e deixou dois ganchos
que este sub-projeto consome: o endpoint de listagem `GET /api/admin/media` (para o picker) e
o **registry de usage checkers** vazio no `MediaService` (para o bloqueio de remoção).

### Decomposição do épico (contexto — este spec é o item 3)

1. Fundação + editor de blocos (US-16 core) — *absorvido neste sub-projeto*
2. Biblioteca de mídia (US-17) — **entregue**
3. **Editor + publicação + página pública + Open Graph (US-16 + US-18 + US-19) — ESTE SPEC**
4. Gerenciar boletins + templates (US-20 + US-21)
5. Encurtador de links (US-22)

## 2. Escopo

### Dentro do escopo

| CA | História | Resumo |
|---|---|---|
| CA-01..09 | US-16 | Criar/editar boletim com blocos (Título, Texto, Imagem, Galeria, Vídeo); reordenar/remover; metadados (resumo/capa); salvar rascunho como JSON; validação. |
| CA-01..06 | US-18 | Slug do título (sem acento/inválidos, único); publicar/despublicar com `published_at`; slug estável; bloqueio de publicação incompleta; guard `boletim:publish`. |
| CA-01..05 | US-19 | Página pública `/boletins/:slug` renderizando os blocos on-brand; meta tags Open Graph servidas no HTML inicial; rascunhos → 404; botão "Copiar link". CA-06 (compartilhar no WhatsApp) incluído por baixo custo. |
| CA-04 | US-17 | Modal-picker da biblioteca a partir do editor (bloco de Imagem e Galeria). |
| CA-05 | US-17 | Bloqueio real de remoção de imagem em uso por boletim, via usage checker registrado no `MediaService`. |

### Fora do escopo (próximos sub-projetos)

- **US-20 — tela de gestão de boletins** (filtros, duplicar, indicadores). O endpoint de
  **listagem paginada** já nasce aqui (o editor precisa listar), mas a tela rica de gestão e
  ações extras ficam para o sub-projeto 4. A lista do painel neste spec é a mínima viável.
- **US-21 — templates de boletim.**
- **US-22 — encurtador de links.**

## 3. Decisões de design (confirmadas no brainstorming)

1. **Sub-projeto único** para US-16/18/19 — renderer e registro compartilhados.
2. **Bloco de Texto com editor WYSIWYG (TipTap) → JSON** (ProseMirror doc), não HTML cru.
   Toolbar com negrito, itálico, listas e links (CA-03). Renderização por um componente único;
   sem `dangerouslySetInnerHTML` de HTML do usuário — mitiga XSS por construção.
3. **Reordenação por drag-and-drop** (`@dnd-kit`), com botão de remover por bloco.
4. **Permissões em português, alinhadas ao catálogo existente:** `boletim:write` (já existe) e
   **`boletim:publish`** (novo). Não introduzir `bulletins:*` em inglês.
5. **Slug** gerado com transliteração nativa (`String.prototype.normalize('NFD')` + remoção de
   diacríticos/caracteres inválidos), unicidade por sufixo incremental no repositório. **Sem
   dependência nova no backend.**
6. **Slug imutável** após a 1ª publicação (preserva links já distribuídos — CA-04 da US-18).
7. **OG injetado server-side** no `index.html` para `/boletins/:slug`, antes do fallback SPA;
   o corpo continua hidratado pelo React (SSR apenas do `<head>`).

## 4. Modelo de dados — `server/migrations/005_boletins.sql`

Tabela `boletins`:

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK (`gen_random_uuid()`) | |
| `title` | `text` not null | título; base do slug |
| `summary` | `text` null | resumo (CA-05 US-16 / `og:description`) |
| `cover_media_id` | `uuid` FK → `media(id)` `ON DELETE SET NULL` | capa (CA-05 US-16 / `og:image`). FK `SET NULL` é defensivo: o usage checker (§6) já bloqueia excluir capa em uso, então a deleção normal não dispara o `SET NULL`. |
| `content` | `jsonb` not null default `'[]'::jsonb` | sequência ordenada de blocos |
| `status` | `text` not null default `'draft'` | `draft` \| `published` (CHECK) |
| `slug` | `text` null | setado na 1ª publicação; **único quando não nulo** |
| `published_at` | `timestamptz` null | momento da publicação |
| `created_by` | `uuid` FK → `users(id)` `ON DELETE SET NULL` | autor |
| `created_at` | `timestamptz` not null default `now()` | |
| `updated_at` | `timestamptz` not null default `now()` | atualizado em cada save |

Índices: `CREATE UNIQUE INDEX ON boletins (slug) WHERE slug IS NOT NULL;`
`CREATE INDEX ON boletins (status, published_at DESC);`
`CREATE INDEX ON boletins (created_at DESC);` (ordenação da lista do painel).
Segue o padrão das migrations `001`–`004`, aplicadas no boot por `runMigrations`
(`server/core/db.ts`).

## 5. Schema dos blocos (Zod — fonte no server, espelho no client)

`content` é um array de blocos; cada bloco é `{ id: string, type, props }`. Discriminated union
por `type` (validado com `z.discriminatedUnion`):

| `type` | `props` | Notas |
|---|---|---|
| `heading` | `{ text: string, level: 2 \| 3 }` | título de seção |
| `text` | `{ doc: <JSON TipTap/ProseMirror> }` | formatação rica (negrito/itálico/lista/link) |
| `image` | `{ mediaId: uuid, alt: string }` | referência por id (US-17), não duplica arquivo |
| `gallery` | `{ mediaIds: uuid[] (1..N) }` | grade responsiva |
| `video` | `{ youtubeId: string }` | só YouTube; sem upload de vídeo |

- **Fonte:** `server/modules/boletins/dto/block.schema.ts` (+ DTOs de criar/atualizar/publicar).
- **Espelho client:** `src/schemas/boletim.ts` — mantidos em sincronia (convenção do projeto).
- O `doc` do TipTap é validado de forma permissiva (objeto ProseMirror); o conteúdo textual é
  sanitizado na renderização pelo próprio mapeamento de nós (não há injeção de HTML cru).
- O `youtubeId` é extraído/validado de URLs do YouTube (watch, youtu.be, embed, shorts);
  entradas inválidas → erro de validação (CA-09 US-16).

## 6. Backend — `server/modules/boletins/`

Arquitetura em camadas obrigatória (`routes → controller → service → repository → db`),
montada no composition root `server/container.ts`.

| Arquivo | Responsabilidade |
|---|---|
| `boletins.routes.ts` | Liga rotas → controller; aplica `requireAuth` + `requirePermission('boletim:write'\|'boletim:publish')`. **Toda rota mutante** (POST/PATCH/DELETE/publish/unpublish) também aplica `requireCsrf` (`../auth/middleware/require-csrf.js`), como em `media.routes.ts`/`user.routes.ts`. Rota pública (`GET`) separada sem guard. |
| `boletins.controller.ts` | HTTP fino: valida DTO, chama service, monta resposta. Sem regra de negócio. |
| `boletins.service.ts` | Regra: validação de conteúdo, geração de slug + unicidade, transições de estado (publish/unpublish), sugestão de capa (1ª imagem se vazia). Não conhece `req`/`res` nem SQL. |
| `boletins.repository.ts` | Único ponto com SQL de `boletins` (create, get by id, get published by slug, list paginada, update content/metadata, set status/slug/published_at, delete, **checar uso de um mediaId**). |
| `dto/` | Schemas Zod (blocos + DTOs). Lista reusa `paginationQuery` de `core/pagination.ts`. |
| `boletins.slug.ts` | Função pura de slugify (transliteração + normalização). **Função, não classe** (regra anti-complexidade do `CLAUDE.md`). |
| `boletins.usage.ts` | Função `makeBoletinMediaUsageChecker(repo)` → `MediaUsageChecker` para registrar no `MediaService`. |

**Regras de negócio principais:**

- **Criar:** exige `title`; nasce `draft`, `content` `[]`, sem slug. (CA-01 US-16)
- **Salvar (PATCH):** persiste `content` (blocos) + metadados (`title`, `summary`,
  `cover_media_id`); atualiza `updated_at`. Validação Zod do array de blocos. (CA-06/07 US-16)
- **Sugestão de capa:** se `cover_media_id` vazio, o service sugere o `mediaId` do primeiro
  bloco `image`/`gallery` (não sobrescreve escolha explícita). (CA-05 US-16)
- **Publicar:** requer `title`, ≥1 bloco e metadados mínimos (resumo/capa para o preview);
  senão `BadRequestError` indicando o que falta. Na **1ª** publicação gera `slug` (slugify +
  unicidade com sufixo `-2`, `-3`…); define `status='published'` e `published_at=now()`.
  Em republicações o slug **não muda**. Guard `boletim:publish`. (CA-01..03/06 US-18)
- **Despublicar:** volta a `draft`; o link público deixa de exibir (mantém o slug salvo para
  reuso, mas a rota pública passa a 404 por causa do `status`). (CA-05 US-18)
- **Slug estável:** editar o título depois **não** altera o slug. (CA-04 US-18)

**Usage checker de mídia (fecha CA-05 US-17):** `boletins.usage.ts` expõe um checker que
consulta se um `mediaId` aparece, em **qualquer** boletim (rascunho ou publicado), como:
(a) `cover_media_id`; (b) `props.mediaId` de um bloco `image`; ou (c) membro de `props.mediaIds`
de um bloco `gallery`. A consulta JSONB precisa cobrir as **duas formas** do schema (§5):
bloco `image` guarda `mediaId` singular e `gallery` guarda `mediaIds` array — uma única
expressão `content @> '[{"type":"image",...}]'` **não** pega a galeria. A query expande os
blocos (`jsonb_array_elements(content)`) e testa `elem->'props'->>'mediaId' = $1` **ou**
`elem->'props'->'mediaIds' ? $1`, em `OR` com `cover_media_id = $1`. Registrado no array
`usageCheckers` do `MediaService` no `container.ts` (hoje `[]`). Resultado: excluir imagem em
uso passa a lançar `ConflictError` **sem alterar o módulo de mídia**.

**Rotas:**

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/admin/boletins` | `boletim:write` | Cria rascunho (body: `title`). |
| `GET` | `/api/admin/boletins?page=&limit=` | `boletim:write` | Lista paginada (`{ data, pagination }`), mais recentes primeiro. |
| `GET` | `/api/admin/boletins/:id` | `boletim:write` | Abre para edição (rascunho ou publicado). |
| `PATCH` | `/api/admin/boletins/:id` | `boletim:write` | Salva content + metadados. |
| `POST` | `/api/admin/boletins/:id/publish` | `boletim:publish` | Publica (gera slug na 1ª vez). |
| `POST` | `/api/admin/boletins/:id/unpublish` | `boletim:publish` | Volta a rascunho. |
| `DELETE` | `/api/admin/boletins/:id` | `boletim:write` | Remove o boletim. |
| `GET` | `/api/boletins/:slug` | **pública** | Boletim **publicado** por slug (404 se não publicado/inexistente). Alimenta a hidratação React. |

Todas as rotas mutantes acima carregam `requireCsrf` além de `requireAuth`+`requirePermission`
(convenção do projeto — ver `media.routes.ts`). Rotas `/api/admin/boletins` montadas como os
demais módulos admin; a pública `/api/boletins/:slug` montada fora de `/api/admin`, antes do
fallback SPA, **sem** CSRF.

**Geração de slug e corrida (CA-02 US-18):** a unicidade é garantida em última instância pelo
índice único parcial (§4). O service tenta `slugify(title)`, depois sufixos `-2`, `-3`… com base
nos slugs existentes; o `INSERT/UPDATE` de publicação é envolvido em retry que captura a
violação de unicidade do Postgres (`23505`) e regenera o próximo sufixo — o banco é a fonte da
verdade, evitando colisão entre publicações concorrentes de títulos iguais.

**Bloqueio de publicação incompleta (CA-06 US-18 / CA-07 US-16):** o `BadRequestError` carrega
um `details` enumerando os campos faltantes (`title`, `content`, `summary`/`cover`), no formato
`{ error, details }` do error-handler central, para o editor exibir mensagens por campo.

## 7. Renderer compartilhado de blocos

Componente `BulletinRenderer` em `src/components/boletim/` (+ um componente por tipo de bloco)
que recebe `content: Block[]` e renderiza on-brand (paleta/tipografia do site, `max-w` e
estilos consistentes com o restante do site):

- `heading` → `<h2>/<h3>` com a tipografia Montserrat.
- `text` → render do doc TipTap por mapeamento de nós (`@tiptap/html` ou `generateHTML` com o
  mesmo conjunto de extensões do editor, sanitizado), **não** HTML arbitrário do usuário.
- `image` → `<img src="/media/:id" alt>` responsivo.
- `gallery` → grade responsiva de `/media/:id` (mantém identidade visual; autor não mexe em CSS).
- `video` → embed YouTube responsivo (`aspect-video`), reaproveitando o padrão de embed já
  usado no site (`src/components/AoVivo.tsx` / `VideoCard.tsx`).

**Usado nos dois lugares:** pré-visualização do editor (US-16) e página pública (US-19). O
`BulletinRenderer` (e o `generateHTML`/`@tiptap/html` do bloco de texto) é **client-only** —
roda no bundle React, nunca importado em `server/`. O caminho de OG injeta apenas o `<head>`; o
corpo do boletim é hidratado no cliente, então o TipTap não entra no backend.

## 8. Frontend — Editor `/painel/boletins` (US-16)

- **Lista** `src/painel/pages/Boletins.tsx`: `PageHeader` + botão "Novo boletim"; tabela/cards
  com título, status (`Badge`/`StatusBadge`) e ações (editar, publicar/despublicar, copiar
  link, excluir); `Pager`. Composição **exclusiva** com o kit de UI (`src/painel/ui/`).
- **Editor** `src/painel/pages/BoletimEditor.tsx` (rota `/painel/boletins/:id`):
  - Coluna de blocos com **drag-and-drop** (`@dnd-kit/sortable`) + botão remover por bloco;
    botão "adicionar bloco" (escolhe tipo e insere na posição).
  - **Texto:** componente TipTap (`@tiptap/react` + `starter-kit` + `extension-link`) com toolbar.
  - **Imagem/Galeria:** abrem o **modal-picker** da biblioteca (CA-04 US-17), reaproveitando
    `GET /api/admin/media` (grade paginada + busca) — Imagem seleciona 1, Galeria seleciona N.
  - **Metadados:** título, resumo, capa (com sugestão da 1ª imagem).
  - **Pré-visualização:** usa o `BulletinRenderer`.
  - **Salvar:** `PATCH`; validação (título + ≥1 bloco) com mensagens claras (CA-07 US-16).
- **Picker reutilizável:** `src/painel/components/MediaPicker.tsx` (modal sobre a API de mídia),
  usado pelo bloco de Imagem e pelo de Galeria.
- Item novo no menu lateral (`src/painel/nav-config.tsx`, `perm: 'boletim:write'`); rota no
  `App.tsx` dentro de `<ProtectedRoute><PainelLayout/></ProtectedRoute>` com `RequirePermission`.
- Cliente HTTP via `src/painel/admin-api.ts` (CSRF + cookies). Novo `src/painel/boletim-api.ts`.

## 9. Frontend — Página pública + Open Graph (US-19)

- **Rota React** `/boletins/:slug` no `App.tsx` (fora do `/painel`, sem autenticação); página
  `src/pages/BoletimPublico.tsx` busca `GET /api/boletins/:slug`, mostra `Spinner` no fetch,
  renderiza com `BulletinRenderer`; 404 amigável se indisponível (CA-04 US-19).
- **Copiar link** (CA-05) e **Compartilhar no WhatsApp** (CA-06, `https://wa.me/?text=`) no
  painel (na lista/editor), com confirmação visual ("Link copiado!").
- **Slug "avisado" (CA-04 US-18):** após publicado, o slug fica travado; o editor exibe o slug
  com um indicador de que ele está bloqueado (não muda ao editar o título). **Alteração
  explícita de slug fica fora deste sub-projeto** (adiada para a US-20/gestão); aqui só
  informamos o admin de que o link é estável.
- **Open Graph server-side (CA-02/03 US-19):** uma rota `GET /boletins/:slug` é registrada
  **dentro do bloco `if (process.env.NODE_ENV === 'production')`** de `server/index.ts` (hoje
  ~linha 106, onde ficam `express.static(dist)` e o catch-all `{*path}`), **antes** do
  `app.get('{*path}', …)`. Ela busca o boletim **publicado**, lê o **`dist/index.html`** (o HTML
  já construído, com os hashes dos assets — não o `index.html` da raiz, que é o template Vite),
  injeta no `<head>` `og:title` (título), `og:description` (resumo), `og:image` (capa em URL
  **absoluta**), `og:url`, `og:type=article` (+ equivalentes Twitter), e devolve o HTML. Boletim
  não publicado/inexistente → cai no catch-all SPA normal, que renderiza o 404 (sem vazar
  conteúdo). Os valores são **escapados** ao injetar (evita quebra de atributo/markup).
  - **Limitação conhecida:** a injeção OG só roda no fluxo de **produção** (onde o Express serve
    `dist/index.html`); em **dev** o Vite serve o HTML e as tags não são injetadas. A validação
    do preview do WhatsApp é feita em produção/preview. Documentado na verificação manual.
- **URL absoluta:** base configurável por env **`PUBLIC_BASE_URL`** (ex.: `https://iasdtucuruvi…`)
  para compor `og:url`/`og:image` absolutos.

## 10. Permissões e dependências

- **Permissão nova:** adicionar `boletim:publish` ("Publicar/despublicar boletins") ao
  `server/seed/permissions.catalog.ts`. `boletim:write` **já existe**. O seed
  (`linkAllPermissions`) religa ambas ao `admin` no próximo boot.
- **Frontend (novas deps):** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`,
  `@tiptap/html` (render do doc) e `@dnd-kit/core` + `@dnd-kit/sortable`.
- **Backend:** sem dependências novas (slugify nativo; JSONB no Postgres).
- **Env nova:** `PUBLIC_BASE_URL` (URL pública absoluta para OG). `deploy.sh`/compose
  documentam o valor de produção.

## 11. Segurança

- Guards `boletim:write` / `boletim:publish` em todas as rotas admin; rota pública só serve
  `status='published'`.
- **Texto rico sem HTML cru do usuário:** TipTap doc renderizado por mapeamento de nós
  conhecidos; links com `rel="noopener nofollow"` e protocolo validado (sem `javascript:`).
- **Vídeo:** apenas `youtubeId` extraído/validado é persistido; embed monta a URL canônica do
  YouTube (sem aceitar iframe/URL arbitrária).
- **Imagem/Galeria:** referência por `mediaId` (uuid) validado contra a tabela `media`.
- **OG:** valores escapados ao injetar no HTML (evita quebra de atributo/markup).

## 12. Verificação manual (sem suíte de testes — convenção do projeto)

US-16:
- Criar boletim com título → nasce rascunho; adicionar blocos de cada tipo.
- Texto com negrito/itálico/lista/link salva e reabre com a formatação intacta.
- Imagem/Galeria via picker da biblioteca; capa sugerida pela 1ª imagem quando vazia.
- Vídeo: link válido incorpora; link inválido é recusado com mensagem.
- Reordenar (drag-and-drop) e remover refletem na pré-visualização e no salvo.
- Salvar, fechar e reabrir → conteúdo preservado. Salvar sem título/bloco → validação.

US-18:
- Publicar gera slug legível, sem acento/inválidos; 2º boletim de mesmo título → sufixo `-N`.
- Editar título de publicado **não** muda o slug. Despublicar → link público fica indisponível.
- Publicar incompleto (sem título/conteúdo/metadados mínimos) é bloqueado com indicação.
- Usuário sem `boletim:publish` não publica.

US-19 (em produção/preview):
- `/boletins/:slug` renderiza todos os tipos de bloco, responsivo e on-brand.
- Colar o link no WhatsApp mostra cartão com título, resumo e capa; meta tags OG presentes no
  HTML servido (testar com `curl`/validador de OG, JS desligado).
- Rascunho/despublicado → página de indisponível (404), sem vazar conteúdo.
- "Copiar link" copia a URL e confirma; "Compartilhar no WhatsApp" abre com o link.

US-17 (itens fechados aqui):
- Picker da biblioteca seleciona imagem(ns) existentes no editor.
- Excluir imagem **em uso** por um boletim é bloqueado com aviso; imagem livre é removida.

## 13. Definição de pronto

US-16:
- [ ] Adicionar, editar, reordenar (drag-and-drop) e remover blocos (Título, Texto, Imagem, Galeria, Vídeo).
- [ ] Galeria em grade responsiva; Vídeo do YouTube incorporado; Texto rico (TipTap).
- [ ] Resumo e capa salvos (capa sugerida pela 1ª imagem).
- [ ] Conteúdo persistido como JSON e recuperável para reedição; validação de título/blocos.
- [ ] Permissão `boletim:write` exigida.

US-18:
- [ ] Slug do título, sem acento/inválidos, único (sufixo incremental).
- [ ] Publicar/despublicar com transição de estado e `published_at`; slug estável após publicado.
- [ ] Publicação incompleta bloqueada; permissão `boletim:publish` exigida.

US-19:
- [ ] Página pública renderizando os blocos, responsiva e on-brand (renderer compartilhado).
- [ ] Meta tags Open Graph servidas no HTML inicial (validadas no preview do WhatsApp em prod).
- [ ] Rascunhos/despublicados não acessíveis publicamente (404).
- [ ] Botão "Copiar link" com confirmação (e compartilhar no WhatsApp).

US-17 (itens adiados, fechados aqui):
- [ ] Modal-picker da biblioteca no editor (CA-04).
- [ ] Bloqueio de remoção de imagem em uso por boletim (CA-05), via usage checker registrado.
