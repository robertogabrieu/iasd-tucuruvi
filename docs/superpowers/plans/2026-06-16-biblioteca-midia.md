# Biblioteca de Mídia (US-17) — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma biblioteca de mídia no painel administrativo — upload de imagens (validadas por conteúdo, reencodadas com thumbnail), grade com busca/paginação, exclusão, e rotas públicas para servir os arquivos — como fundação do futuro editor de boletim.

**Architecture:** Backend em camadas no padrão do projeto (`routes → controller → service → repository → db`) num novo módulo `server/modules/media/`, com dois helpers sem estado (`media.image.ts` via `sharp`, `media.storage.ts` para o filesystem). Arquivos num volume Docker; metadata na tabela `media`. Frontend numa página `/painel/midia` composta só com o kit de UI. Exclusão "em uso" fica adiada via um registry de *usage checkers* (hoje vazio).

**Tech Stack:** Express 5 · PostgreSQL 16 (`pg`) · `multer` (multipart) · `sharp` (processamento de imagem) · Zod · React 18 + TS + Vite · Tailwind · kit de UI em `src/painel/ui`.

---

## ⚠️ Convenção do projeto: SEM testes automatizados

`CLAUDE.md` define explicitamente *"Sem suíte de testes ativa… validação manual no browser"*. **Não** há test runner instalado e **não** adicionaremos um. Cada task substitui o ciclo TDD por **verificação manual concreta** (curl/browser) antes do commit. Mantemos a granularidade bite-sized e commits frequentes.

**Convenções obrigatórias a respeitar em todo arquivo novo:**
- **ESM com sufixo `.js`** nos imports internos de `server/` (mesmo em `.ts`): `import { x } from './media.repository.js'`.
- Backend novo de `/api/admin` segue as 4 camadas + injeção por construtor no `container.ts` (composition root).
- `media.image.ts` e `media.storage.ts` são **funções/objetos sem estado** — não criar classes triviais (regra anti-complexidade do `CLAUDE.md`).
- Páginas do painel usam **só** o kit `@/painel/ui` (ver `docs/patterns/area-administrativa-visual.md`).
- Listagem paginada pelo contrato `?page=&limit=` + envelope `{ data, pagination }` (`server/core/pagination.ts`).

**Pré-condição:** trabalhar na branch `feat/biblioteca-midia` (já criada; o spec já está commitado nela).

---

## Task 0: Dependências, configuração, volume e proxy

**Files:**
- Modify: `package.json` (via npm)
- Modify: `server/core/config.ts`
- Modify: `docker-compose.yml`
- Modify: `vite.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Instalar dependências**

Run:
```bash
npm install multer sharp
npm install -D @types/multer
```
Expected: `package.json` ganha `multer`, `sharp` em deps e `@types/multer` em devDeps; `npm install` conclui sem erro.

- [ ] **Step 2: Adicionar config de uploads em `server/core/config.ts`**

No topo do arquivo, garantir o import de `path` (ESM):
```ts
import path from 'path'
```
Dentro do objeto `config`, acrescentar (depois de `databaseUrl`):
```ts
  // Biblioteca de mídia (US-17)
  uploadsDir: process.env.UPLOADS_DIR ||
    (process.env.NODE_ENV === 'production' ? '/app/uploads' : path.resolve('.uploads')),
  mediaMaxBytes: int('MEDIA_MAX_BYTES', 5 * 1024 * 1024), // 5 MB
```

- [ ] **Step 3: Adicionar o volume de uploads ao `docker-compose.yml`**

No serviço `app`, acrescentar um bloco `volumes` e a env do diretório:
```yaml
  app:
    build: .
    ports:
      - "3001:3001"
    env_file:
      - .env.local
    environment:
      - UPLOADS_DIR=/app/uploads
    volumes:
      - uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy
      mailpit:
        condition: service_started
    restart: unless-stopped
```
E no bloco `volumes:` no fim do arquivo, adicionar `uploads:` ao lado de `pgdata:`:
```yaml
volumes:
  pgdata:
  uploads:
```

- [ ] **Step 4: Proxiar `/media` no Vite (dev)**

Em `vite.config.ts`, o `server.proxy` só cobre `/api`. As imagens são servidas em `/media/*` pelo Express; em dev o front roda no :5173. Adicionar:
```ts
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/media': 'http://localhost:3001',
    },
  },
```

- [ ] **Step 5: Ignorar o diretório de uploads de dev**

Em `.gitignore`, adicionar uma linha:
```
.uploads
```

- [ ] **Step 6: Verificar que o servidor ainda sobe**

Run: `npm run dev:server`
Expected: sobe sem erro de import/config; logs de migrations aparecem; `Server running on http://localhost:3001`. Encerrar com Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json server/core/config.ts docker-compose.yml vite.config.ts .gitignore
git commit -m "chore(media): deps (multer/sharp), config de uploads, volume Docker e proxy Vite"
```

---

## Task 1: Migration `004_media.sql`

**Files:**
- Create: `server/migrations/004_media.sql`

- [ ] **Step 1: Criar a migration**

Conteúdo de `server/migrations/004_media.sql` (segue o estilo de `001`–`003`; UUID via `gen_random_uuid()` — `pgcrypto` já é usado pelas migrations anteriores):
```sql
CREATE TABLE IF NOT EXISTS media (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename           text NOT NULL,
  original_name      text NOT NULL,
  mime_type          text NOT NULL,
  size_bytes         integer NOT NULL,
  width              integer NOT NULL,
  height             integer NOT NULL,
  thumbnail_filename text NOT NULL,
  uploaded_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_created_at ON media (created_at DESC);
```

> Se `gen_random_uuid()` falhar no boot, conferir se `001_auth_foundation.sql` já faz `CREATE EXTENSION IF NOT EXISTS pgcrypto;`. Se não houver extensão em lugar nenhum, adicionar `CREATE EXTENSION IF NOT EXISTS pgcrypto;` como primeira linha desta migration.

- [ ] **Step 2: Aplicar e verificar**

Run: `npm run dev:server`
Expected: log `[migrations] aplicada: 004_media.sql`. Confirmar a tabela (em outro terminal, com o Postgres do compose ativo ou o banco de dev):
```bash
psql "$DATABASE_URL" -c "\d media"
```
Expected: a tabela `media` existe com as colunas acima. Encerrar o servidor.

- [ ] **Step 3: Commit**

```bash
git add server/migrations/004_media.sql
git commit -m "feat(media): migration 004 — tabela media"
```

---

## Task 2: Permissão `media:manage`

**Files:**
- Modify: `server/seed/permissions.catalog.ts`

- [ ] **Step 1: Adicionar a permissão ao catálogo**

Em `server/seed/permissions.catalog.ts`, acrescentar uma linha ao array `PERMISSIONS`:
```ts
  { key: 'media:manage', description: 'Gerenciar biblioteca de mídia' },
```

- [ ] **Step 2: Verificar o religamento ao admin**

Run: `npm run dev:server`
Expected: o seed roda no boot e `linkAllPermissions` concede `media:manage` ao papel `admin`. Confirmar:
```bash
psql "$DATABASE_URL" -c "SELECT p.key FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN roles r ON r.id=rp.role_id WHERE r.key='admin' AND p.key='media:manage';"
```
Expected: retorna a linha `media:manage`. Encerrar o servidor.

- [ ] **Step 3: Commit**

```bash
git add server/seed/permissions.catalog.ts
git commit -m "feat(media): permissão media:manage no catálogo"
```

---

## Task 3: Helper de imagem `media.image.ts` (sharp)

**Files:**
- Create: `server/modules/media/media.image.ts`

Funções puras — sem estado, sem I/O de disco (recebem/retornam buffers). Validação por **conteúdo** (sharp lê o cabeçalho real, não a extensão).

- [ ] **Step 1: Implementar**

`server/modules/media/media.image.ts`:
```ts
import sharp from 'sharp'
import { BadRequestError } from '../../core/errors.js'

const ALLOWED = {
  jpeg: { ext: 'jpg', mime: 'image/jpeg' },
  png: { ext: 'png', mime: 'image/png' },
  webp: { ext: 'webp', mime: 'image/webp' },
} as const

export interface ProcessedImage {
  ext: string
  mime: string
  width: number
  height: number
  original: Buffer  // reencodado (sem EXIF/metadata)
  thumbnail: Buffer // WebP, lado maior ~400px
}

/**
 * Valida (magic bytes via sharp), reencoda descartando metadata e gera thumbnail.
 * Lança BadRequestError para formatos não suportados ou arquivo corrompido.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  let meta
  try {
    meta = await sharp(buffer).metadata()
  } catch {
    throw new BadRequestError('Arquivo de imagem inválido ou corrompido.')
  }

  const fmt = meta.format as keyof typeof ALLOWED | undefined
  if (!fmt || !(fmt in ALLOWED)) {
    throw new BadRequestError('Formato não suportado. Envie JPEG, PNG ou WebP.')
  }
  if (!meta.width || !meta.height) {
    throw new BadRequestError('Não foi possível ler as dimensões da imagem.')
  }

  const { ext, mime } = ALLOWED[fmt]

  // Reencode mantendo o formato; rotate() aplica orientação do EXIF e o pipeline
  // descarta o restante da metadata (não chamamos keepMetadata/withMetadata).
  const base = sharp(buffer).rotate()
  const original = await base.clone().toBuffer()
  const thumbnail = await base
    .clone()
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  return { ext, mime, width: meta.width, height: meta.height, original, thumbnail }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem erros nesse arquivo.

- [ ] **Step 3: Commit**

```bash
git add server/modules/media/media.image.ts
git commit -m "feat(media): helper de processamento de imagem (sharp)"
```

---

## Task 4: Helper de armazenamento `media.storage.ts`

**Files:**
- Create: `server/modules/media/media.storage.ts`

Wrapper fino sobre o filesystem; única parte que conhece `config.uploadsDir`. Sem estado (objeto de funções).

- [ ] **Step 1: Implementar**

`server/modules/media/media.storage.ts`:
```ts
import { promises as fs } from 'fs'
import { createReadStream } from 'fs'
import path from 'path'
import { config } from '../../core/config.js'

const MEDIA_DIR = path.join(config.uploadsDir, 'media')

async function ensureDir(): Promise<void> {
  await fs.mkdir(MEDIA_DIR, { recursive: true })
}

function pathFor(filename: string): string {
  // Defesa extra contra path traversal: filename é sempre gerado pelo servidor (uuid),
  // mas normalizamos e garantimos que o resultado fica dentro de MEDIA_DIR.
  const resolved = path.resolve(MEDIA_DIR, path.basename(filename))
  if (!resolved.startsWith(MEDIA_DIR)) throw new Error('Caminho de arquivo inválido.')
  return resolved
}

export const mediaStorage = {
  async save(filename: string, data: Buffer): Promise<void> {
    await ensureDir()
    await fs.writeFile(pathFor(filename), data)
  },
  absolutePath(filename: string): string {
    return pathFor(filename)
  },
  stream(filename: string) {
    return createReadStream(pathFor(filename))
  },
  async remove(filename: string): Promise<void> {
    await fs.rm(pathFor(filename), { force: true })
  },
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add server/modules/media/media.storage.ts
git commit -m "feat(media): wrapper de armazenamento em disco"
```

---

## Task 5: Repository `media.repository.ts`

**Files:**
- Create: `server/modules/media/media.repository.ts`

Único ponto com SQL da tabela `media`. Espelha o estilo de `user.repository.ts` (paginação por `limit/offset`, busca via `ILIKE`).

- [ ] **Step 1: Implementar**

`server/modules/media/media.repository.ts`:
```ts
import type { Pool } from 'pg'

export interface MediaRow {
  id: string
  filename: string
  original_name: string
  mime_type: string
  size_bytes: number
  width: number
  height: number
  thumbnail_filename: string
  uploaded_by: string | null
  created_at: Date
}

export interface CreateMediaInput {
  filename: string
  originalName: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  thumbnailFilename: string
  uploadedBy: string
}

export class MediaRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: CreateMediaInput): Promise<MediaRow> {
    const r = await this.pool.query<MediaRow>(
      `INSERT INTO media
         (filename, original_name, mime_type, size_bytes, width, height, thumbnail_filename, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [data.filename, data.originalName, data.mimeType, data.sizeBytes,
       data.width, data.height, data.thumbnailFilename, data.uploadedBy],
    )
    return r.rows[0]
  }

  async list(
    { limit, offset, q }: { limit: number; offset: number; q?: string },
  ): Promise<{ rows: MediaRow[]; total: number }> {
    const where = q ? `WHERE original_name ILIKE $3` : ''
    const params = q ? [limit, offset, `%${q}%`] : [limit, offset]
    const rows = await this.pool.query<MediaRow>(
      `SELECT * FROM media ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params,
    )
    const countParams = q ? [`%${q}%`] : []
    const count = await this.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM media ${q ? 'WHERE original_name ILIKE $1' : ''}`,
      countParams,
    )
    return { rows: rows.rows, total: count.rows[0].count }
  }

  async findById(id: string): Promise<MediaRow | null> {
    const r = await this.pool.query<MediaRow>('SELECT * FROM media WHERE id = $1', [id])
    return r.rows[0] ?? null
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM media WHERE id = $1', [id])
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add server/modules/media/media.repository.ts
git commit -m "feat(media): repository da tabela media"
```

---

## Task 6: DTOs

**Files:**
- Create: `server/modules/media/dto/media.dto.ts`

- [ ] **Step 1: Implementar**

`server/modules/media/dto/media.dto.ts`:
```ts
import { z } from 'zod'
import { paginationQuery } from '../../../core/pagination.js'

/** Query da listagem: paginação padrão + busca opcional por nome. */
export const listMediaQuery = paginationQuery.extend({
  q: z.string().trim().min(1).max(120).optional(),
})
export type ListMediaQuery = z.infer<typeof listMediaQuery>
```

- [ ] **Step 2: Commit**

```bash
git add server/modules/media/dto/media.dto.ts
git commit -m "feat(media): dto de listagem"
```

---

## Task 7: Service `media.service.ts`

**Files:**
- Create: `server/modules/media/media.service.ts`

Regra de negócio: orquestra processamento + storage + repo no upload; monta o envelope paginado; consulta os *usage checkers* na exclusão. Não conhece `req`/`res` nem SQL.

- [ ] **Step 1: Implementar**

`server/modules/media/media.service.ts`:
```ts
import { randomUUID } from 'crypto'
import { sanitize } from '../../lib/sanitize.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors.js'
import { paginate, toOffset, type Paginated } from '../../core/pagination.js'
import { processImage } from './media.image.js'
import { mediaStorage } from './media.storage.js'
import type { MediaRepository, MediaRow } from './media.repository.js'
import type { ListMediaQuery } from './dto/media.dto.js'

/** Retorna true se a mídia estiver em uso (bloqueia exclusão). Plugado por outros módulos. */
export type MediaUsageChecker = (mediaId: string) => Promise<boolean>

/** Forma pública (sem caminhos de disco crus além do necessário para montar URLs). */
export interface MediaDTO {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  url: string
  thumbnailUrl: string
  createdAt: Date
}

function toDTO(row: MediaRow): MediaDTO {
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    url: `/media/${row.id}`,
    thumbnailUrl: `/media/${row.id}/thumb`,
    createdAt: row.created_at,
  }
}

export class MediaService {
  constructor(
    private readonly repo: MediaRepository,
    private readonly usageCheckers: MediaUsageChecker[] = [],
  ) {}

  async upload(
    file: { buffer: Buffer; originalname: string } | undefined,
    userId: string,
  ): Promise<MediaDTO> {
    if (!file) throw new BadRequestError('Nenhum arquivo enviado.')

    const img = await processImage(file.buffer) // valida + reencoda + thumbnail

    const id = randomUUID()
    const filename = `${id}.${img.ext}`
    const thumbnailFilename = `${id}_thumb.webp`

    await mediaStorage.save(filename, img.original)
    await mediaStorage.save(thumbnailFilename, img.thumbnail)

    const originalName = sanitize(file.originalname).slice(0, 120) || 'imagem'

    const row = await this.repo.create({
      filename,
      originalName,
      mimeType: img.mime,
      sizeBytes: img.original.byteLength,
      width: img.width,
      height: img.height,
      thumbnailFilename,
      uploadedBy: userId,
    })
    return toDTO(row)
  }

  async list(params: ListMediaQuery): Promise<Paginated<MediaDTO>> {
    const { rows, total } = await this.repo.list({
      limit: params.limit,
      offset: toOffset(params),
      q: params.q,
    })
    return paginate(rows.map(toDTO), total, params)
  }

  async getRaw(id: string): Promise<MediaRow> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Mídia não encontrada.')
    return row
  }

  async delete(id: string): Promise<void> {
    const row = await this.repo.findById(id)
    if (!row) throw new NotFoundError('Mídia não encontrada.')

    for (const check of this.usageCheckers) {
      if (await check(id)) {
        throw new ConflictError('Imagem em uso e não pode ser removida.')
      }
    }

    await this.repo.delete(id)
    await mediaStorage.remove(row.filename)
    await mediaStorage.remove(row.thumbnail_filename)
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add server/modules/media/media.service.ts
git commit -m "feat(media): service (upload/list/delete) com usage checkers"
```

---

## Task 8: Controller `media.controller.ts`

**Files:**
- Create: `server/modules/media/media.controller.ts`

HTTP fino. Inclui os handlers públicos de servir arquivo (original + thumb), que fazem stream do disco com `Content-Type` e cache.

- [ ] **Step 1: Implementar**

`server/modules/media/media.controller.ts`:
```ts
import type { Request, Response } from 'express'
import { listMediaQuery } from './dto/media.dto.js'
import type { MediaService } from './media.service.js'
import { mediaStorage } from './media.storage.js'

export class MediaController {
  constructor(private readonly media: MediaService) {}

  upload = async (req: Request, res: Response) => {
    const dto = await this.media.upload(req.file, req.user!.id)
    res.status(201).json({ media: dto })
  }

  list = async (req: Request, res: Response) => {
    const params = listMediaQuery.parse(req.query)
    res.json(await this.media.list(params))
  }

  remove = async (req: Request, res: Response) => {
    await this.media.delete(String(req.params.id))
    res.status(204).end()
  }

  // --- Público (sem auth) ---

  serveOriginal = async (req: Request, res: Response) => {
    const row = await this.media.getRaw(String(req.params.id))
    res.type(row.mime_type)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.sendFile(mediaStorage.absolutePath(row.filename))
  }

  serveThumb = async (req: Request, res: Response) => {
    const row = await this.media.getRaw(String(req.params.id))
    res.type('image/webp')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.sendFile(mediaStorage.absolutePath(row.thumbnail_filename))
  }
}
```

> `req.file` é populado pelo `multer` (Task 9). `req.user!.id` vem do `requireAuth`. O `NotFoundError` lançado por `getRaw` é traduzido para 404 pelo `errorHandler` central.

- [ ] **Step 2: Type-check** — `npx tsc -p tsconfig.server.json --noEmit` → sem erros.

- [ ] **Step 3: Commit**

```bash
git add server/modules/media/media.controller.ts
git commit -m "feat(media): controller (admin + servir arquivos públicos)"
```

---

## Task 9: Rotas `media.routes.ts`

**Files:**
- Create: `server/modules/media/media.routes.ts`

Duas fábricas: rotas admin (multer + guards `media:manage` + CSRF nas mutações) e rotas públicas de arquivo.

- [ ] **Step 1: Implementar**

`server/modules/media/media.routes.ts`:
```ts
import { Router, type RequestHandler } from 'express'
import multer from 'multer'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import { config } from '../../core/config.js'
import type { MediaController } from './media.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.mediaMaxBytes, files: 1 },
})

/** Montado em /api/admin. Tudo exige media:manage; mutações exigem CSRF. */
export function makeMediaAdminRoutes(
  controller: MediaController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const manage = requirePermission('media:manage')
  r.get('/media', wrap(requireAuth), manage, wrap(controller.list))
  r.post('/media', wrap(requireAuth), manage, requireCsrf, upload.single('file'), wrap(controller.upload))
  r.delete('/media/:id', wrap(requireAuth), manage, requireCsrf, wrap(controller.remove))
  return r
}

/** Montado em /media. Público, sem auth: serve original e thumbnail. */
export function makeMediaPublicRoutes(controller: MediaController): Router {
  const r = Router()
  r.get('/:id', wrap(controller.serveOriginal))
  r.get('/:id/thumb', wrap(controller.serveThumb))
  return r
}
```

> **Erro do multer por tamanho:** quando o arquivo excede `mediaMaxBytes`, o multer chama `next(err)` com `err.code === 'LIMIT_FILE_SIZE'`. Tratar no `errorHandler` (Task 10, Step 3) para virar 400 com mensagem clara.

- [ ] **Step 2: Type-check** — `npx tsc -p tsconfig.server.json --noEmit` → sem erros.

- [ ] **Step 3: Commit**

```bash
git add server/modules/media/media.routes.ts
git commit -m "feat(media): rotas admin (multer+guards) e públicas de arquivo"
```

---

## Task 10: Composition root + montagem no servidor

**Files:**
- Modify: `server/container.ts`
- Modify: `server/index.ts`
- Modify: `server/core/error-handler.ts` (tratar erro de tamanho do multer)

- [ ] **Step 1: Instanciar no `container.ts`**

Adicionar os imports (no topo, junto aos demais módulos):
```ts
import { MediaRepository } from './modules/media/media.repository.js'
import { MediaService } from './modules/media/media.service.js'
import { MediaController } from './modules/media/media.controller.js'
import { makeMediaAdminRoutes, makeMediaPublicRoutes } from './modules/media/media.routes.js'
```
Depois do bloco de settings (antes do `setEmailConfigProvider`), instanciar e exportar:
```ts
// --- Biblioteca de mídia (US-17) ---
const mediaRepo = new MediaRepository(pool)
const mediaService = new MediaService(mediaRepo, []) // usage checkers: vazio por ora (editor pluga depois)
const mediaController = new MediaController(mediaService)

export const mediaAdminRoutes = makeMediaAdminRoutes(mediaController, requireAuth, requirePermission)
export const mediaPublicRoutes = makeMediaPublicRoutes(mediaController)
```

- [ ] **Step 2: Montar em `server/index.ts`**

No import do `./container.js`, acrescentar `mediaAdminRoutes, mediaPublicRoutes`:
```ts
import {
  authRoutes, roleRoutes, invitationAdminRoutes, invitationPublicRoutes, settingsRoutes, userRoutes,
  mediaAdminRoutes, mediaPublicRoutes, bootstrap,
} from './container.js'
```
Registrar a rota admin junto às outras `/api/admin`:
```ts
app.use('/api/admin', mediaAdminRoutes)
```
Registrar a rota pública `/media` **antes** do bloco de static/SPA fallback (que só existe em produção) e fora de `/api`:
```ts
app.use('/media', mediaPublicRoutes)

// --- Static files (production) ---
if (process.env.NODE_ENV === 'production') {
  ...
}
```

- [ ] **Step 3: Tratar `LIMIT_FILE_SIZE` no `error-handler.ts`**

Ler `server/core/error-handler.ts` e, antes do fallback genérico (e antes de tratar `AppError`), adicionar:
```ts
import { MulterError } from 'multer'
// ...dentro do handler:
if (err instanceof MulterError) {
  const msg = err.code === 'LIMIT_FILE_SIZE'
    ? 'Arquivo muito grande. Tamanho máximo: 5 MB.'
    : 'Falha no upload do arquivo.'
  res.status(400).json({ error: msg })
  return
}
```
(Adaptar ao formato de resposta de erro já usado no arquivo — manter a mesma chave/shape das outras respostas.)

- [ ] **Step 4: Verificação end-to-end via curl**

Subir o servidor: `npm run dev:server` (garantir Postgres de dev no ar). Em outro terminal:
```bash
# 1) Login (ajuste e-mail/senha do seed) guardando cookies + capturando CSRF
curl -s -c /tmp/cj.txt -b /tmp/cj.txt http://localhost:3001/api/auth/csrf >/dev/null
CSRF=$(grep csrf_token /tmp/cj.txt | awk '{print $7}')
curl -s -c /tmp/cj.txt -b /tmp/cj.txt -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"SEED_ADMIN_EMAIL","password":"SEED_ADMIN_PASSWORD"}' \
  http://localhost:3001/api/auth/login | head -c 200; echo

# 2) Upload de uma imagem real
curl -s -b /tmp/cj.txt -H "X-CSRF-Token: $CSRF" \
  -F "file=@/caminho/para/foto.jpg" http://localhost:3001/api/admin/media | tee /tmp/up.json; echo

# 3) Listar
curl -s -b /tmp/cj.txt "http://localhost:3001/api/admin/media?page=1&limit=20" | head -c 400; echo

# 4) Servir público (sem cookies) — original e thumb
ID=$(grep -o '"id":"[^"]*"' /tmp/up.json | head -1 | cut -d'"' -f4)
curl -s -o /tmp/orig.bin -w "original: %{http_code} %{content_type}\n" http://localhost:3001/media/$ID
curl -s -o /tmp/thumb.bin -w "thumb:    %{http_code} %{content_type}\n" http://localhost:3001/media/$ID/thumb

# 5) Rejeição: não-imagem e arquivo grande
curl -s -b /tmp/cj.txt -H "X-CSRF-Token: $CSRF" -F "file=@/etc/hostname" http://localhost:3001/api/admin/media; echo

# 6) Excluir
curl -s -b /tmp/cj.txt -H "X-CSRF-Token: $CSRF" -X DELETE -w "delete: %{http_code}\n" http://localhost:3001/api/admin/media/$ID
```
Expected: upload → 201 com `media.id/url/thumbnailUrl`; lista → envelope `{ data, pagination }`; `/media/:id` → 200 `image/jpeg` (ou webp), `/thumb` → 200 `image/webp`; não-imagem → 400 "Formato não suportado"; delete → 204. Conferir que os arquivos sumiram de `.uploads/media/`.

- [ ] **Step 5: Commit**

```bash
git add server/container.ts server/index.ts server/core/error-handler.ts
git commit -m "feat(media): wiring no container, montagem das rotas e erro de upload"
```

---

## Task 11: Frontend — client de upload + fix de FormData

**Files:**
- Modify: `src/auth/api-core.ts`
- Create: `src/painel/media-api.ts`

- [ ] **Step 1: Não forçar `Content-Type: application/json` em FormData**

Em `src/auth/api-core.ts`, dentro de `rawFetch`, a linha que seta o content-type quebra uploads multipart (o browser precisa definir o boundary). Ajustar a condição para ignorar `FormData`:
```ts
    if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }
```
(O header `X-CSRF-Token` continua sendo adicionado normalmente para POST/DELETE — necessário para as rotas de mídia.)

- [ ] **Step 2: Criar tipos + helpers de mídia**

`src/painel/media-api.ts`:
```ts
import { adminFetch } from '@/painel/admin-api'

export interface MediaItem {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  url: string
  thumbnailUrl: string
  createdAt: string
}

export interface PageInfo { page: number; limit: number; total: number; totalPages: number }

export async function listMedia(page: number, limit: number, q: string): Promise<{ data: MediaItem[]; pagination: PageInfo }> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) qs.set('q', q)
  const res = await adminFetch(`/media?${qs.toString()}`)
  if (!res.ok) throw new Error('Falha ao listar mídia.')
  return res.json()
}

export async function uploadMedia(file: File): Promise<MediaItem> {
  const form = new FormData()
  form.append('file', file)
  const res = await adminFetch('/media', { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Falha no upload.')
  }
  return (await res.json()).media
}

export async function deleteMedia(id: string): Promise<void> {
  const res = await adminFetch(`/media/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Falha ao excluir.')
  }
}
```

- [ ] **Step 3: Type-check do frontend**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: sem erros nos arquivos novos/alterados.

- [ ] **Step 4: Commit**

```bash
git add src/auth/api-core.ts src/painel/media-api.ts
git commit -m "feat(media): client de upload no front + fix de FormData no api-core"
```

---

## Task 12: Frontend — página `/painel/midia`

**Files:**
- Create: `src/painel/pages/Midia.tsx`

Grade de miniaturas (mais recentes primeiro), busca com debounce, paginação, modal de upload e confirmação de exclusão. Só kit de UI.

- [ ] **Step 1: Implementar**

`src/painel/pages/Midia.tsx`:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureCsrf } from '@/auth/auth-api'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import { listMedia, uploadMedia, deleteMedia, type MediaItem } from '@/painel/media-api'
import { PageHeader, Button, Card, Field, Input, EmptyState, Modal, Pager } from '@/painel/ui'

export default function Midia() {
  const { page, limit, setPage } = usePagination()
  const [items, setItems] = useState<MediaItem[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [q, setQ] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [toDelete, setToDelete] = useState<MediaItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    await ensureCsrf()
    try {
      const body = await listMedia(page, limit, q)
      setItems(body.data)
      setInfo(body.pagination)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [page, limit, q])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biblioteca de mídia"
        actions={<Button onClick={() => setUploadOpen(true)}>Enviar imagem</Button>}
      />

      <Field label="Buscar por nome">
        <Input value={q} onChange={e => { setPage(1); setQ(e.target.value) }} placeholder="Nome do arquivo…" />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <EmptyState title="Nenhuma imagem" description="Envie a primeira imagem para começar." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map(m => (
            <Card key={m.id} className="p-2 space-y-2">
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                <img src={m.thumbnailUrl} alt={m.originalName} loading="lazy"
                  className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-gray-600 truncate" title={m.originalName}>{m.originalName}</p>
              <button onClick={() => setToDelete(m)}
                className="text-xs text-red-600 hover:underline">Excluir</button>
            </Card>
          ))}
        </div>
      )}

      {info && <Pager info={info} onPage={setPage} />}

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onDone={() => { setUploadOpen(false); setPage(1); load() }}
        />
      )}

      {toDelete && (
        <Modal title="Excluir imagem" onClose={() => setToDelete(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Remover <strong>{toDelete.originalName}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={async () => {
              try { await deleteMedia(toDelete.id); setToDelete(null); load() }
              catch (e) { setError((e as Error).message); setToDelete(null) }
            }}>Excluir</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handle(file: File | undefined) {
    if (!file) return
    if (!ACCEPT.includes(file.type)) { setErr('Tipo não suportado. Use JPEG, PNG ou WebP.'); return }
    if (file.size > MAX_BYTES) { setErr('Arquivo muito grande (máx. 5 MB).'); return }
    setErr(null); setBusy(true)
    try { await uploadMedia(file); onDone() }
    catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <Modal title="Enviar imagem" onClose={onClose}>
      <div className="space-y-4">
        <input ref={inputRef} type="file" accept={ACCEPT.join(',')} disabled={busy}
          onChange={e => handle(e.target.files?.[0])}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0
            file:bg-iasd-accent file:px-4 file:py-2 file:text-white file:font-medium" />
        <p className="text-xs text-gray-500">JPEG, PNG ou WebP · máximo 5 MB.</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {busy && <p className="text-sm text-gray-500">Enviando…</p>}
      </div>
    </Modal>
  )
}
```

> **Conferir as props reais do kit** antes de finalizar: `Field`/`Input` (assinatura em `src/painel/ui/Field.tsx`), `Card` (aceita `className`/`children`? ver `src/painel/ui/Card.tsx`), `Button` (`variant`/`onClick`/`to` — ver `src/painel/ui/Button.tsx`; se não existir `variant="danger"`/`"secondary"`, usar as variantes que existirem), `EmptyState` (`title`/`description`). Ajustar nomes de props ao que o kit expõe — **não** inventar classes Tailwind soltas fora do kit.

- [ ] **Step 2: Type-check** — `npx tsc -p tsconfig.json --noEmit` → sem erros (corrigir props conforme o kit real).

- [ ] **Step 3: Commit**

```bash
git add src/painel/pages/Midia.tsx
git commit -m "feat(media): página /painel/midia (grade, busca, upload, exclusão)"
```

---

## Task 13: Frontend — rota e item de menu

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/painel/nav-config.tsx`

- [ ] **Step 1: Registrar a rota protegida por permissão**

Em `src/App.tsx`, importar a página e adicionar a rota dentro do bloco `/painel` (antes do `path="*"`):
```tsx
import Midia from './painel/pages/Midia'
// ...
<Route path="midia" element={<RequirePermission perm="media:manage"><Midia /></RequirePermission>} />
```

- [ ] **Step 2: Adicionar o item de menu**

Em `src/painel/nav-config.tsx`, adicionar um path de ícone ao objeto `I` (ex.: ícone de imagem):
```ts
  image: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6',
```
E inserir uma entrada no array `NAV` (leaf, visível só com a permissão):
```ts
  { key: 'midia', label: 'Mídia', icon: icon(I.image), to: '/painel/midia', perm: 'media:manage' },
```

- [ ] **Step 3: Verificação no browser**

Run (dois terminais): `npm run dev:server` e `npm run dev`. Abrir `http://localhost:5173`, logar como admin e:
- O item **Mídia** aparece no menu lateral.
- Em `/painel/midia`: enviar JPEG/PNG/WebP → miniatura aparece na grade.
- Enviar `.txt`/`.svg`/arquivo > 5 MB → mensagem de erro clara, sem item criado.
- Buscar por nome filtra a grade; paginação navega (se houver itens suficientes).
- Excluir pede confirmação e remove o item.
- A imagem abre direto pela URL pública (`/media/:id`) numa aba anônima (sem login).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/painel/nav-config.tsx
git commit -m "feat(media): rota /painel/midia e item de menu (perm media:manage)"
```

---

## Task 14: Verificação no Docker (volume + sharp)

**Files:** nenhum (a menos que surjam correções).

- [ ] **Step 1: Build e subida**

Run: `docker compose up --build`
Expected: a imagem builda (o `sharp` baixa o binário linux-musl no `npm ci`); o app sobe; migrations + seed rodam; sem erro de `Cannot find module 'sharp'` no runtime.

- [ ] **Step 2: Upload + persistência no volume**

Pela UI (`http://localhost:3001/painel/midia`), enviar uma imagem. Depois:
```bash
docker compose restart app
```
Expected: após o restart, a imagem **continua** na grade e abre pela URL pública — confirma que o volume `uploads` persiste os arquivos e a tabela `media` persiste a metadata.

- [ ] **Step 3: (Se necessário) corrigir e commitar**

Se o `sharp` falhar no Alpine, conferir versão (`sharp` ≥ 0.33 traz binários musl) e, se preciso, documentar no plano/Dockerfile. Commitar qualquer ajuste:
```bash
git add -A
git commit -m "fix(media): ajustes para sharp/volume no Docker"
```

---

## Resumo da Definição de Pronto (US-17)

- [ ] Upload com validação por **conteúdo** (magic bytes via sharp) + reencode + thumbnail. *(Tasks 3, 7, 9, 10)*
- [ ] Listagem em grade com busca por nome, paginada, mais recentes primeiro. *(Tasks 5, 7, 12)*
- [ ] Arquivos em volume Docker + metadata em `media`; permissão `media:manage` exigida. *(Tasks 0, 1, 2, 9, 14)*
- [ ] Exclusão com confirmação; gancho de **usage checkers** pronto (vazio) para o editor plugar. *(Tasks 7, 10, 12)*
- [ ] Rotas públicas de servir imagem (original + thumb) para uso futuro em US-19. *(Tasks 8, 9, 10)*
- [ ] Página `/painel/midia` no kit de UI; item no menu lateral conforme permissão. *(Tasks 12, 13)*

## Notas de risco (do spec review)
- **sharp no Docker:** imagem multi-stage que copia `node_modules` do stage `deps` para o `runner`; o binário musl do sharp precisa estar presente no final (Task 14 valida).
- **Ordem de rotas:** `/media` deve ser registrada antes do fallback da SPA e fora de `/api` (Task 10).
- **CSRF + FormData:** upload é POST mutante → precisa do header CSRF (já automático no `adminFetch`) e do fix para não setar `Content-Type: application/json` em FormData (Task 11).
