# Gerenciar Boletins (US-20) + Templates (US-21) — Plano de Implementação

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o épico do Boletim Informativo — completar a gestão de boletins (filtro por status + duplicar) e adicionar templates reutilizáveis.

**Architecture:** Templates são linhas em `boletins` com `is_template=true` (draft, sem slug); reusam repositório, serviço e o editor da US-16. O schema de blocos passa a aceitar mídia/vídeo vazios (placeholder), com a completude exigida no `publish()` (e ao editar um boletim já publicado). Backend em camadas (routes→controller→service→repository→db); frontend React no padrão do painel.

**Tech Stack:** Express 5 + PostgreSQL (`pg`) + Zod no backend; React 18 + TS + React Router + Tailwind (kit `src/painel/ui`) no frontend.

**Spec:** `docs/superpowers/specs/2026-06-23-boletins-gerenciar-templates-design.md`
**Branch:** `feat/boletins-gerenciar-templates` (já criada; o spec já está commitado nela).

> **Convenção do projeto:** sem suíte de testes — validação **manual no browser**. Cada tarefa termina com `npm run build` (deve passar) + uma verificação manual + commit. Mantenha imports internos do backend com sufixo `.js` (ESM). `@/*` → `src/*` no frontend.

> **Dica de execução:** suba o ambiente uma vez (`docker compose up -d db mailpit`, `npm run dev:server`, `npm run dev`) e logue no painel como admin (que detém todas as permissões). Reinício do servidor reaplica migrations + seed (concede `boletim:templates:manage` ao admin).

---

## Mapa de arquivos

**Backend (modifica):**
- `server/migrations/006_boletim_templates.sql` — **criar**: coluna `is_template`, CHECK, índice.
- `server/seed/permissions.catalog.ts` — nova permissão `boletim:templates:manage`.
- `server/modules/boletins/dto/block.schema.ts` — relaxar mídia/vídeo (aceitar vazio).
- `server/modules/boletins/boletins.template.utils.ts` — **criar**: `cloneContentWithNewIds`, `stripContent`, `contentHasEmptyMedia`.
- `server/modules/boletins/boletins.repository.ts` — `is_template` na row; `list` com filtro; `listTemplates`; `listTemplateOptions`; `insertWithContent`.
- `server/modules/boletins/boletins.service.ts` — DTO `isTemplate`; filtro; métodos de template/duplicar/save-as; revalidação no `update`; completude no `publish`.
- `server/modules/boletins/dto/boletim.dto.ts` — `templateId`, `status`, `createTemplateDto`, `saveAsTemplateDto`.
- `server/modules/boletins/boletins.controller.ts` — novos handlers.
- `server/modules/boletins/boletins.routes.ts` — novas rotas (ordem correta).

**Frontend (modifica/cria):**
- `src/painel/boletim-api.ts` — novas funções de API.
- `src/painel/pages/Boletins.tsx` — filtro por status, duplicar, salvar-como-template, seletor de template no criar.
- `src/painel/pages/Templates.tsx` — **criar**: gestão de templates.
- `src/painel/pages/BoletimEditor.tsx` — modo template (esconde publicar) + relaxar trava de save.
- `src/painel/nav-config.tsx` + `src/painel/Sidebar.tsx` — grupo Boletins (Lista + Templates) com perm por child.
- `src/App.tsx` — rotas de templates.

---

## FASE A — Backend

### Task A1: Migration + permissão + `is_template` na row

**Files:**
- Create: `server/migrations/006_boletim_templates.sql`
- Modify: `server/seed/permissions.catalog.ts`
- Modify: `server/modules/boletins/boletins.repository.ts` (interface `BoletimRow`)

- [ ] **Step 1: Criar a migration**

`server/migrations/006_boletim_templates.sql`:
```sql
-- server/migrations/006_boletim_templates.sql
-- Templates de boletim (US-21): um template é um boletim marcado, nunca publicado.
ALTER TABLE boletins ADD COLUMN is_template boolean NOT NULL DEFAULT false;

-- Integridade: template nunca é publicado nem tem link público.
ALTER TABLE boletins ADD CONSTRAINT chk_template_unpublished
  CHECK (NOT is_template OR (status = 'draft' AND slug IS NULL));

-- Listagem de templates por data.
CREATE INDEX idx_boletins_is_template ON boletins (is_template, created_at DESC);
```

- [ ] **Step 2: Adicionar a permissão ao catálogo**

Em `server/seed/permissions.catalog.ts`, acrescentar à lista (após `boletim:publish`):
```ts
  { key: 'boletim:templates:manage', description: 'Criar/editar/remover templates de boletim' },
```

- [ ] **Step 3: Refletir a coluna na row do repositório**

Em `boletins.repository.ts`, na interface `BoletimRow`, adicionar após `slug`:
```ts
  is_template: boolean
```

- [ ] **Step 4: Build + verificação**

Run: `npm run build` → deve passar (tsc OK).
Reinicie o `dev:server`; nos logs deve constar migration 006 aplicada e o seed sem erro. No banco: `\d boletins` mostra `is_template` e o constraint `chk_template_unpublished`.

- [ ] **Step 5: Commit**
```bash
git add server/migrations/006_boletim_templates.sql server/seed/permissions.catalog.ts server/modules/boletins/boletins.repository.ts
git commit -m "feat(boletim): coluna is_template + permissão boletim:templates:manage (US-21)"
```

---

### Task A2: Relaxar schema de blocos + utils de conteúdo

**Files:**
- Modify: `server/modules/boletins/dto/block.schema.ts`
- Create: `server/modules/boletins/boletins.template.utils.ts`

- [ ] **Step 1: Relaxar o schema (aceitar mídia/vídeo vazios)**

Em `block.schema.ts`:
```ts
// imageBlock.props.mediaId — '' = placeholder (rascunho/template); completude exigida no publish.
const imageBlock = z.object({
  id: z.string(),
  type: z.literal('image'),
  props: z.object({ mediaId: z.union([z.string().uuid(), z.literal('')]), alt: z.string().max(200).default('') }),
})

const galleryBlock = z.object({
  id: z.string(),
  type: z.literal('gallery'),
  props: z.object({ mediaIds: z.array(z.string().uuid()).max(30) }), // remove .min(1) → permite []
})

const videoBlock = z.object({
  id: z.string(),
  type: z.literal('video'),
  props: z.object({ youtubeId: z.union([youtubeId, z.literal('')]) }),
})
```
(`heading.props.text` e `text.props.doc` já aceitam vazio; `alt` já tem `.default('')`.)

> **Espelho client (§8.6) — confirmado:** `src/schemas/boletim.ts` é **tipos TS (não Zod)** e o `createBlock` já cria blocos vazios (`mediaId:''`, `mediaIds:[]`, `youtubeId:''`). Como não há validação Zod no client, **nenhuma relaxação de schema é necessária lá** — o item §8.6/DoD "schemas server/client em sincronia" fica satisfeito por construção. A única mudança de comportamento no client é remover a trava de save no editor (Task C1).

- [ ] **Step 2: Criar os utils puros**

`server/modules/boletins/boletins.template.utils.ts`:
```ts
import { randomUUID } from 'node:crypto'
import type { Row } from './dto/block.schema.js'

/** Cópia profunda do conteúdo regenerando TODO id (linha/coluna/bloco) — árvores independentes. */
export function cloneContentWithNewIds(content: Row[]): Row[] {
  return content.map((row) => ({
    id: randomUUID(),
    columns: row.columns.map((col) => ({
      id: randomUUID(),
      // structuredClone garante cópia profunda das props (ex.: gallery.mediaIds[] não compartilha referência).
      blocks: col.blocks.map((b) => ({ ...structuredClone(b), id: randomUUID() })),
    })),
  }))
}

/** Esvazia o conteúdo mantendo a estrutura (mantém o texto dos títulos). Regenera ids. */
export function stripContent(content: Row[]): Row[] {
  return cloneContentWithNewIds(content).map((row) => ({
    ...row,
    columns: row.columns.map((col) => ({
      ...col,
      blocks: col.blocks.map((b) => {
        switch (b.type) {
          case 'heading': return b // mantém text + level (rótulo da seção)
          case 'text': return { ...b, props: { doc: { type: 'doc', content: [{ type: 'paragraph' }] } } }
          case 'image': return { ...b, props: { mediaId: '', alt: '' } }
          case 'gallery': return { ...b, props: { mediaIds: [] } }
          case 'video': return { ...b, props: { youtubeId: '' } }
          default: { const _exhaustive: never = b; return _exhaustive } // novo tipo de bloco vira erro de compilação
        }
      }),
    })),
  }))
}

/** True se algum bloco de mídia/vídeo está vazio (placeholder) — usado para bloquear publicação. */
export function contentHasEmptyMedia(content: Row[]): boolean {
  return content.some((row) =>
    row.columns.some((col) =>
      col.blocks.some((b) =>
        (b.type === 'image' && b.props.mediaId === '') ||
        (b.type === 'gallery' && b.props.mediaIds.length === 0) ||
        (b.type === 'video' && b.props.youtubeId === ''),
      ),
    ),
  )
}
```

- [ ] **Step 3: Build**

Run: `npm run build` → tsc OK. (Atenção ao `switch` exaustivo do discriminated union.)

- [ ] **Step 4: Commit**
```bash
git add server/modules/boletins/dto/block.schema.ts server/modules/boletins/boletins.template.utils.ts
git commit -m "feat(boletim): blocos de mídia/vídeo aceitam placeholder vazio + utils clone/strip/empty-media"
```

---

### Task A3: Repositório — filtro, templates, insert genérico

**Files:**
- Modify: `server/modules/boletins/boletins.repository.ts`

- [ ] **Step 1: `list` com filtro de status (exclui templates)**

Substituir o método `list` por:
```ts
async list({ limit, offset, status }: { limit: number; offset: number; status?: 'draft' | 'published' }):
  Promise<{ rows: BoletimRow[]; total: number }> {
  const where = ['is_template = false']
  const params: unknown[] = []
  if (status) { params.push(status); where.push(`status = $${params.length}`) }
  const clause = `WHERE ${where.join(' AND ')}`
  const rows = await this.pool.query<BoletimRow>(
    `SELECT * FROM boletins ${clause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  )
  const count = await this.pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM boletins ${clause}`, params,
  )
  return { rows: rows.rows, total: count.rows[0].count }
}
```

- [ ] **Step 2: `listTemplates` + `listTemplateOptions`**
```ts
async listTemplates({ limit, offset }: { limit: number; offset: number }):
  Promise<{ rows: BoletimRow[]; total: number }> {
  const rows = await this.pool.query<BoletimRow>(
    `SELECT * FROM boletins WHERE is_template = true ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
  const count = await this.pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM boletins WHERE is_template = true`,
  )
  return { rows: rows.rows, total: count.rows[0].count }
}

async listTemplateOptions(): Promise<{ id: string; title: string }[]> {
  const r = await this.pool.query<{ id: string; title: string }>(
    `SELECT id, title FROM boletins WHERE is_template = true ORDER BY created_at DESC`,
  )
  return r.rows
}
```

- [ ] **Step 3: `insertWithContent` (base de duplicar/template)**
```ts
async insertWithContent(
  { title, content, isTemplate, createdBy }:
  { title: string; content: Row[]; isTemplate: boolean; createdBy: string | null },
): Promise<BoletimRow> {
  const r = await this.pool.query<BoletimRow>(
    `INSERT INTO boletins (title, content, is_template, created_by)
     VALUES ($1, $2::jsonb, $3, $4) RETURNING *`,
    [title, JSON.stringify(content), isTemplate, createdBy],
  )
  return r.rows[0]
}
```
(`status`/`slug` ficam nos defaults: `draft`/`NULL` — satisfaz o CHECK.)

- [ ] **Step 4: Build**

Run: `npm run build` → tsc OK.

- [ ] **Step 5: Commit**
```bash
git add server/modules/boletins/boletins.repository.ts
git commit -m "feat(boletim): repo — filtro por status, listTemplates/options, insertWithContent"
```

---

### Task A4: Serviço — DTO isTemplate, completude, templates, duplicar

**Files:**
- Modify: `server/modules/boletins/boletins.service.ts`

- [ ] **Step 1: Import dos utils + `isTemplate` no DTO**

Topo do arquivo:
```ts
import { cloneContentWithNewIds, stripContent, contentHasEmptyMedia } from './boletins.template.utils.js'
```
Em `BoletimDTO` adicionar `isTemplate: boolean`; em `toDTO` adicionar `isTemplate: row.is_template`.

- [ ] **Step 2: Completude de mídia no `publish` + bloqueio de template**

No `publish()`, após os checks atuais de `missing`, antes do `if (missing.length)`:
```ts
if (row.is_template) throw new BadRequestError('Templates não podem ser publicados.')
if (contentHasEmptyMedia(row.content)) missing.push('media')
```

- [ ] **Step 3: Revalidar mídia ao editar um boletim PUBLICADO**

No `update()`, após obter `current` e antes de `repo.update`, quando o conteúdo muda:
```ts
const nextContent = dto.content ?? current.content
if (current.status === 'published' && contentHasEmptyMedia(nextContent)) {
  throw new BadRequestError('Boletim publicado não pode ficar com mídia vazia.', { missing: ['media'] })
}
```

- [ ] **Step 4: `create` com `templateId` + métodos novos**

Substituir `create` e adicionar métodos:
```ts
async create(dto: CreateBoletimDto, userId: string): Promise<BoletimDTO> {
  if (dto.templateId) return this.createFromTemplate(dto.templateId, dto.title, userId)
  return this.toDTO(await this.repo.create(dto.title, userId))
}

async createFromTemplate(templateId: string, title: string, userId: string): Promise<BoletimDTO> {
  const tpl = await this.repo.findById(templateId)
  if (!tpl || !tpl.is_template) throw new NotFoundError('Template não encontrado.')
  return this.toDTO(await this.repo.insertWithContent({
    title, content: cloneContentWithNewIds(tpl.content), isTemplate: false, createdBy: userId,
  }))
}

async duplicate(id: string, userId: string): Promise<BoletimDTO> {
  const src = await this.repo.findById(id)
  if (!src) throw new NotFoundError('Boletim não encontrado.')
  return this.toDTO(await this.repo.insertWithContent({
    title: `Cópia de ${src.title}`, content: cloneContentWithNewIds(src.content),
    isTemplate: false, createdBy: userId,
  }))
}

async saveAsTemplate(boletimId: string, name: string, clearContent: boolean, userId: string): Promise<BoletimDTO> {
  const src = await this.repo.findById(boletimId)
  if (!src) throw new NotFoundError('Boletim não encontrado.')
  const content = clearContent ? stripContent(src.content) : cloneContentWithNewIds(src.content)
  return this.toDTO(await this.repo.insertWithContent({ title: name, content, isTemplate: true, createdBy: userId }))
}

async createBlankTemplate(name: string, userId: string): Promise<BoletimDTO> {
  return this.toDTO(await this.repo.insertWithContent({ title: name, content: [], isTemplate: true, createdBy: userId }))
}

async listTemplates(params: ListBoletinsQuery): Promise<Paginated<BoletimDTO>> {
  const { rows, total } = await this.repo.listTemplates({ limit: params.limit, offset: toOffset(params) })
  return paginate(rows.map((r) => this.toDTO(r)), total, params)
}

async listTemplateOptions(): Promise<{ id: string; title: string }[]> {
  return this.repo.listTemplateOptions()
}

async getTemplateById(id: string): Promise<BoletimDTO> {
  const row = await this.repo.findById(id)
  if (!row || !row.is_template) throw new NotFoundError('Template não encontrado.')
  return this.toDTO(row)
}

async updateTemplate(id: string, dto: UpdateBoletimDto): Promise<BoletimDTO> {
  await this.getTemplateById(id) // garante que é template
  // updateBoletimDto não carrega status/slug → repo.update nunca os escreve (CHECK preservado).
  return this.update(id, dto)
}

async deleteTemplate(id: string): Promise<void> {
  await this.getTemplateById(id)
  await this.repo.delete(id)
}
```

- [ ] **Step 5: Filtro de status no `list` + públicas defensivas**

`list(params)`: passar `status: params.status` para `repo.list`. Em `getPublishedBySlug`/`getLatestPublished` (no repo) acrescentar `AND is_template = false` nas queries.

- [ ] **Step 6: Build**

Run: `npm run build` → tsc OK.

- [ ] **Step 7: Commit**
```bash
git add server/modules/boletins/boletins.service.ts server/modules/boletins/boletins.repository.ts
git commit -m "feat(boletim): serviço — templates, duplicar, save-as, completude no publish/edit-publicado"
```

---

### Task A5: DTOs + controller + rotas

**Files:**
- Modify: `server/modules/boletins/dto/boletim.dto.ts`
- Modify: `server/modules/boletins/boletins.controller.ts`
- Modify: `server/modules/boletins/boletins.routes.ts`

- [ ] **Step 1: DTOs**
```ts
export const createBoletimDto = z.object({
  title: z.string().trim().min(1, 'Título é obrigatório.').max(200),
  templateId: z.string().uuid().optional(),
})

export const listBoletinsQuery = paginationQuery.extend({
  status: z.enum(['draft', 'published']).optional(),
})

export const createTemplateDto = z.object({ name: z.string().trim().min(1).max(200) })
export type CreateTemplateDto = z.infer<typeof createTemplateDto>

export const saveAsTemplateDto = z.object({
  name: z.string().trim().min(1).max(200),
  clearContent: z.boolean(),
})
export type SaveAsTemplateDto = z.infer<typeof saveAsTemplateDto>

export const listTemplatesQuery = paginationQuery
```

- [ ] **Step 2: Controller — novos handlers**

Adicionar em `BoletinsController` (usar `String(req.params.id)`, validar uuid onde o spec pede):
```ts
duplicate = async (req: Request, res: Response) => {
  res.status(201).json({ boletim: await this.service.duplicate(String(req.params.id), req.user!.id) })
}

saveAsTemplate = async (req: Request, res: Response) => {
  const dto = saveAsTemplateDto.parse(req.body)
  res.status(201).json({ boletim: await this.service.saveAsTemplate(String(req.params.id), dto.name, dto.clearContent, req.user!.id) })
}

listTemplates = async (req: Request, res: Response) => {
  res.json(await this.service.listTemplates(listTemplatesQuery.parse(req.query)))
}

templateOptions = async (_req: Request, res: Response) => {
  res.json({ templates: await this.service.listTemplateOptions() })
}

createTemplate = async (req: Request, res: Response) => {
  const dto = createTemplateDto.parse(req.body)
  res.status(201).json({ boletim: await this.service.createBlankTemplate(dto.name, req.user!.id) })
}

getTemplate = async (req: Request, res: Response) => {
  res.json({ boletim: await this.service.getTemplateById(String(req.params.id)) })
}

updateTemplate = async (req: Request, res: Response) => {
  res.json({ boletim: await this.service.updateTemplate(String(req.params.id), updateBoletimDto.parse(req.body)) })
}

deleteTemplate = async (req: Request, res: Response) => {
  await this.service.deleteTemplate(String(req.params.id)); res.status(204).end()
}
```
O `list` existente passa a usar `listBoletinsQuery` (já com `status`).

- [ ] **Step 3: Rotas (ORDEM importa)**

Em `makeBoletinsAdminRoutes`, com `requireCsrf` já importado. Declarar **antes** das rotas `/boletins/:id*`:
```ts
const tplManage = requirePermission('boletim:templates:manage')
// ... existentes: list, create ...
r.get('/boletins/template-options', wrap(requireAuth), write, wrap(c.templateOptions))
r.get('/boletins/templates', wrap(requireAuth), tplManage, wrap(c.listTemplates))
r.post('/boletins/templates', wrap(requireAuth), tplManage, requireCsrf, wrap(c.createTemplate))
r.get('/boletins/templates/:id', wrap(requireAuth), tplManage, wrap(c.getTemplate))
r.patch('/boletins/templates/:id', wrap(requireAuth), tplManage, requireCsrf, wrap(c.updateTemplate))
r.delete('/boletins/templates/:id', wrap(requireAuth), tplManage, requireCsrf, wrap(c.deleteTemplate))
// ... depois as de /boletins/:id (get, patch, publish, unpublish, delete) ...
r.post('/boletins/:id/duplicate', wrap(requireAuth), write, requireCsrf, wrap(c.duplicate))
r.post('/boletins/:id/save-as-template', wrap(requireAuth), write, tplManage, requireCsrf, wrap(c.saveAsTemplate))
```
Garanta que `r.get('/boletins/:id', ...)` e demais `:id` venham **depois** das literais `template-options`/`templates`.

- [ ] **Step 4: Build + verificação por curl**

Run: `npm run build`. Reinicie o server. Logado como admin (cookies), testar:
```
GET  /api/admin/boletins?status=draft   → só rascunhos
GET  /api/admin/boletins/template-options → { templates: [] }
POST /api/admin/boletins/templates {name:"T1"} → 201 { boletim: {isTemplate:true,...} }
GET  /api/admin/boletins/templates → lista paginada com T1
```
(Use o DevTools/Network do painel ou `curl` reaproveitando cookies + header CSRF.)

- [ ] **Step 5: Commit**
```bash
git add server/modules/boletins/dto/boletim.dto.ts server/modules/boletins/boletins.controller.ts server/modules/boletins/boletins.routes.ts
git commit -m "feat(boletim): DTOs/rotas — templates, duplicar, save-as-template, template-options"
```

---

## FASE B — Frontend: API + US-20 (lista)

### Task B1: API client

**Files:**
- Modify: `src/painel/boletim-api.ts`

- [ ] **Step 1: Tipo + funções**

- `Boletim` ganha `isTemplate: boolean`.
- `listBoletins(page, limit, status?)`: incluir `status` no querystring quando definido.
- `createBoletim(title, templateId?)`: incluir `templateId` no body quando definido.
- Adicionar:
```ts
export async function duplicateBoletim(id: string): Promise<Boletim> {
  const res = await adminFetch(`/boletins/${id}/duplicate`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao duplicar boletim.'))
  return (await res.json()).boletim
}
export async function saveAsTemplate(id: string, name: string, clearContent: boolean): Promise<Boletim> {
  const res = await adminFetch(`/boletins/${id}/save-as-template`,
    { method: 'POST', body: JSON.stringify({ name, clearContent }) })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao salvar como template.'))
  return (await res.json()).boletim
}
export async function listTemplateOptions(): Promise<{ id: string; title: string }[]> {
  const res = await adminFetch('/boletins/template-options')
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao listar templates.'))
  return (await res.json()).templates
}
// Lifecycle de template:
export async function listTemplates(page: number, limit: number): Promise<{ data: Boletim[]; pagination: PageInfo }> { /* GET /boletins/templates?page=&limit= */ }
export async function createTemplate(name: string): Promise<Boletim> { /* POST /boletins/templates {name} */ }
export async function getTemplate(id: string): Promise<Boletim> { /* GET /boletins/templates/:id → .boletim */ }
export async function updateTemplate(id: string, patch: UpdatePatch): Promise<Boletim> { /* PATCH /boletins/templates/:id */ }
export async function deleteTemplate(id: string): Promise<void> { /* DELETE /boletins/templates/:id */ }
```
- `labelForMissing`: adicionar `case 'media': return 'imagem/vídeo sem conteúdo'`.

- [ ] **Step 2: Build**

Run: `npm run build` → tsc OK.

- [ ] **Step 3: Commit**
```bash
git add src/painel/boletim-api.ts
git commit -m "feat(boletim): API client — duplicar, save-as-template, templates, template-options"
```

---

### Task B2: Lista de boletins — filtro, duplicar, salvar-como-template, seletor no criar

**Files:**
- Modify: `src/painel/pages/Boletins.tsx`

- [ ] **Step 1: Filtro por status**

Estado `status: 'all' | 'draft' | 'published'` (default `all`). Acima da tabela, três `Chip`/botões segmentados (Todos · Rascunhos · Publicados). Ao trocar, `setPage(1)` e recarregar. Passar `status === 'all' ? undefined : status` para `listBoletins`.

- [ ] **Step 2: Ação "Duplicar"**

Botão `secondary sm` "Duplicar" por linha → `ensureCsrf()` + `duplicateBoletim(b.id)` → `navigate('/painel/boletins/' + novo.id)`.

- [ ] **Step 3: Ação "Salvar como template"**

Botão `ghost sm` "Salvar como template" → abre modal com `Input` nome (default `b.title`) + checkbox **"Limpar conteúdo (manter só a estrutura e os títulos)"** → `saveAsTemplate(b.id, name, clear)`; sucesso mostra `Alert ok` "Template criado".

- [ ] **Step 4: Seletor de template no `CreateModal`**

No `CreateModal`, ao montar, `listTemplateOptions()`. Render: rádio "Em branco" (default) + um rádio por template (por título). Se lista vazia, mostrar só "Em branco". `submit` chama `createBoletim(title, selectedTemplateId)`.

- [ ] **Step 5: Build + verificação manual**

Run: `npm run build`. No painel `/painel/boletins`:
- Filtro alterna a lista corretamente; templates **não** aparecem aqui.
- "Duplicar" cria "Cópia de …" e abre o editor.
- "Salvar como template" cria um template — confirme aqui pelo **201 no Network** (a página de Templates só é ligada na Task C3, onde o template aparece na lista).
- "Novo boletim" mostra o seletor (após existir ≥1 template).

- [ ] **Step 6: Commit**
```bash
git add src/painel/pages/Boletins.tsx
git commit -m "feat(boletim): lista com filtro de status, duplicar, salvar-como-template e seletor de template (US-20)"
```

---

## FASE C — Frontend: US-21 (templates) + editor

### Task C1: Editor em modo template + relaxar trava de save

**Files:**
- Modify: `src/painel/pages/BoletimEditor.tsx`

- [ ] **Step 1: Detectar modo template (via prop)**

`BoletimEditor` ganha a prop `mode?: 'boletim' | 'template'` com default `'boletim'` (assinatura: `export default function BoletimEditor({ mode = 'boletim' }: { mode?: 'boletim' | 'template' })`). **Mecanismo único — não usar `useLocation`.** O `App.tsx` (Task C3) passa `mode="template"` na rota de template. Em modo template, usar `getTemplate`/`updateTemplate` no lugar de `getBoletim`/`updateBoletim`.

- [ ] **Step 2: Esconder UI de publicação no modo template**

Quando `mode === 'template'`: não renderizar o card "Boletim publicado", nem os botões Publicar/Despublicar, nem o badge de slug; título do `PageHeader` = "Editar template"; o campo Título funciona como renomear. Manter Salvar, Pré-visualizar (opcional), Conteúdo.

- [ ] **Step 3: Relaxar a trava de save (placeholders permitidos)**

Em `persist()`, **remover** o bloqueio por `findIncompleteBlock` no fluxo de **salvar** (rascunhos e templates podem ter mídia vazia). Manter: **título obrigatório** (já existe) e — apenas para `mode === 'boletim'` — `contentIsEmpty(rows)` (esse helper **já existe** e já é usado; templates pulam essa checagem, pois podem ser salvos vazios). A completude de mídia é validada pelo servidor no **publicar** (`PublishIncompleteError`) e ao **editar um boletim publicado** (o `update()` retorna 400 — §5.3). O `handleSave` atual já faz `try/catch` e exibe `(e as Error).message`, então o 400 do `updateBoletim` aparece sem mudança extra.
> Remover `findIncompleteBlock`/`isIncompleteBlock` se ficarem sem uso (evita confundir). Se preferir manter como aviso visual **não-bloqueante**, é opcional.

> **Placeholder de mídia (§8.4) — já implementado:** `ImageEditor.tsx` mostra "Escolher imagem" quando `mediaId===''`; `GalleryEditor.tsx` mostra "Escolher imagens" quando `mediaIds.length===0`; `VideoEditor.tsx` tem input de URL vazio. Os blocos vazios já renderizam o seletor — **nenhum trabalho novo de render**; apenas confirmar no browser.

- [ ] **Step 4: Build + verificação**

Run: `npm run build`. Verificar:
- Rascunho com bloco de imagem vazio **salva** sem erro (antes bloqueava).
- Publicar um rascunho com mídia vazia → erro "Faltando: …, imagem/vídeo sem conteúdo".
- **Editar um boletim PUBLICADO esvaziando uma imagem e Salvar → erro legível** (400 do servidor, §5.3) e o boletim segue publicado com a mídia anterior.
- Editor de template não mostra Publicar/slug; blocos de imagem/galeria/vídeo vazios mostram o botão de escolher.

- [ ] **Step 5: Commit**
```bash
git add src/painel/pages/BoletimEditor.tsx
git commit -m "feat(boletim): editor em modo template + salvar permite placeholders (completude no publish)"
```

---

### Task C2: Página de Templates

**Files:**
- Create: `src/painel/pages/Templates.tsx`

- [ ] **Step 1: Página de listagem/gestão**

Espelhar o padrão de `Boletins.tsx` (usePagination, kit UI). Colunas: Nome, Atualizado em, ações. Ações por linha: **Editar** (`navigate('/painel/boletins/templates/' + t.id)`), **Renomear** (modal nome → `updateTemplate(id, { title })`), **Excluir** (modal confirmação → `deleteTemplate(id)`). Header com **Novo template** (modal nome → `createTemplate(name)` → navega ao editor do template). `EmptyState` quando vazio. Paginado com `Pager`. `ensureCsrf()` antes de mutações.

- [ ] **Step 2: Build + verificação**

Run: `npm run build`. (A rota ainda será ligada na Task C3; pode validar visualmente após C3.)

- [ ] **Step 3: Commit**
```bash
git add src/painel/pages/Templates.tsx
git commit -m "feat(boletim): página de gestão de templates (US-21 CA-03)"
```

---

### Task C3: Navegação + rotas

**Files:**
- Modify: `src/painel/nav-config.tsx`
- Modify: `src/painel/Sidebar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: `NavLeaf` com permissão por child**

Em `nav-config.tsx`: `interface NavLeaf { label: string; to: string; perm?: string }`. "Boletins" vira `NavGroup`:
```tsx
{
  key: 'boletins', label: 'Boletins', icon: icon(I.boletins), perm: 'boletim:write', children: [
    { label: 'Lista', to: '/painel/boletins' },
    { label: 'Templates', to: '/painel/boletins/templates', perm: 'boletim:templates:manage' },
  ],
},
```

- [ ] **Step 2: Sidebar filtra children por permissão**

`Sidebar.tsx` já usa `const { logout, hasPermission } = useAuth()` e filtra os grupos com `NAV.filter(e => !e.perm || hasPermission(e.perm))`. Aplicar o **mesmo** `hasPermission` aos children do grupo. **Atenção:** `group.children` é mapeado em **dois** pontos do `Sidebar.tsx` — a lista inline expandida e o flyout colapsado. Aplicar o filtro nos **dois** (senão um child gateado vaza num dos modos):
```tsx
group.children.filter(c => !c.perm || hasPermission(c.perm)).map(child => ( /* … */ ))
```
> Como o admin detém todas as permissões, o caso negativo não aparece no teste manual — revise o código para garantir que está correto mesmo sem disparar.

- [ ] **Step 3: Rotas no `App.tsx`**

Importar `Templates`. Dentro de `/painel`:
```tsx
<Route path="boletins/templates" element={<RequirePermission perm="boletim:templates:manage"><Templates/></RequirePermission>} />
<Route path="boletins/templates/:id" element={<RequirePermission perm="boletim:templates:manage"><BoletimEditor mode="template"/></RequirePermission>} />
```
(declarar **antes** de `boletins/:id` e `boletins/:id/preview`). Passar `mode="boletim"` (default) nas rotas existentes do editor, conforme a abordagem escolhida na Task C1.

- [ ] **Step 4: Build + verificação manual (fluxo completo)**

Run: `npm run build`. No painel:
- Menu "Boletins" expande em Lista + Templates.
- Templates: criar em branco → abre editor (sem Publicar) → adicionar blocos/placeholders → salvar → renomear → voltar.
- Lista de boletins → "Novo boletim" → escolher o template → novo rascunho com a estrutura copiada (ids novos) → preencher mídia → publicar OK.
- Tentar abrir um template por URL pública não existe (sem slug).

- [ ] **Step 5: Commit**
```bash
git add src/painel/nav-config.tsx src/painel/Sidebar.tsx src/App.tsx
git commit -m "feat(boletim): menu Boletins (Lista+Templates) + rotas do editor de template (US-21)"
```

---

## FASE D — Fechamento

### Task D1: Verificação ponta-a-ponta + DoD

**Files:** nenhum (validação).

- [ ] **Step 1: Checklist manual (spec §10)**
  - Criar template em branco; editar; renomear; excluir.
  - Salvar boletim como template **com** limpar (blocos mantidos, textos/mídia vazios, **títulos preservados**) e **sem** limpar (cópia idêntica).
  - Criar boletim a partir de template → rascunho com estrutura; ids de bloco **diferentes** do template (inspecionar via Network/JSON).
  - Criar boletim em branco continua funcionando.
  - Filtro por status correto; templates ausentes da lista de boletins.
  - Duplicar → "Cópia de …".
  - Rascunho com imagem vazia salva; publicar exige preencher (mensagem com "imagem/vídeo sem conteúdo").
  - Editar boletim **publicado** esvaziando uma imagem → backend rejeita.
  - Permissão: como admin tudo funciona (admin detém todas as permissões).

- [ ] **Step 2: Atualizar a documentação das histórias**

Marcar os itens de DoD em `docs/historias/US-20-gerenciar-boletins.md` e `US-21-templates-boletim.md` conforme entregue (seguir o padrão das US anteriores).

- [ ] **Step 3: Commit**
```bash
git add docs/historias/US-20-gerenciar-boletins.md docs/historias/US-21-templates-boletim.md
git commit -m "docs(historias): DoD US-20/US-21 marcados como entregues"
```

- [ ] **Step 4: Revisão final + PR**

Seguir `superpowers:finishing-a-development-branch`: revisão de código final, push da branch `feat/boletins-gerenciar-templates` e abertura de PR para `master` (descrevendo US-20 + US-21, fechando o épico).

---

## Notas de risco / armadilhas
- **Ordem das rotas**: `template-options` e `templates*` ANTES de `:id*`, senão "templates" é capturado como `:id`.
- **ESM no backend**: imports internos com sufixo `.js` mesmo em `.ts`.
- **CHECK**: nunca passe `slug`/`status` em `insertWithContent`/`updateTemplate` — deixaria o template inválido.
- **Schema espelho client**: `src/schemas/boletim.ts` é **tipos TS** (não Zod) e já cria blocos vazios; a relaxação efetiva no client é remover a trava de save no editor (Task C1), não mexer em tipos.
- **`mediaInUse`** (US-17) segue varrendo todas as linhas (inclui templates) — mídia usada por template continua protegida; `mediaId=''` nunca casa com uuid real.
