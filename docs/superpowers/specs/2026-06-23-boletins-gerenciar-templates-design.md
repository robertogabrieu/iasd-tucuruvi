# Spec — Gerenciar boletins (US-20) + Templates de boletim (US-21)

- **Data:** 2026-06-23
- **Épico:** Boletim Informativo (fecha o épico)
- **Histórias:** `docs/historias/US-20-gerenciar-boletins.md`, `docs/historias/US-21-templates-boletim.md`
- **Relacionado:** US-16 (editor), US-18 (publicação), US-19 (página pública), US-17 (mídia)

---

## 1. Objetivo e contexto

Fechar o épico do Boletim Informativo com duas frentes:

- **US-20 — Gerenciar boletins.** A tela `/painel/boletins` já lista (título, status, data), edita, publica/despublica, copia link e exclui com confirmação. **Faltam:** filtro por status (CA-02) e a ação opcional **duplicar** (CA-05).
- **US-21 — Templates.** Conceito novo: um molde reutilizável de blocos para produzir o boletim semanal sem remontar a estrutura. Um template é, em essência, **um boletim sem slug/publicação, marcado com `is_template`** — reusa tabela, repositório, serviço e o **editor da US-16**.

## 2. Escopo

### Dentro
- US-20: filtro por status na listagem; duplicar boletim.
- US-21: CRUD de templates; criar boletim a partir de template (ou em branco); salvar boletim como template (com opção de limpar conteúdo); templates nunca públicos; submenu no painel.
- Relaxar o schema de blocos para permitir blocos de mídia/vídeo **vazios** (placeholder) e mover a exigência de completude de mídia para o **publicar**.

### Fora (YAGNI)
- Template inicial semeado (decisão do usuário: começar sem templates).
- Versionamento de template, galeria pública de templates, multi-tenant.

## 3. Decisões de design (confirmadas)

1. **Template = linha em `boletins` com `is_template = true`**, `status='draft'`, `slug NULL`. Reusa todo o pipeline existente.
2. **Permissões:** lifecycle de template exige `boletim:templates:manage`; criar boletim a partir de template, duplicar e editar conteúdo de boletim exigem `boletim:write`; publicar segue `boletim:publish`.
3. **Blocos-placeholder vazios:** o schema de blocos passa a aceitar `image.mediaId=''`, `gallery.mediaIds=[]`, `video.youtubeId=''`. Isso vale para rascunhos **e** templates. A **completude de mídia é exigida no `publish()`**, não no save.
4. **"Limpar conteúdo" (`stripContent`)** mantém todos os blocos/linhas/colunas; esvazia `text` e mídias/vídeo; **mantém o texto dos blocos `heading`** (são o rótulo da seção — "o que vai em cada coluna").
5. **Editor reusado** para templates (`BoletimEditor`), com a UI de publicação/slug/copiar-link oculta no modo template.
6. **Menu** "Boletins" vira grupo: **Lista** + **Templates** (child gateado por `boletim:templates:manage`).

## 4. Modelo de dados

### 4.1 Migration `006_boletim_templates.sql`
```sql
ALTER TABLE boletins ADD COLUMN is_template boolean NOT NULL DEFAULT false;

-- Integridade: template nunca é publicado nem tem link público.
ALTER TABLE boletins ADD CONSTRAINT chk_template_unpublished
  CHECK (NOT is_template OR (status = 'draft' AND slug IS NULL));

-- Listagem de templates por data.
CREATE INDEX idx_boletins_is_template ON boletins (is_template, created_at DESC);
```
- `BoletimRow` (repository) ganha `is_template: boolean`.
- Migrations rodam no boot (`runMigrations`).

### 4.2 Permissão (catálogo, sem migration)
Adicionar a `server/seed/permissions.catalog.ts`:
```ts
{ key: 'boletim:templates:manage', description: 'Criar/editar/remover templates de boletim' },
```
O `runSeed` → `linkAllPermissions(admin)` concede ao admin no próximo boot.

## 5. Schema de blocos (relaxar) + completude no publicar

### 5.1 `server/modules/boletins/dto/block.schema.ts` (e espelho `src/schemas/boletim.ts`)
- `imageBlock.props.mediaId`: `z.union([z.string().uuid(), z.literal('')])` (vazio = placeholder).
- `galleryBlock.props.mediaIds`: `z.array(z.string().uuid()).max(30)` (remove `.min(1)` → permite `[]`).
- `videoBlock.props.youtubeId`: `z.union([youtubeId, z.literal('')])`.
- `heading.props.text` e `text.props.doc` já aceitam vazio.
- **Manter os dois schemas (server/client) em sincronia** (convenção do projeto).

### 5.2 Completude no `publish()` (`boletins.service.ts`)
- Nova função pura `contentHasEmptyMedia(content): boolean` — varre linhas→colunas→blocos e retorna true se houver `image` com `mediaId===''`, `gallery` com `mediaIds.length===0` ou `video` com `youtubeId===''`.
- Em `publish()`, se `contentHasEmptyMedia(row.content)` → adicionar `'media'` ao array `missing` (continua lançando `BadRequestError('Boletim incompleto…', { missing })`).
- `publish()` também rejeita defensivamente `is_template` (`BadRequestError`), embora a UI não ofereça.

### 5.3 Frontend (`src/painel/boletim-api.ts`)
- `labelForMissing`: mapear `'media'` → "imagem/vídeo sem conteúdo".

## 6. `stripContent` (limpar conteúdo)

Função pura em `boletins.service.ts` (ou `boletins.template.utils.ts`), retorna cópia profunda:
- `heading` → **mantém** `props.text` e `level` (rótulo da seção).
- `text` → `props.doc = { type: 'doc', content: [{ type: 'paragraph' }] }` (doc vazio).
- `image` → `props.mediaId = ''`, `props.alt = ''`.
- `gallery` → `props.mediaIds = []`.
- `video` → `props.youtubeId = ''`.
- Preserva todos os `id`, linhas e colunas (estrutura intacta).

## 7. Backend — repositório, serviço, controller, rotas

### 7.1 Repository (`boletins.repository.ts`)
- `BoletimRow` + `is_template`.
- `list({ limit, offset, status? })`: `WHERE is_template = false [AND status = $]` `ORDER BY created_at DESC`; `count` com o mesmo filtro.
- `listTemplates({ limit, offset })`: `WHERE is_template = true ORDER BY created_at DESC` (+ count).
- `insertWithContent({ title, content, isTemplate, createdBy })`: `INSERT … (title, content, is_template, created_by) … RETURNING *`. Base para duplicar / criar-de-template / salvar-como-template / template em branco.
- `findById` já retorna `is_template` (SELECT *).
- `mediaInUse` permanece varrendo **todas** as linhas (inclui templates) — mídia usada por template segue protegida (CA-05 US-17). `mediaId=''` nunca casa com uuid real.

### 7.2 Service (`boletins.service.ts`)
- `BoletimDTO` + `isTemplate: boolean`; `toDTO` inclui `isTemplate: row.is_template`.
- `list(params)` aceita `status?`.
- `listTemplates(params)`.
- `create(dto, userId)`: se `dto.templateId` → `createFromTemplate`; senão cria em branco (comportamento atual).
- `createFromTemplate(templateId, title, userId)`: lê template (NotFound se ausente/`!is_template`); `insertWithContent({ title, content: tpl.content, isTemplate:false, createdBy:userId })`.
- `duplicate(id, userId)`: lê boletim; `insertWithContent({ title: 'Cópia de ' + src.title, content: src.content, isTemplate:false })`.
- `saveAsTemplate(boletimId, name, clearContent, userId)`: lê boletim; `content = clearContent ? stripContent(src.content) : src.content`; `insertWithContent({ title:name, content, isTemplate:true })`.
- `createBlankTemplate(name, userId)`: `insertWithContent({ title:name, content: [], isTemplate:true })`.
- `getTemplateById(id)`: `findById` + assert `is_template` (NotFound caso contrário).
- `updateTemplate(id, dto)`: assert template; reusa `repo.update`.
- `deleteTemplate(id)`: assert template; reusa `repo.delete`.
- Públicas (`getPublishedBySlug`, `getLatestPublished`): acrescentar `AND is_template = false` nas queries (defensivo/explícito).

### 7.3 DTOs (`dto/boletim.dto.ts`)
- `createBoletimDto`: `+ templateId: z.string().uuid().optional()`.
- `listBoletinsQuery`: `paginationQuery.extend({ status: z.enum(['draft','published']).optional() })`.
- `createTemplateDto`: `{ name: z.string().trim().min(1).max(200) }`.
- `saveAsTemplateDto`: `{ name: z.string().trim().min(1).max(200), clearContent: z.boolean() }`.
- `listTemplatesQuery = paginationQuery`.

### 7.4 Controller + rotas (`boletins.controller.ts`, `boletins.routes.ts`)
Admin (montado em `/api/admin`). **Ordem importa:** declarar `/boletins/templates*` antes de `/boletins/:id*`.
```
GET    /boletins                 [write]            list (exclui templates; ?status=&page=&limit=)
POST   /boletins                 [write] +csrf      create (blank ou {templateId})
GET    /boletins/templates       [tpl:manage]       listTemplates
POST   /boletins/templates       [tpl:manage] +csrf createBlankTemplate {name}
GET    /boletins/templates/:id   [tpl:manage]       getTemplate
PATCH  /boletins/templates/:id   [tpl:manage] +csrf updateTemplate
DELETE /boletins/templates/:id   [tpl:manage] +csrf deleteTemplate
GET    /boletins/:id             [write]            get
PATCH  /boletins/:id             [write] +csrf      update
POST   /boletins/:id/publish     [publish] +csrf
POST   /boletins/:id/unpublish   [publish] +csrf
POST   /boletins/:id/duplicate   [write] +csrf      duplicate
POST   /boletins/:id/save-as-template [tpl:manage] +csrf  {name, clearContent}
DELETE /boletins/:id             [write] +csrf      remove
```
- Controller fino: parse DTO, chama service, monta `{ boletim }` / `{ data, pagination }` (padrão atual). `String(req.params.id)` (Express 5).
- Pública (`/api/boletins`) inalterada: `GET /` (latest) e `GET /:slug` já excluem templates por status/slug.

## 8. Frontend

### 8.1 API client (`src/painel/boletim-api.ts`)
- `Boletim` + `isTemplate: boolean`.
- `listBoletins(page, limit, status?)`.
- `createBoletim(title, templateId?)`.
- `duplicateBoletim(id)`, `saveAsTemplate(id, name, clearContent)`.
- Funções de template: `listTemplates(page, limit)`, `createTemplate(name)`, `getTemplate(id)`, `updateTemplate(id, patch)`, `deleteTemplate(id)`.

### 8.2 Lista de boletins (`src/painel/pages/Boletins.tsx`)
- **Filtro por status** (segmented/Chips: Todos · Rascunhos · Publicados) → repassa a `listBoletins`. Reseta página ao trocar.
- Ações por linha ganham **Duplicar** (chama `duplicateBoletim` → navega ao editor do novo rascunho) e **Salvar como template** (modal: nome + checkbox "Limpar conteúdo (manter só a estrutura)").
- `CreateModal` ganha seletor: **Em branco** (default) ou um template (busca `listTemplates`; lista por nome). Envia `templateId` quando aplicável.

### 8.3 Página de templates (`src/painel/pages/Templates.tsx`, nova)
- Lista templates (nome, atualizado em, ações: **Editar**, **Renomear**, **Excluir** com confirmação) + **Novo template** (modal nome). Reusa `Table/Modal/Pager/EmptyState`. Paginado.

### 8.4 Editor reusado (`src/painel/pages/BoletimEditor.tsx`)
- Modo template (via rota `/painel/boletins/templates/:id`): usa a API de template; **esconde** publicar/despublicar/slug/copiar-link/preview-público; título funciona como renomear.
- **Render de placeholder**: blocos `image`/`gallery`/`video` com ref vazia exibem um placeholder ("Selecione uma imagem/vídeo aqui") + botão de escolher (reusa MediaPicker). Vale para boletins e templates.

### 8.5 Navegação e rotas
- `nav-config.tsx`: "Boletins" vira `NavGroup` → children **Lista** (`/painel/boletins`, perm `boletim:write`) e **Templates** (`/painel/boletins/templates`, perm `boletim:templates:manage`). Estender `NavLeaf` com `perm?` e o `Sidebar` para filtrar children por permissão.
- `App.tsx`: adicionar `/painel/boletins/templates` (`<RequirePermission perm="boletim:templates:manage"><Templates/></RequirePermission>`) e `/painel/boletins/templates/:id` (editor em modo template, mesma permissão). Rotas atuais de boletim permanecem com `boletim:write`.

### 8.6 Schema espelho (`src/schemas/boletim.ts`)
- Aplicar a mesma relaxação de §5.1 (mídia/vídeo vazios).

## 9. Segurança / robustez
- Toda rota de escrita: `requireAuth` + permissão + `requireCsrf` (padrão do módulo).
- `CHECK` garante que template nunca seja publicado/tenha slug, mesmo por caminho inesperado.
- Templates não são alcançáveis publicamente (sem slug; `/boletins/:slug` → 404; ausentes do menu "último boletim").
- Criar-de-template/duplicar copia o JSONB no servidor (cópia profunda), sem expor estrutura interna ao client.

## 10. Verificação manual (sem suíte de testes — convenção do projeto)
- Criar template em branco; editar no editor reusado; renomear; excluir (com confirmação).
- Salvar um boletim como template **com** "limpar": blocos preservados, textos/mídias vazios, **títulos mantidos**. **Sem** "limpar": cópia idêntica.
- Criar boletim a partir de template → novo rascunho com a estrutura; placeholders de mídia visíveis; salvar funciona; **publicar bloqueado** até preencher mídia (mensagem "Faltando: …, imagem/vídeo sem conteúdo").
- Criar boletim em branco continua funcionando.
- Filtro por status mostra o subconjunto correto; templates **não** aparecem na lista de boletins.
- Duplicar cria rascunho "Cópia de …".
- Rascunho com bloco de imagem vazio **salva**; publicar exige preencher.

## 11. Definição de pronto

### US-20
- [ ] Lista com título, status, data e ações (já existe) + **filtro por status**.
- [ ] Editar, publicar/despublicar, copiar link, excluir com confirmação (já existe).
- [ ] **Duplicar** → novo rascunho "Cópia de …".

### US-21
- [ ] Criar boletim a partir de template (ou em branco).
- [ ] Criar, editar, renomear e remover templates (editor reusado).
- [ ] Salvar boletim como template (com opção de limpar conteúdo, mantendo títulos).
- [ ] Templates não expostos publicamente; `boletim:templates:manage` exigido no lifecycle.
- [ ] Schema relaxado + completude de mídia exigida no publicar; schemas server/client em sincronia.
