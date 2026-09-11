# Spec — Biblioteca de Mídia (US-17)

- **Data:** 2026-06-16
- **Branch:** a criar (ex.: `feat/biblioteca-midia`)
- **Histórias cobertas:** US-17 (Biblioteca de mídia)
- **Épico:** Boletim Informativo — **sub-projeto 2 de 5** (decomposição abaixo)
- **Referência de arquitetura:** `CLAUDE.md` → seção *Backend — Área Administrativa, Autenticação e RBAC*
- **Referência visual:** `docs/patterns/area-administrativa-visual.md`
- **Backlog:** `docs/historias/US-17-biblioteca-midia.md`

---

## 1. Objetivo e contexto

A Biblioteca de Mídia é a fonte de imagens do futuro editor de boletim (US-16), mas é pensada
para ser **genérica e reutilizável** por outras features. O administrador faz **upload** de
imagens, que ficam guardadas num **volume Docker**; a metadata vai para o Postgres. As imagens
aparecem numa **grade** no painel, com busca por nome, e podem ser **excluídas**.

Este é o **primeiro sub-projeto do épico do Boletim** a ser implementado, escolhido por ser a
fundação que destrava o editor e por resolver as questões de storage/volume/processamento de
imagem antes que o editor precise delas.

### Decomposição do épico (contexto — apenas o item 2 é deste spec)

1. Fundação + editor de blocos (US-16 core)
2. **Biblioteca de mídia (US-17) — ESTE SPEC**
3. Publicar + página pública + Open Graph (US-18 + US-19)
4. Gerenciar boletins + templates (US-20 + US-21)
5. Encurtador de links (US-22)

## 2. Escopo

### Dentro do escopo

| CA (US-17) | Resumo | Observação |
|---|---|---|
| CA-01 | Upload de imagem + metadata (nome, tipo, tamanho, dimensões, autor) | guard `media:manage` |
| CA-02 | Validação por **conteúdo** (magic bytes), tipos permitidos, tamanho máximo | reencode via `sharp` |
| CA-03 | Listar em grade (miniaturas, mais recentes primeiro) + buscar por nome | paginado |
| CA-05 | Excluir imagem (com confirmação) | ver "decisão" abaixo |

### Fora do escopo (adiado para outros sub-projetos)

- **CA-04 — Selecionar imagem a partir do editor (picker):** depende do editor (US-16). O
  endpoint de listagem e a referência por `id` já ficam prontos; o modal-picker é construído
  no sub-projeto do editor.
- **CA-05 — Bloqueio real de "imagem em uso":** boletins ainda não existem. **Decisão:** o
  módulo expõe um **registry de *usage checkers*** (lista de funções injetadas no service).
  Hoje o registry está **vazio** ⇒ a exclusão é sempre permitida (com confirmação no painel).
  Quando o editor existir, ele registra um checker que consulta `bulletins.content` e a
  exclusão de imagem referenciada passa a ser bloqueada **sem alterar este módulo**.

## 3. Decisões de design (confirmadas no brainstorming)

1. **Processamento com `sharp`:** no upload, validar magic bytes, **reencodar** a imagem
   (descarta EXIF e qualquer payload embutido — mitigação de segurança do CA-02), extrair
   dimensões e gerar uma **miniatura** (~400 px de lado maior, WebP) para a grade.
2. **Exclusão "em uso" adiada com gancho:** registry de usage checkers, vazio agora (ver §2).
3. **Tamanho máximo 5 MB**, tipos **JPEG / PNG / WebP** (validados por conteúdo).
4. **Servir arquivos publicamente** por URL não-adivinhável (uuid), necessário para a página
   pública do boletim (US-19) e o `og:image` do WhatsApp.

## 4. Modelo de dados — `server/migrations/004_media.sql`

Tabela `media`:

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK (`gen_random_uuid()`) | usado também como nome no disco e na URL pública |
| `filename` | `text` not null | nome do arquivo original no disco (`<id>.<ext>`), aleatório |
| `original_name` | `text` not null | nome enviado, **sanitizado**; exibido e usado na busca |
| `mime_type` | `text` not null | um de `image/jpeg`, `image/png`, `image/webp` |
| `size_bytes` | `integer` not null | tamanho do arquivo reencodado gravado |
| `width` | `integer` not null | dimensão extraída pelo `sharp` |
| `height` | `integer` not null | dimensão extraída pelo `sharp` |
| `thumbnail_filename` | `text` not null | `<id>_thumb.webp` |
| `uploaded_by` | `uuid` FK → `users(id)` | quem enviou |
| `created_at` | `timestamptz` not null default `now()` | ordenação |

Índice: `create index on media (created_at desc)`. Busca por `original_name ILIKE '%q%'`.
Segue o padrão das migrations existentes (`001`–`003`), aplicadas em ordem no boot por
`runMigrations` (`server/core/db.ts`).

## 5. Armazenamento

- Volume Docker **nomeado** `uploads`, montado em `/app/uploads` no serviço `app` do
  `docker-compose.yml`. Caminho-base configurável por env **`UPLOADS_DIR`** (default
  `/app/uploads` em prod; um diretório local — ex. `./.uploads` — em dev).
- Layout: `${UPLOADS_DIR}/media/<uuid>.<ext>` (original reencodado) e
  `${UPLOADS_DIR}/media/<uuid>_thumb.webp` (miniatura).
- **Nome no disco = uuid** — nunca o nome enviado pelo usuário ⇒ sem path traversal, sem
  colisão. O `original_name` (sanitizado) só vive na coluna do banco.

## 6. Backend — `server/modules/media/`

Arquitetura em camadas obrigatória (`routes → controller → service → repository → db`),
montada no composition root `server/container.ts`.

| Arquivo | Responsabilidade |
|---|---|
| `media.routes.ts` | Liga rotas → controller; aplica `multer` (upload) e guard `requirePermission('media:manage')`. |
| `media.controller.ts` | HTTP fino: valida DTO, chama service, monta resposta. Sem regra de negócio. |
| `media.service.ts` | Regra: valida, orquestra processamento de imagem, persiste metadata via repo, exclui consultando os usage checkers. Não conhece `req`/`res` nem SQL. |
| `media.repository.ts` | Único ponto com SQL da tabela `media` (insert, list paginada+busca, get, delete). |
| `media.storage.ts` | Wrapper de filesystem: gravar/ler-stream/apagar arquivos no volume. Isola I/O de disco do service. |
| `media.image.ts` | Funções puras com `sharp`: sniff de formato (magic bytes), reencode, extrair dimensões, gerar thumbnail. **Função, não classe** (comportamento sem estado — regra anti-complexidade do `CLAUDE.md`). |
| `dto/` | Schemas Zod. A query de listagem reusa `paginationQuery` de `core/pagination.ts`. |

**Pipeline de upload (no service):**

1. `multer` (`memoryStorage`) recebe 1 arquivo, com limite de bytes (`MEDIA_MAX_BYTES`).
   Buffer em memória porque a imagem é reprocessada antes de ir ao disco.
2. `media.image.ts` roda `sharp(buffer).metadata()` → confirma que é imagem real e que o
   `format ∈ {jpeg, png, webp}`. Qualquer outro formato (SVG, GIF, etc.) → `BadRequestError`.
3. Reencode no mesmo formato de saída (descartando metadata/EXIF) + geração da thumbnail WebP +
   extração de `width`/`height`.
4. `media.storage.ts` grava original + thumbnail com nomes baseados no `id`.
5. `media.repository.ts` insere a metadata. Resposta com o registro criado.

**Registry de usage checkers (exclusão):** o service recebe, por injeção no container, um
array `MediaUsageChecker[]` (assinatura `(id: string) => Promise<boolean>`). No `delete`, se
**qualquer** checker retornar "em uso", lança `ConflictError`; senão apaga arquivos + linha.
Hoje o array é `[]` (injetado vazio no `container.ts`).

**Rotas:**

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/admin/media` | `media:manage` | Upload (multipart, campo `file`). |
| `GET` | `/api/admin/media?page=&limit=&q=` | `media:manage` | Lista paginada (`{ data, pagination }`) + busca por nome. |
| `DELETE` | `/api/admin/media/:id` | `media:manage` | Exclui (consulta usage checkers). |
| `GET` | `/media/:id` | **pública** | Serve o original (`Content-Type` correto, `Cache-Control`). |
| `GET` | `/media/:id/thumb` | **pública** | Serve a miniatura WebP. |

As rotas públicas `/media/*` são registradas **antes** do fallback da SPA no servidor Express,
e fora do prefixo `/api`. Servem o arquivo via stream do volume; 404 se o `id` não existir.

## 7. Frontend — `/painel/midia`

- Nova página `src/painel/pages/Midia.tsx`; rota adicionada no `App.tsx` dentro de
  `<ProtectedRoute><PainelLayout/></ProtectedRoute>`; item novo no menu lateral (US-13),
  visível conforme a permissão `media:manage` (padrão US-26).
- Composição **exclusivamente** com o kit de UI (`src/painel/ui/`), conforme
  `docs/patterns/area-administrativa-visual.md`: `PageHeader`, `Card`, `Button`,
  `Field`/`Input` (busca com debounce → `q`), grade de miniaturas, `Modal` (upload e
  confirmação de exclusão), `EmptyState`, `Pager` (contrato `page`/`limit`).
- **Upload:** botão → `Modal` com `<input type="file">` (drag-and-drop opcional), preview e
  validação client (tipo/tamanho) **espelhando** as regras do server.
- **Grade:** miniaturas (das mais recentes às mais antigas), `original_name`, e ação de
  **excluir** (com confirmação no `Modal`).
- **Busca:** por nome, com debounce, alimentando o query param `q`.

## 8. Segurança e limites

- Tipos aceitos validados por **magic bytes** (via `sharp`), não pela extensão: `image/jpeg`,
  `image/png`, `image/webp`. **SVG e demais formatos rejeitados.**
- Tamanho máximo **5 MB**, constante configurável via env **`MEDIA_MAX_BYTES`**.
- **Reencode** descarta EXIF/metadata e qualquer conteúdo executável embutido.
- Filenames no disco são **uuid** (sem path traversal, sem colisão); `original_name` passa por
  `server/lib/sanitize.ts` antes de persistir/exibir.
- Upload/listagem/exclusão exigem `media:manage`; o serviço de arquivos é público mas por URL
  não-adivinhável.

## 9. Permissões e dependências

- Adicionar **`media:manage`** ao `server/seed/permissions.catalog.ts` (descrição: "Gerenciar
  biblioteca de mídia"). O seed (`linkAllPermissions`) religa ao `admin` no próximo boot.
- **Nota de reconciliação:** o catálogo hoje tem `boletim:write`; as histórias do épico usam
  `bulletins:write`/`bulletins:publish`/`bulletins:templates:manage` e `links:manage`. Essas
  serão tratadas nos respectivos sub-projetos — **este spec adiciona apenas `media:manage`**.
- Novas dependências: **`multer`** (+ `@types/multer`) e **`sharp`**.
- `Dockerfile`/build: garantir que o `sharp` funcione na imagem (binário nativo) e que o
  diretório de uploads exista/seja o volume montado.

## 10. Verificação manual (sem suíte de testes — convenção do projeto)

- Upload de JPEG/PNG/WebP válido → aparece na grade com miniatura.
- Upload de não-imagem, de SVG e de arquivo > 5 MB → recusado com mensagem clara.
- Busca por nome filtra a grade; paginação navega.
- Excluir pede confirmação e remove arquivo + metadata; a imagem some da grade.
- `GET /media/:id` e `/media/:id/thumb` retornam a imagem **sem login**; `id` inexistente → 404.
- Permissão: usuário sem `media:manage` não vê o item no menu nem acessa os endpoints `/api/admin/media`.

## 11. Definição de pronto (US-17)

- [ ] Upload com validação de tipo/tamanho por conteúdo + reencode + thumbnail.
- [ ] Listagem em grade com busca por nome, paginada, mais recentes primeiro.
- [ ] Arquivos em volume Docker + metadata em `media`; permissão `media:manage` exigida.
- [ ] Exclusão com confirmação; gancho de usage checkers pronto (vazio) para o editor plugar.
- [ ] Rotas públicas de servir imagem (original + thumb) funcionando para uso futuro em US-19.
- [ ] Página `/painel/midia` no kit de UI; item no menu lateral conforme permissão.
