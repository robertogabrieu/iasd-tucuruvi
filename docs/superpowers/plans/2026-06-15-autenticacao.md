# Épico de Autenticação — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o backend de autenticação da área administrativa (login, sessão com refresh rotativo, recuperação de senha, anti-força-bruta, seed inicial) mais as telas React mínimas de auth, como um vertical slice clicável.

**Architecture:** Express + Postgres em arquitetura por camadas (`routes → controller → service → repository → db`), com os 4 design patterns do `CLAUDE.md` (Repository, Service Layer, DI por construtor num composition root, hierarquia de erros + handler central). JWT de access via `jose`; refresh token opaco rotativo guardado como hash; CSRF double-submit; argon2id para senha. Frontend React (Vite + React Router v7) com `AuthContext` e wrapper de fetch.

**Tech Stack:** TypeScript ESM, Express 5, `pg`, `argon2`, `jose`, `cookie-parser`, Zod, React 18, React Hook Form.

**Spec de referência:** `docs/superpowers/specs/2026-06-14-autenticacao-design.md`

**Convenção de validação:** o projeto **não tem suíte de testes automatizada** (decisão do `CLAUDE.md` / memória do usuário). Cada task termina com **validação manual** (curl / browser / Mailpit / inspeção no Postgres) e um commit. Não criar arquivos de teste.

**Convenção ESM (obrigatória):** `"type": "module"` no projeto → todo import interno do backend usa sufixo `.js` mesmo apontando para `.ts` (ex.: `import { config } from '../core/config.js'`). Sem isso o build/run quebra.

---

## Mapa de arquivos

**Backend (novos):**
- `server/core/config.ts` — leitura/validação de env (segredos, TTLs, params brute-force, política senha).
- `server/core/db.ts` — pool `pg` + runner de migrations + helper `query`.
- `server/core/errors.ts` — hierarquia `AppError`.
- `server/core/error-handler.ts` — middleware central de erro.
- `server/core/security/password.ts` — value object `Password` (política + argon2id).
- `server/core/security/token.service.ts` — `TokenService` (JWT access via jose; geração/hash de token opaco).
- `server/core/security/csrf.ts` — emissão/validação de token CSRF double-submit.
- `server/migrations/001_auth_foundation.sql` — schema completo da fundação.
- `server/modules/users/user.repository.ts` — SQL de `users`.
- `server/modules/roles/role.repository.ts` — SQL mínimo de `roles`/`permissions` (consumido pelo seed).
- `server/modules/tokens/refresh-token.repository.ts` — SQL de `refresh_tokens`.
- `server/modules/tokens/password-reset.repository.ts` — SQL de `password_reset_tokens`.
- `server/modules/auth/dto/auth.dto.ts` — schemas Zod de entrada.
- `server/modules/auth/auth.service.ts` — regra de negócio (login, refresh, logout, me, forgot, reset, brute-force).
- `server/modules/auth/auth.controller.ts` — HTTP fino (valida DTO, chama service, seta cookies).
- `server/modules/auth/auth.cookies.ts` — helpers de set/clear de cookies de sessão + CSRF.
- `server/modules/auth/middleware/require-auth.ts` — valida access JWT.
- `server/modules/auth/middleware/require-csrf.ts` — valida double-submit.
- `server/modules/auth/auth.routes.ts` — liga rotas → controller + middlewares.
- `server/seed/permissions.catalog.ts` — catálogo versionado de permissões.
- `server/seed/seed.ts` — seed idempotente (permissões + role admin + 1º usuário).
- `server/mail/auth-mail.ts` — envio do e-mail de reset (reusa `transporter`).
- `server/container.ts` — composition root (instancia repos → services → controller → router; expõe `runMigrations`+`runSeed`).
- `server/types/express.d.ts` — augmenta `Express.Request` com `user`.

**Backend (modificados):**
- `server/index.ts` — `cookie-parser`, montar `/api/auth`, boot (migrations+seed), error-handler por último.
- `package.json` — deps novas + `cp` das migrations no build.
- `Dockerfile` — toolchain de build para o addon nativo do `argon2`.
- `.env.example` — variáveis novas (defaults de brute-force, cookie, base URL, reset TTL).

**Frontend (novos):**
- `src/auth/auth-api.ts` — wrapper `apiFetch` (CSRF header + auto-refresh em 401).
- `src/auth/AuthContext.tsx` — provider de sessão (`user`, `login`, `logout`).
- `src/auth/ProtectedRoute.tsx` — redireciona para `/login` sem sessão.
- `src/schemas/auth.ts` — schemas Zod do frontend (espelham o server).
- `src/pages/Login.tsx`, `src/pages/EsqueciSenha.tsx`, `src/pages/RedefinirSenha.tsx`, `src/pages/Painel.tsx`.

**Frontend (modificados):**
- `src/App.tsx` — `AuthProvider`, layout público vs. rotas de auth, rotas novas.

---

## Task 1: Dependências, Dockerfile e env

**Files:**
- Modify: `package.json`
- Modify: `Dockerfile`
- Modify: `.env.example`

- [ ] **Step 1: Instalar dependências**

```bash
npm install pg argon2 jose cookie-parser
npm install -D @types/pg @types/cookie-parser
```

- [ ] **Step 2: Ajustar o script de build para copiar as migrations**

Em `package.json`, trocar o script `build` (o `tsc` não copia `.sql`):

```json
"build": "vite build && tsc -p tsconfig.server.json && cp -r server/migrations dist-server/migrations",
```

- [ ] **Step 3: Toolchain do argon2 no Dockerfile**

O `argon2` compila addon nativo (node-gyp). Em `node:20-alpine` falta toolchain — adicionar na stage `deps` (e remover depois para não inchar a imagem). Substituir a stage `deps`:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
RUN apk del .build-deps
```

- [ ] **Step 4: Variáveis novas no `.env.example`**

Acrescentar ao final de `.env.example`:

```bash
# --- Cookies / App ---
# Em produção (HTTPS) use COOKIE_SECURE=true. Em dev (HTTP localhost) deixe false.
COOKIE_SECURE=false
# Base URL usada no link de redefinição de senha enviado por e-mail.
APP_BASE_URL=http://localhost:5173

# --- Recuperação de senha ---
PASSWORD_RESET_TTL_MIN=30

# --- Anti força-bruta (defaults; ajustáveis) ---
LOGIN_RATE_MAX=10
LOGIN_RATE_WINDOW_MS=300000
LOCKOUT_THRESHOLD=5
FORGOT_RATE_MAX=3
FORGOT_RATE_WINDOW_MS=900000
```

- [ ] **Step 5: Validação manual**

```bash
npm ls pg argon2 jose cookie-parser   # devem aparecer instalados
node -e "require('argon2').hash('x').then(h=>console.log('argon2 ok', h.slice(0,15)))"
```
Esperado: `argon2 ok $argon2id$...` (confirma que o addon nativo compilou).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json Dockerfile .env.example
git commit -m "build(auth): deps (pg/argon2/jose/cookie-parser) + env e Dockerfile para auth"
```

---

## Task 2: Config central (`core/config.ts`)

**Files:**
- Create: `server/core/config.ts`

- [ ] **Step 1: Escrever o módulo de config**

```typescript
// server/core/config.ts
function req(name: string): string {
  const v = process.env[name]
  if (!v && process.env.NODE_ENV === 'production') {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`)
  }
  return v ?? ''
}

function int(name: string, fallback: number): number {
  const v = process.env[name]
  return v ? Number(v) : fallback
}

export const config = {
  databaseUrl: req('DATABASE_URL'),

  jwtAccessSecret: req('JWT_ACCESS_SECRET') || 'dev-access-secret-trocar',
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  // JWT_REFRESH_SECRET existe no .env mas NÃO é usado: o refresh token é opaco (hash sha256),
  // não um JWT. Ver spec §11.

  csrfSecret: req('CSRF_SECRET') || 'dev-csrf-secret-trocar',

  cookieSecure: process.env.COOKIE_SECURE === 'true',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',

  passwordResetTtlMin: int('PASSWORD_RESET_TTL_MIN', 30),

  loginRateMax: int('LOGIN_RATE_MAX', 10),
  loginRateWindowMs: int('LOGIN_RATE_WINDOW_MS', 300_000),
  forgotRateMax: int('FORGOT_RATE_MAX', 3),
  forgotRateWindowMs: int('FORGOT_RATE_WINDOW_MS', 900_000),

  lockoutThreshold: int('LOCKOUT_THRESHOLD', 5),
  // Backoff progressivo do lockout por conta (ms), indexado por lock_cycle_count (cap no último).
  lockoutBackoffMs: [60_000, 300_000, 900_000, 3_600_000],

  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || '',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || '',
}

// Converte "15m" / "7d" / "30s" / "12h" para milissegundos (para Max-Age de cookie).
export function durationToMs(d: string): number {
  const m = /^(\d+)([smhd])$/.exec(d.trim())
  if (!m) throw new Error(`Duração inválida: ${d}`)
  const n = Number(m[1])
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd']
  return n * unit
}
```

- [ ] **Step 2: Validação manual**

```bash
npx tsx -e "import('./server/core/config.ts').then(m=>console.log(m.config.jwtAccessTtl, m.durationToMs('15m'), m.durationToMs('7d')))"
```
Esperado: `15m 900000 604800000`.

- [ ] **Step 3: Commit**

```bash
git add server/core/config.ts
git commit -m "feat(auth): config central de env (TTLs, brute-force, cookies)"
```

---

## Task 3: Erros e handler central

**Files:**
- Create: `server/core/errors.ts`
- Create: `server/core/error-handler.ts`

- [ ] **Step 1: Hierarquia de erros**

```typescript
// server/core/errors.ts
export abstract class AppError extends Error {
  abstract readonly status: number
  readonly expose = true // mensagem segura para o cliente
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class BadRequestError extends AppError { readonly status = 400 }
export class UnauthorizedError extends AppError { readonly status = 401 }
export class ForbiddenError extends AppError { readonly status = 403 }
export class NotFoundError extends AppError { readonly status = 404 }
export class ConflictError extends AppError { readonly status = 409 }
export class TooManyRequestsError extends AppError { readonly status = 429 }

export class ValidationError extends AppError {
  readonly status = 422
  constructor(message: string, readonly details?: unknown) { super(message) }
}
```

- [ ] **Step 2: Handler central**

```typescript
// server/core/error-handler.ts
import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError, ValidationError } from './errors.js'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    res.status(422).json({ error: err.message, details: err.details })
    return
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Dados inválidos.', details: err.flatten().fieldErrors })
    return
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error('[unhandled]', err)
  res.status(500).json({ error: 'Erro interno.' })
}
```

- [ ] **Step 3: Validação manual**

```bash
npx tsx -e "import('./server/core/errors.ts').then(m=>{const e=new m.UnauthorizedError('x'); console.log(e.status, e instanceof m.AppError)})"
```
Esperado: `401 true`.

- [ ] **Step 4: Commit**

```bash
git add server/core/errors.ts server/core/error-handler.ts
git commit -m "feat(auth): hierarquia de erros + handler central"
```

---

## Task 4: Banco — pool, runner de migrations e schema

**Files:**
- Create: `server/core/db.ts`
- Create: `server/migrations/001_auth_foundation.sql`

- [ ] **Step 1: Migration de fundação**

```sql
-- server/migrations/001_auth_foundation.sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              citext UNIQUE NOT NULL,
  password_hash      text NOT NULL,
  name               text NOT NULL,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  failed_login_count int  NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  lock_cycle_count   int  NOT NULL DEFAULT 0,
  last_login_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text UNIQUE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   uuid NOT NULL,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  replaced_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user   ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_hash   ON refresh_tokens(token_hash);

CREATE TABLE password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id);
```

- [ ] **Step 2: Pool + runner**

```typescript
// server/core/db.ts
import pg from 'pg'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const pool = new pg.Pool({ connectionString: config.databaseUrl })

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params as any[])
}

// Em dev (tsx): __dirname = server/core → ../migrations = server/migrations
// Em prod: __dirname = dist-server/core → ../migrations = dist-server/migrations (copiado no build)
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations')

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  const files = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort()
  const applied = new Set(
    (await pool.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map(r => r.version),
  )
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`[migrations] aplicada: ${file}`)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}
```

- [ ] **Step 3: Validação manual (precisa do Postgres rodando)**

```bash
docker compose up -d db          # sobe só o Postgres
# garanta DATABASE_URL apontando para localhost:5432 no shell, ex.:
export DATABASE_URL=postgres://iasd:changeme@localhost:5432/iasd
npx tsx -e "import('./server/core/db.ts').then(async m=>{await m.runMigrations(); const r=await m.query('SELECT count(*) FROM users'); console.log('users table ok', r.rows[0]); process.exit(0)})"
```
Esperado: `[migrations] aplicada: 001_auth_foundation.sql` e `users table ok { count: '0' }`. Rodar de novo **não** deve reaplicar (sem linha `aplicada`).

- [ ] **Step 4: Commit**

```bash
git add server/core/db.ts server/migrations/001_auth_foundation.sql
git commit -m "feat(auth): pool pg + runner de migrations + schema de fundação"
```

---

## Task 5: Value object `Password` (argon2id + política)

**Files:**
- Create: `server/core/security/password.ts`

- [ ] **Step 1: Implementar**

```typescript
// server/core/security/password.ts
import argon2 from 'argon2'
import { ValidationError } from '../errors.js'

// Política (decisão do brainstorming): mín. 8 chars + >=1 maiúscula, >=1 número, >=1 símbolo.
// Nota: NIST 800-63B prefere comprimento a composição; mantido por escolha do usuário.
const MIN_LENGTH = 8

export function validatePasswordPolicy(plain: string): void {
  const errors: string[] = []
  if (plain.length < MIN_LENGTH) errors.push(`mínimo de ${MIN_LENGTH} caracteres`)
  if (!/[A-Z]/.test(plain)) errors.push('uma letra maiúscula')
  if (!/[0-9]/.test(plain)) errors.push('um número')
  if (!/[^A-Za-z0-9]/.test(plain)) errors.push('um símbolo')
  if (errors.length) {
    throw new ValidationError(`A senha deve conter: ${errors.join(', ')}.`)
  }
}

export class Password {
  private constructor(private readonly plain: string) {}

  /** Valida a política e cria o value object (lança ValidationError 422 se inválida). */
  static create(plain: string): Password {
    validatePasswordPolicy(plain)
    return new Password(plain)
  }

  hash(): Promise<string> {
    return argon2.hash(this.plain, { type: argon2.argon2id })
  }

  static verify(plain: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plain).catch(() => false)
  }
}
```

- [ ] **Step 2: Validação manual**

```bash
npx tsx -e "import('./server/core/security/password.ts').then(async m=>{
  try { m.Password.create('weak') } catch(e){ console.log('rejeitou fraca:', e.message) }
  const h = await m.Password.create('Forte#123').hash()
  console.log('hash ok:', h.startsWith('\$argon2id'))
  console.log('verify ok:', await m.Password.verify('Forte#123', h))
  console.log('verify errada:', await m.Password.verify('outra', h))
})"
```
Esperado: rejeita `weak` (422), `hash ok: true`, `verify ok: true`, `verify errada: false`.

- [ ] **Step 3: Commit**

```bash
git add server/core/security/password.ts
git commit -m "feat(auth): value object Password com política + argon2id"
```

---

## Task 6: `TokenService` (JWT access + token opaco)

**Files:**
- Create: `server/core/security/token.service.ts`

> **Nota de arquitetura:** o `TokenService` cuida só de **cripto** (emitir/validar JWT, gerar e hashear token opaco). A **orquestração** de rotação e detecção de reuso (que toca o banco) fica no `auth.service`, respeitando "service nunca executa SQL; repository isola SQL". Refina a redação da spec §4 sem mudar o comportamento.

- [ ] **Step 1: Implementar**

```typescript
// server/core/security/token.service.ts
import { SignJWT, jwtVerify } from 'jose'
import { randomBytes, createHash } from 'node:crypto'

export class TokenService {
  private readonly accessKey: Uint8Array

  constructor(
    accessSecret: string,
    private readonly accessTtl: string, // ex.: "15m"
  ) {
    this.accessKey = new TextEncoder().encode(accessSecret)
  }

  async issueAccessToken(userId: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(this.accessTtl)
      .sign(this.accessKey)
  }

  /** Retorna o userId (sub) ou lança se inválido/expirado. */
  async verifyAccessToken(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, this.accessKey)
    if (!payload.sub) throw new Error('sub ausente')
    return payload.sub
  }

  /** Gera um refresh token opaco e seu hash (só o hash vai pro banco). */
  generateOpaqueToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url')
    return { token, hash: this.hashToken(token) }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
```

- [ ] **Step 2: Validação manual**

```bash
npx tsx -e "import('./server/core/security/token.service.ts').then(async m=>{
  const ts = new m.TokenService('secret-de-teste-bem-grande-123456', '15m')
  const jwt = await ts.issueAccessToken('user-1')
  console.log('sub:', await ts.verifyAccessToken(jwt))
  const t = ts.generateOpaqueToken()
  console.log('hash bate:', ts.hashToken(t.token) === t.hash)
  try { await ts.verifyAccessToken('lixo') } catch { console.log('rejeitou jwt inválido') }
})"
```
Esperado: `sub: user-1`, `hash bate: true`, `rejeitou jwt inválido`.

- [ ] **Step 3: Commit**

```bash
git add server/core/security/token.service.ts
git commit -m "feat(auth): TokenService (JWT access via jose + token opaco hashado)"
```

---

## Task 7: CSRF (double-submit) + middleware

**Files:**
- Create: `server/core/security/csrf.ts`
- Create: `server/modules/auth/middleware/require-csrf.ts`

- [ ] **Step 1: Serviço de CSRF**

```typescript
// server/core/security/csrf.ts
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

function sign(value: string): string {
  return createHmac('sha256', config.csrfSecret).update(value).digest('base64url')
}

/** Token = "<valor>.<assinatura>". Vai no cookie (lido pelo JS) e no header X-CSRF-Token. */
export function issueCsrfToken(): string {
  const value = randomBytes(18).toString('base64url')
  return `${value}.${sign(value)}`
}

export function isValidCsrfToken(token: string | undefined): boolean {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot < 0) return false
  const value = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(value)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function tokensMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}
```

- [ ] **Step 2: Middleware de CSRF**

```typescript
// server/modules/auth/middleware/require-csrf.ts
import type { RequestHandler } from 'express'
import { ForbiddenError } from '../../../core/errors.js'
import { isValidCsrfToken, tokensMatch } from '../../../core/security/csrf.js'

// Double-submit: header X-CSRF-Token deve existir, ser válido (assinatura) e igual ao cookie.
export const requireCsrf: RequestHandler = (req, _res, next) => {
  const header = req.get('x-csrf-token') ?? undefined
  const cookie = req.cookies?.csrf_token as string | undefined
  if (!isValidCsrfToken(header) || !tokensMatch(header, cookie)) {
    throw new ForbiddenError('Token CSRF inválido.')
  }
  next()
}
```

- [ ] **Step 3: Validação manual**

```bash
npx tsx -e "import('./server/core/security/csrf.ts').then(m=>{
  const t = m.issueCsrfToken()
  console.log('valido:', m.isValidCsrfToken(t))
  console.log('match:', m.tokensMatch(t,t))
  console.log('forjado:', m.isValidCsrfToken('abc.def'))
})"
```
Esperado: `valido: true`, `match: true`, `forjado: false`.

- [ ] **Step 4: Commit**

```bash
git add server/core/security/csrf.ts server/modules/auth/middleware/require-csrf.ts
git commit -m "feat(auth): CSRF double-submit (HMAC) + middleware requireCsrf"
```

---

## Task 8: Repositórios (users, roles, refresh, reset)

**Files:**
- Create: `server/modules/users/user.repository.ts`
- Create: `server/modules/roles/role.repository.ts`
- Create: `server/modules/tokens/refresh-token.repository.ts`
- Create: `server/modules/tokens/password-reset.repository.ts`

- [ ] **Step 1: `user.repository.ts`**

```typescript
// server/modules/users/user.repository.ts
import type { Pool } from 'pg'

export interface UserRow {
  id: string
  email: string
  password_hash: string
  name: string
  status: 'active' | 'disabled'
  failed_login_count: number
  locked_until: Date | null
  lock_cycle_count: number
  last_login_at: Date | null
}

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const r = await this.pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email])
    return r.rows[0] ?? null
  }

  async findById(id: string): Promise<UserRow | null> {
    const r = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id])
    return r.rows[0] ?? null
  }

  async countUsers(): Promise<number> {
    const r = await this.pool.query<{ count: string }>('SELECT count(*)::int AS count FROM users')
    return Number(r.rows[0].count)
  }

  async create(data: { email: string; name: string; passwordHash: string }): Promise<UserRow> {
    const r = await this.pool.query<UserRow>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *`,
      [data.email, data.name, data.passwordHash],
    )
    return r.rows[0]
  }

  /** Login OK: zera contadores e lockout, marca last_login_at. */
  async markLoginSuccess(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL, lock_cycle_count = 0,
       last_login_at = now(), updated_at = now() WHERE id = $1`,
      [id],
    )
  }

  /** Incrementa e retorna o novo failed_login_count. */
  async incrementFailedLogin(id: string): Promise<number> {
    const r = await this.pool.query<{ failed_login_count: number }>(
      `UPDATE users SET failed_login_count = failed_login_count + 1, updated_at = now()
       WHERE id = $1 RETURNING failed_login_count`,
      [id],
    )
    return r.rows[0].failed_login_count
  }

  /** Aplica lockout: define locked_until, incrementa o ciclo e zera o contador de falhas. */
  async applyLockout(id: string, lockedUntil: Date, nextCycle: number): Promise<void> {
    await this.pool.query(
      `UPDATE users SET locked_until = $2, lock_cycle_count = $3, failed_login_count = 0,
       updated_at = now() WHERE id = $1`,
      [id, lockedUntil, nextCycle],
    )
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.pool.query(
      'UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1',
      [id, passwordHash],
    )
  }

  async getRoleKeys(userId: string): Promise<string[]> {
    const r = await this.pool.query<{ key: string }>(
      `SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
      [userId],
    )
    return r.rows.map(x => x.key)
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, roleId],
    )
  }
}
```

- [ ] **Step 2: `role.repository.ts` (mínimo para o seed)**

```typescript
// server/modules/roles/role.repository.ts
import type { Pool } from 'pg'

export class RoleRepository {
  constructor(private readonly pool: Pool) {}

  async ensurePermission(key: string, description: string): Promise<string> {
    const r = await this.pool.query<{ id: string }>(
      `INSERT INTO permissions (key, description) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description RETURNING id`,
      [key, description],
    )
    return r.rows[0].id
  }

  async ensureRole(key: string, name: string): Promise<string> {
    const r = await this.pool.query<{ id: string }>(
      `INSERT INTO roles (key, name) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [key, name],
    )
    return r.rows[0].id
  }

  async linkAllPermissions(roleId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, id FROM permissions ON CONFLICT DO NOTHING`,
      [roleId],
    )
  }

  async findRoleIdByKey(key: string): Promise<string | null> {
    const r = await this.pool.query<{ id: string }>('SELECT id FROM roles WHERE key = $1', [key])
    return r.rows[0]?.id ?? null
  }
}
```

- [ ] **Step 3: `refresh-token.repository.ts`**

```typescript
// server/modules/tokens/refresh-token.repository.ts
import type { Pool } from 'pg'

export interface RefreshTokenRow {
  id: string
  user_id: string
  family_id: string
  token_hash: string
  expires_at: Date
  revoked_at: Date | null
  replaced_by: string | null
}

export class RefreshTokenRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: {
    userId: string
    familyId: string
    tokenHash: string
    expiresAt: Date
  }): Promise<RefreshTokenRow> {
    const r = await this.pool.query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.userId, data.familyId, data.tokenHash, data.expiresAt],
    )
    return r.rows[0]
  }

  async findByHash(hash: string): Promise<RefreshTokenRow | null> {
    const r = await this.pool.query<RefreshTokenRow>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [hash],
    )
    return r.rows[0] ?? null
  }

  async revoke(id: string, replacedBy: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1`,
      [id, replacedBy],
    )
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId],
    )
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    )
  }
}
```

- [ ] **Step 4: `password-reset.repository.ts`**

```typescript
// server/modules/tokens/password-reset.repository.ts
import type { Pool } from 'pg'

export interface ResetTokenRow {
  id: string
  user_id: string
  token_hash: string
  expires_at: Date
  used_at: Date | null
}

export class PasswordResetRepository {
  constructor(private readonly pool: Pool) {}

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    )
  }

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [data.userId, data.tokenHash, data.expiresAt],
    )
  }

  async findByHash(hash: string): Promise<ResetTokenRow | null> {
    const r = await this.pool.query<ResetTokenRow>(
      'SELECT * FROM password_reset_tokens WHERE token_hash = $1',
      [hash],
    )
    return r.rows[0] ?? null
  }

  async markUsed(id: string): Promise<void> {
    await this.pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [id])
  }
}
```

- [ ] **Step 5: Validação manual (Postgres rodando, migrations aplicadas)**

```bash
export DATABASE_URL=postgres://iasd:changeme@localhost:5432/iasd
npx tsx -e "import('./server/core/db.ts').then(async db=>{
  const { UserRepository } = await import('./server/modules/users/user.repository.ts')
  const repo = new UserRepository(db.pool)
  const u = await repo.create({ email:'t1@test.com', name:'T1', passwordHash:'x' })
  console.log('criado:', u.email, 'count:', await repo.countUsers())
  await db.pool.query('DELETE FROM users WHERE email=\$1', ['t1@test.com'])
  process.exit(0)
})"
```
Esperado: `criado: t1@test.com count: 1`.

- [ ] **Step 6: Commit**

```bash
git add server/modules/users server/modules/roles server/modules/tokens
git commit -m "feat(auth): repositórios users/roles/refresh/password-reset"
```

---

## Task 9: Seed (US-09)

**Files:**
- Create: `server/seed/permissions.catalog.ts`
- Create: `server/seed/seed.ts`

- [ ] **Step 1: Catálogo de permissões**

```typescript
// server/seed/permissions.catalog.ts
// Catálogo versionado. Novas features só adicionam linhas aqui (sem migration).
export const PERMISSIONS: { key: string; description: string }[] = [
  { key: 'users:read',    description: 'Listar usuários' },
  { key: 'users:invite',  description: 'Convidar novos usuários' },
  { key: 'roles:assign',  description: 'Atribuir/remover papéis' },
  { key: 'boletim:write', description: 'Criar/editar boletins' },
]
```

- [ ] **Step 2: Seed idempotente**

```typescript
// server/seed/seed.ts
import { pool } from '../core/db.js'
import { config } from '../core/config.js'
import { RoleRepository } from '../modules/roles/role.repository.js'
import { UserRepository } from '../modules/users/user.repository.js'
import { Password } from '../core/security/password.js'
import { PERMISSIONS } from './permissions.catalog.js'

export async function runSeed(): Promise<void> {
  const roles = new RoleRepository(pool)
  const users = new UserRepository(pool)

  // 1) Permissões + role admin com todas as permissões (idempotente).
  for (const p of PERMISSIONS) await roles.ensurePermission(p.key, p.description)
  const adminRoleId = await roles.ensureRole('admin', 'Administrador')
  await roles.linkAllPermissions(adminRoleId)

  // 2) Primeiro usuário (só se ainda não há nenhum).
  const total = await users.countUsers()
  if (total > 0) {
    console.log('[seed] usuários já existem — pulando criação do admin.')
    return
  }
  if (!config.seedAdminEmail || !config.seedAdminPassword) {
    console.warn('[seed] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD ausentes e nenhum usuário existe. ' +
      'Nenhum admin criado — defina as variáveis e reinicie para criar o primeiro acesso.')
    return
  }
  let passwordHash: string
  try {
    passwordHash = await Password.create(config.seedAdminPassword).hash()
  } catch {
    console.error('[seed] SEED_ADMIN_PASSWORD não atende à política de senha. Admin não criado.')
    return
  }
  const admin = await users.create({
    email: config.seedAdminEmail,
    name: 'Administrador',
    passwordHash,
  })
  await users.assignRole(admin.id, adminRoleId)
  console.log(`[seed] admin criado: ${admin.email}`)
}
```

- [ ] **Step 3: Validação manual**

```bash
export DATABASE_URL=postgres://iasd:changeme@localhost:5432/iasd
export SEED_ADMIN_EMAIL=admin@iasdtucuruvi.com.br
export SEED_ADMIN_PASSWORD='Admin#1234'
npx tsx -e "import('./server/seed/seed.ts').then(async m=>{await m.runSeed(); await m.runSeed(); process.exit(0)})"
```
Esperado: 1ª vez `[seed] admin criado: ...`; 2ª vez `[seed] usuários já existem — pulando...` (idempotência). Confirmar no banco:
```bash
docker compose exec db psql -U iasd -d iasd -c "SELECT u.email, r.key FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id;"
```
Esperado: o admin com role `admin`. Testar US-09 CA-04: rodar com `unset SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD` num banco vazio → aviso, sem quebrar.

- [ ] **Step 4: Commit**

```bash
git add server/seed
git commit -m "feat(auth): seed idempotente (permissões + role admin + 1º usuário) [US-09]"
```

---

## Task 10: Cookies, DTOs e `require-auth`

**Files:**
- Create: `server/modules/auth/auth.cookies.ts`
- Create: `server/modules/auth/dto/auth.dto.ts`
- Create: `server/modules/auth/middleware/require-auth.ts`
- Create: `server/types/express.d.ts`

- [ ] **Step 1: Augmentar `Request`**

```typescript
// server/types/express.d.ts
import 'express'
declare global {
  namespace Express {
    interface Request {
      user?: { id: string }
    }
  }
}
```

- [ ] **Step 2: Helpers de cookie**

```typescript
// server/modules/auth/auth.cookies.ts
import type { Response } from 'express'
import { config, durationToMs } from '../../core/config.js'

const base = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'strict' as const,
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie('access_token', token, { ...base, maxAge: durationToMs(config.jwtAccessTtl) })
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    ...base,
    path: '/api/auth',
    maxAge: durationToMs(config.jwtRefreshTtl),
  })
}

export function setCsrfCookie(res: Response, token: string): void {
  // NÃO httpOnly: o frontend lê e reenvia no header X-CSRF-Token.
  res.cookie('csrf_token', token, { httpOnly: false, secure: config.cookieSecure, sameSite: 'strict' })
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie('access_token', base)
  res.clearCookie('refresh_token', { ...base, path: '/api/auth' })
}
```

- [ ] **Step 3: DTOs Zod**

```typescript
// server/modules/auth/dto/auth.dto.ts
import { z } from 'zod'

export const loginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const forgotPasswordDto = z.object({
  email: z.string().email(),
})

export const resetPasswordDto = z.object({
  token: z.string().min(1),
  password: z.string().min(1), // política aplicada no value object Password (422)
})
```

- [ ] **Step 4: Middleware `require-auth`**

```typescript
// server/modules/auth/middleware/require-auth.ts
import type { RequestHandler } from 'express'
import { UnauthorizedError } from '../../../core/errors.js'
import type { TokenService } from '../../../core/security/token.service.js'

export function makeRequireAuth(tokens: TokenService): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = req.cookies?.access_token as string | undefined
      if (!token) throw new UnauthorizedError('Não autenticado.')
      const userId = await tokens.verifyAccessToken(token)
      req.user = { id: userId }
      next()
    } catch {
      next(new UnauthorizedError('Não autenticado.'))
    }
  }
}
```

- [ ] **Step 5: Validação manual**

```bash
npx tsx -e "import('./server/modules/auth/dto/auth.dto.ts').then(m=>{
  console.log('login ok:', m.loginDto.safeParse({email:'a@b.com',password:'x'}).success)
  console.log('login bad:', m.loginDto.safeParse({email:'nope',password:'x'}).success)
})"
```
Esperado: `login ok: true`, `login bad: false`.

- [ ] **Step 6: Commit**

```bash
git add server/modules/auth/auth.cookies.ts server/modules/auth/dto server/modules/auth/middleware/require-auth.ts server/types/express.d.ts
git commit -m "feat(auth): cookies de sessão, DTOs e middleware requireAuth"
```

---

## Task 11: `AuthService` — login + força bruta (US-01, US-08)

**Files:**
- Create: `server/modules/auth/auth.service.ts` (login, helpers de brute-force; demais métodos nas tasks 13/14)

- [ ] **Step 1: Esqueleto do service + `login`**

```typescript
// server/modules/auth/auth.service.ts
import { randomUUID } from 'node:crypto'
import { config, durationToMs } from '../../core/config.js'
import { ForbiddenError, UnauthorizedError } from '../../core/errors.js'
import { Password } from '../../core/security/password.js'
import type { TokenService } from '../../core/security/token.service.js'
import type { UserRepository, UserRow } from '../users/user.repository.js'
import type { RefreshTokenRepository } from '../tokens/refresh-token.repository.js'
import type { PasswordResetRepository } from '../tokens/password-reset.repository.js'

export interface SessionTokens {
  accessToken: string
  refreshToken: string
}
export interface PublicUser {
  id: string
  name: string
  email: string
  roles?: string[]
}

const GENERIC_LOGIN_ERROR = 'Credenciais inválidas.'

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly resetTokens: PasswordResetRepository,
    private readonly tokens: TokenService,
  ) {}

  async login(input: { email: string; password: string }): Promise<{ user: PublicUser } & SessionTokens> {
    const user = await this.users.findByEmail(input.email)
    if (!user) throw new UnauthorizedError(GENERIC_LOGIN_ERROR)
    if (user.status === 'disabled') throw new ForbiddenError('Conta desabilitada.')

    // Conta bloqueada: recusa mesmo com senha correta (US-08 CA-02), mensagem genérica.
    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      throw new UnauthorizedError(GENERIC_LOGIN_ERROR)
    }

    const ok = await Password.verify(input.password, user.password_hash)
    if (!ok) {
      await this.registerFailedLogin(user)
      throw new UnauthorizedError(GENERIC_LOGIN_ERROR)
    }

    await this.users.markLoginSuccess(user.id)
    const session = await this.issueSession(user.id)
    return { user: this.toPublic(user), ...session }
  }

  /** Incrementa falhas e, ao atingir o limiar, aplica lockout progressivo. */
  private async registerFailedLogin(user: UserRow): Promise<void> {
    const failed = await this.users.incrementFailedLogin(user.id)
    if (failed >= config.lockoutThreshold) {
      const idx = Math.min(user.lock_cycle_count, config.lockoutBackoffMs.length - 1)
      const lockedUntil = new Date(Date.now() + config.lockoutBackoffMs[idx])
      await this.users.applyLockout(user.id, lockedUntil, user.lock_cycle_count + 1)
    }
  }

  /** Cria uma nova família de refresh token + emite access. */
  private async issueSession(userId: string, familyId = randomUUID()): Promise<SessionTokens> {
    const { token, hash } = this.tokens.generateOpaqueToken()
    await this.refreshTokens.create({
      userId,
      familyId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + durationToMs(config.jwtRefreshTtl)),
    })
    const accessToken = await this.tokens.issueAccessToken(userId)
    return { accessToken, refreshToken: token }
  }

  private toPublic(u: UserRow): PublicUser {
    return { id: u.id, name: u.name, email: u.email }
  }
}
```

- [ ] **Step 2: Validação manual** — coberta ponta-a-ponta na Task 12 (endpoint de login). Aqui só confirme que compila:

```bash
npx tsc -p tsconfig.server.json --noEmit
```
Esperado: sem erros (ou só erros de arquivos ainda não criados das próximas tasks — nesse caso ignore os de `auth.controller`/`container` ainda inexistentes).

- [ ] **Step 3: Commit**

```bash
git add server/modules/auth/auth.service.ts
git commit -m "feat(auth): AuthService.login com lockout progressivo [US-01, US-08]"
```

---

## Task 12: Controller, rotas, container e wiring — login funcionando

**Files:**
- Create: `server/modules/auth/auth.controller.ts`
- Create: `server/modules/auth/auth.routes.ts`
- Create: `server/container.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Controller (parte de login/csrf; refresh/logout/me/forgot/reset chegam nas tasks 13/14 — incluir já os stubs abaixo)**

```typescript
// server/modules/auth/auth.controller.ts
import type { Request, Response } from 'express'
import { rateLimit } from '../../lib/rate-limit.js'
import { config } from '../../core/config.js'
import { TooManyRequestsError } from '../../core/errors.js'
import { issueCsrfToken } from '../../core/security/csrf.js'
import { loginDto, forgotPasswordDto, resetPasswordDto } from './dto/auth.dto.js'
import {
  setAccessCookie, setRefreshCookie, setCsrfCookie, clearSessionCookies,
} from './auth.cookies.js'
import type { AuthService } from './auth.service.js'

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
}

export class AuthController {
  private readonly loginLimiter = rateLimit({
    maxRequests: config.loginRateMax,
    windowMs: config.loginRateWindowMs,
  })
  private readonly forgotLimiter = rateLimit({
    maxRequests: config.forgotRateMax,
    windowMs: config.forgotRateWindowMs,
  })

  constructor(private readonly auth: AuthService) {}

  csrf = (_req: Request, res: Response) => {
    const token = issueCsrfToken()
    setCsrfCookie(res, token)
    res.json({ csrfToken: token })
  }

  login = async (req: Request, res: Response) => {
    if (!this.loginLimiter.check(clientIp(req))) {
      throw new TooManyRequestsError('Muitas tentativas. Tente novamente em alguns minutos.')
    }
    const dto = loginDto.parse(req.body)
    const { user, accessToken, refreshToken } = await this.auth.login(dto)
    setAccessCookie(res, accessToken)
    setRefreshCookie(res, refreshToken)
    res.json({ user })
  }

  refresh = async (req: Request, res: Response) => {
    const token = req.cookies?.refresh_token as string | undefined
    const { user, accessToken, refreshToken } = await this.auth.refresh(token)
    setAccessCookie(res, accessToken)
    setRefreshCookie(res, refreshToken)
    res.json({ user })
  }

  logout = async (req: Request, res: Response) => {
    await this.auth.logout(req.cookies?.refresh_token as string | undefined)
    clearSessionCookies(res)
    res.status(204).end()
  }

  me = async (req: Request, res: Response) => {
    const user = await this.auth.me(req.user!.id)
    res.json({ user })
  }

  forgotPassword = async (req: Request, res: Response) => {
    if (!this.forgotLimiter.check(clientIp(req))) {
      throw new TooManyRequestsError('Muitas solicitações. Tente novamente mais tarde.')
    }
    const dto = forgotPasswordDto.parse(req.body)
    await this.auth.forgotPassword(dto.email)
    res.json({ message: 'Se houver uma conta com este e-mail, enviaremos um link de redefinição.' })
  }

  resetPassword = async (req: Request, res: Response) => {
    const dto = resetPasswordDto.parse(req.body)
    await this.auth.resetPassword(dto.token, dto.password)
    res.json({ message: 'Senha redefinida com sucesso. Faça login novamente.' })
  }
}
```

- [ ] **Step 2: Rotas**

```typescript
// server/modules/auth/auth.routes.ts
import { Router, type RequestHandler } from 'express'
import type { AuthController } from './auth.controller.js'
import { requireCsrf } from './middleware/require-csrf.js'

// asyncWrap: encaminha rejeições para o error-handler central (sem try/catch nos handlers).
const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

export function makeAuthRoutes(controller: AuthController, requireAuth: RequestHandler): Router {
  const r = Router()
  r.get('/csrf', controller.csrf)
  r.post('/login', requireCsrf, wrap(controller.login))
  r.post('/refresh', requireCsrf, wrap(controller.refresh))
  r.post('/logout', requireCsrf, wrap(controller.logout))
  r.get('/me', wrap(requireAuth), wrap(controller.me))
  r.post('/forgot-password', requireCsrf, wrap(controller.forgotPassword))
  r.post('/reset-password', requireCsrf, wrap(controller.resetPassword))
  return r
}
```

- [ ] **Step 3: Composition root**

```typescript
// server/container.ts
import { pool, runMigrations } from './core/db.js'
import { config } from './core/config.js'
import { TokenService } from './core/security/token.service.js'
import { UserRepository } from './modules/users/user.repository.js'
import { RefreshTokenRepository } from './modules/tokens/refresh-token.repository.js'
import { PasswordResetRepository } from './modules/tokens/password-reset.repository.js'
import { AuthService } from './modules/auth/auth.service.js'
import { AuthController } from './modules/auth/auth.controller.js'
import { makeAuthRoutes } from './modules/auth/auth.routes.js'
import { makeRequireAuth } from './modules/auth/middleware/require-auth.js'
import { runSeed } from './seed/seed.js'

const tokens = new TokenService(config.jwtAccessSecret, config.jwtAccessTtl)
const userRepo = new UserRepository(pool)
const refreshRepo = new RefreshTokenRepository(pool)
const resetRepo = new PasswordResetRepository(pool)

const authService = new AuthService(userRepo, refreshRepo, resetRepo, tokens)
const authController = new AuthController(authService)
const requireAuth = makeRequireAuth(tokens)

export const authRoutes = makeAuthRoutes(authController, requireAuth)

export async function bootstrap(): Promise<void> {
  await runMigrations()
  await runSeed()
}
```

- [ ] **Step 4: Wiring no `server/index.ts`**

Aplicar estas mudanças em `server/index.ts`:

```typescript
// no topo, junto aos outros imports:
import cookieParser from 'cookie-parser'
import { authRoutes, bootstrap } from './container.js'
import { errorHandler } from './core/error-handler.js'

// logo após `app.use(express.json())`:
app.use(cookieParser())

// junto às demais rotas de API (antes do bloco de static files):
app.use('/api/auth', authRoutes)

// IMPORTANTE: registrar o error-handler por ÚLTIMO, depois do bloco de produção/static:
app.use(errorHandler)

// trocar o `app.listen(...)` final por boot com migrations+seed:
bootstrap()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
  })
  .catch((err) => {
    console.error('Falha no bootstrap (migrations/seed):', err)
    process.exit(1)
  })
```

- [ ] **Step 5: Validação manual ponta-a-ponta (login)**

```bash
# Postgres de pé + envs de seed exportadas:
export DATABASE_URL=postgres://iasd:changeme@localhost:5432/iasd
export SEED_ADMIN_EMAIL=admin@iasdtucuruvi.com.br SEED_ADMIN_PASSWORD='Admin#1234'
export JWT_ACCESS_SECRET=dev-access CSRF_SECRET=dev-csrf
npm run dev:server   # em outro terminal
```
Depois, num terminal novo (cookie jar p/ guardar CSRF + sessão):
```bash
# 1) pega CSRF
curl -s -c cookies.txt http://localhost:3001/api/auth/csrf
CSRF=$(grep csrf_token cookies.txt | awk '{print $7}')
# 2) login OK
curl -s -b cookies.txt -c cookies.txt -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"admin@iasdtucuruvi.com.br","password":"Admin#1234"}' http://localhost:3001/api/auth/login
# 3) credenciais inválidas → 401 genérico
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"admin@iasdtucuruvi.com.br","password":"errada"}' http://localhost:3001/api/auth/login
# 4) sem CSRF → 403
curl -s -o /dev/null -w "%{http_code}\n" -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"x"}' http://localhost:3001/api/auth/login
```
Esperado: (2) `{"user":{...}}` + cookies `access_token`/`refresh_token` no `cookies.txt`; (3) `401`; (4) `403`. Conferir lockout: 5 senhas erradas seguidas → as próximas tentativas (mesmo a correta) recusadas até expirar; inspecionar `locked_until` no banco.

- [ ] **Step 6: Commit**

```bash
git add server/modules/auth/auth.controller.ts server/modules/auth/auth.routes.ts server/container.ts server/index.ts
git commit -m "feat(auth): controller+rotas+container; login e CSRF funcionando [US-01, US-08]"
```

---

## Task 13: Refresh, logout e `me` (US-02, US-03)

**Files:**
- Modify: `server/modules/auth/auth.service.ts` (adicionar `refresh`, `logout`, `me`)

- [ ] **Step 1: Adicionar métodos ao `AuthService`**

```typescript
  // dentro de AuthService:

  async refresh(refreshToken: string | undefined): Promise<{ user: PublicUser } & SessionTokens> {
    if (!refreshToken) throw new UnauthorizedError('Sessão inválida.')
    const hash = this.tokens.hashToken(refreshToken)
    const row = await this.refreshTokens.findByHash(hash)
    if (!row) throw new UnauthorizedError('Sessão inválida.')

    // Detecção de reuso: token já revogado sendo reapresentado → revoga a família inteira.
    if (row.revoked_at) {
      await this.refreshTokens.revokeFamily(row.family_id)
      throw new UnauthorizedError('Sessão inválida.')
    }
    if (row.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedError('Sessão expirada.')
    }

    // Rotação: emite novo par na MESMA família e revoga o atual apontando replaced_by.
    const { token, hash: newHash } = this.tokens.generateOpaqueToken()
    const created = await this.refreshTokens.create({
      userId: row.user_id,
      familyId: row.family_id,
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + durationToMs(config.jwtRefreshTtl)),
    })
    await this.refreshTokens.revoke(row.id, created.id)
    const accessToken = await this.tokens.issueAccessToken(row.user_id)

    const user = await this.users.findById(row.user_id)
    if (!user) throw new UnauthorizedError('Sessão inválida.')
    return { user: this.toPublic(user), accessToken, refreshToken: token }
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return // idempotente
    const row = await this.refreshTokens.findByHash(this.tokens.hashToken(refreshToken))
    if (row && !row.revoked_at) await this.refreshTokens.revoke(row.id, null)
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId)
    if (!user) throw new UnauthorizedError('Não autenticado.')
    const roles = await this.users.getRoleKeys(userId)
    return { ...this.toPublic(user), roles }
  }
```

- [ ] **Step 2: Validação manual (servidor rodando, já logado com `cookies.txt` da Task 12)**

```bash
# refresh rotaciona o par
curl -s -b cookies.txt -c cookies.txt -X POST -H "X-CSRF-Token: $CSRF" http://localhost:3001/api/auth/refresh
# me retorna o usuário + roles
curl -s -b cookies.txt http://localhost:3001/api/auth/me
# logout → 204
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt -c cookies.txt -X POST -H "X-CSRF-Token: $CSRF" http://localhost:3001/api/auth/logout
# refresh após logout → 401
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt -X POST -H "X-CSRF-Token: $CSRF" http://localhost:3001/api/auth/refresh
```
Esperado: refresh → `{"user":...}` (e novo `refresh_token` no jar); me → `{"user":{...,"roles":["admin"]}}`; logout → `204`; refresh pós-logout → `401`. **Detecção de reuso:** guardar um refresh antigo, rotacionar, e reapresentar o antigo → `401` + conferir no banco que toda a família ficou `revoked_at` (US-03 CA-02).

- [ ] **Step 3: Commit**

```bash
git add server/modules/auth/auth.service.ts
git commit -m "feat(auth): refresh rotativo + detecção de reuso, logout, me [US-02, US-03]"
```

---

## Task 14: Esqueci/redefinir senha + e-mail (US-04, US-05)

**Files:**
- Create: `server/mail/auth-mail.ts`
- Modify: `server/modules/auth/auth.service.ts` (adicionar `forgotPassword`, `resetPassword`)

- [ ] **Step 1: E-mail de reset (reusa o `transporter` existente)**

```typescript
// server/mail/auth-mail.ts
import { transporter } from '../lib/mail.js'
import { config } from '../core/config.js'

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${config.appBaseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@iasdtucuruvi.com.br',
    to,
    subject: 'Redefinição de senha — Painel IASD Tucuruvi',
    html: `
      <h2>Redefinição de senha</h2>
      <p>Recebemos um pedido para redefinir sua senha. O link abaixo vale por ${config.passwordResetTtlMin} minutos:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não solicitou, ignore este e-mail.</p>
    `,
  })
}
```

- [ ] **Step 2: Métodos no `AuthService`** (importar `Password`, `BadRequestError`, `sendPasswordResetEmail` no topo do arquivo)

Adicionar aos imports do `auth.service.ts`:
```typescript
import { BadRequestError } from '../../core/errors.js'
import { sendPasswordResetEmail } from '../../mail/auth-mail.js'
```
E os métodos:
```typescript
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email)
    // Não vaza existência de conta: sempre retorna sem erro. Só envia se ativo.
    if (!user || user.status !== 'active') return
    await this.resetTokens.invalidateAllForUser(user.id) // só o mais recente vale
    const { token, hash } = this.tokens.generateOpaqueToken()
    await this.resetTokens.create({
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + config.passwordResetTtlMin * 60_000),
    })
    await sendPasswordResetEmail(user.email, token)
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Política primeiro (422) — sem consumir o token.
    const password = Password.create(newPassword)

    const row = await this.resetTokens.findByHash(this.tokens.hashToken(token))
    if (!row || row.used_at || row.expires_at.getTime() <= Date.now()) {
      throw new BadRequestError('Token inválido ou expirado.')
    }
    await this.users.updatePasswordHash(row.user_id, await password.hash())
    await this.resetTokens.markUsed(row.id)
    await this.refreshTokens.revokeAllForUser(row.user_id) // derruba todas as sessões
  }
```

> **Nota de robustez (opcional):** `updatePasswordHash` + `markUsed` + `revokeAllForUser` poderiam rodar numa transação única (`BEGIN/COMMIT`) para atomicidade total, como diz a spec §7.6. Se o executor quiser, extrair um helper `withTransaction(pool, fn)` em `core/db.ts` e envolver os três. Para o slice atual, a ordem acima (senha → consome token → revoga) é aceitável.

- [ ] **Step 3: Validação manual (servidor + Mailpit de pé)**

```bash
docker compose up -d mailpit    # Mailpit em http://localhost:8025
# 1) solicita reset (sempre 200 genérico)
curl -s -b cookies.txt -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"admin@iasdtucuruvi.com.br"}' http://localhost:3001/api/auth/forgot-password
# 2) e-mail inexistente → MESMA resposta, sem enviar e-mail
curl -s -b cookies.txt -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"naoexiste@x.com"}' http://localhost:3001/api/auth/forgot-password
```
Abrir http://localhost:8025, copiar o `token` do link, e:
```bash
# 3) política fraca → 422 (sem consumir token)
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"token\":\"<TOKEN>\",\"password\":\"fraca\"}" http://localhost:3001/api/auth/reset-password
# 4) reset OK → 200
curl -s -b cookies.txt -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"token\":\"<TOKEN>\",\"password\":\"NovaSenha#9\"}" http://localhost:3001/api/auth/reset-password
# 5) reusar o mesmo token → 400
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"token\":\"<TOKEN>\",\"password\":\"OutraSenha#9\"}" http://localhost:3001/api/auth/reset-password
```
Esperado: (1)(2) mesma mensagem genérica `200`, e-mail só para o existente; (3) `422`; (4) `200`; (5) `400`. Conferir no banco que as sessões antigas do usuário ficaram `revoked_at` e que o login agora funciona com a nova senha.

- [ ] **Step 4: Commit**

```bash
git add server/mail/auth-mail.ts server/modules/auth/auth.service.ts
git commit -m "feat(auth): esqueci/redefinir senha com e-mail e revogação de sessões [US-04, US-05]"
```

---

## Task 15: Frontend — API client, AuthContext e ProtectedRoute

**Files:**
- Create: `src/auth/auth-api.ts`
- Create: `src/auth/AuthContext.tsx`
- Create: `src/auth/ProtectedRoute.tsx`
- Create: `src/schemas/auth.ts`

- [ ] **Step 1: Schemas Zod (espelham o server)**

```typescript
// src/schemas/auth.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})

// Espelha a política do server: 8+ com maiúscula, número e símbolo.
export const novaSenhaSchema = z.object({
  password: z.string()
    .min(8, 'Mínimo de 8 caracteres')
    .regex(/[A-Z]/, 'Inclua uma letra maiúscula')
    .regex(/[0-9]/, 'Inclua um número')
    .regex(/[^A-Za-z0-9]/, 'Inclua um símbolo'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'As senhas não conferem', path: ['confirm'] })

export const emailSchema = z.object({ email: z.string().email('E-mail inválido') })

export type LoginInput = z.infer<typeof loginSchema>
```

- [ ] **Step 2: API client com CSRF + auto-refresh**

```typescript
// src/auth/auth-api.ts
function readCookie(name: string): string | undefined {
  return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1]
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (MUTATING.has(method)) {
    const csrf = readCookie('csrf_token')
    if (csrf) headers.set('X-CSRF-Token', decodeURIComponent(csrf))
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  }
  return fetch(`/api/auth${path}`, { ...init, headers, credentials: 'same-origin' })
}

let refreshing: Promise<boolean> | null = null
async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = rawFetch('/refresh', { method: 'POST' })
      .then(r => r.ok)
      .catch(() => false)
      .finally(() => { refreshing = null })
  }
  return refreshing
}

/** Garante que o cookie CSRF existe (chamar no boot). */
export async function ensureCsrf(): Promise<void> {
  if (!readCookie('csrf_token')) await rawFetch('/csrf')
}

/** Fetch com auto-refresh: em 401, tenta /refresh uma vez e repete. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await rawFetch(path, init)
  if (res.status === 401 && path !== '/refresh' && path !== '/login') {
    if (await tryRefresh()) res = await rawFetch(path, init)
  }
  return res
}
```

- [ ] **Step 3: AuthContext**

```tsx
// src/auth/AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch, ensureCsrf } from './auth-api.js'

interface User { id: string; name: string; email: string; roles?: string[] }
interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      const res = await apiFetch('/me')
      if (res.ok) setUser((await res.json()).user)
      setLoading(false)
    })()
  }, [])

  async function login(email: string, password: string) {
    const res = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Falha no login')
    }
    setUser((await res.json()).user)
  }

  async function logout() {
    await apiFetch('/logout', { method: 'POST' })
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
```

- [ ] **Step 4: ProtectedRoute**

```tsx
// src/auth/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext.js'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-iasd-dark">Carregando…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 5: Validação manual** — compila no build do front:

```bash
npx tsc --noEmit -p tsconfig.json
```
Esperado: sem erros nesses arquivos (erros em páginas ainda não criadas são resolvidos na Task 16).

- [ ] **Step 6: Commit**

```bash
git add src/auth src/schemas/auth.ts
git commit -m "feat(auth-ui): api client com CSRF/auto-refresh, AuthContext e ProtectedRoute"
```

---

## Task 16: Frontend — páginas e rotas

**Files:**
- Create: `src/pages/Login.tsx`
- Create: `src/pages/EsqueciSenha.tsx`
- Create: `src/pages/RedefinirSenha.tsx`
- Create: `src/pages/Painel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Página de Login**

```tsx
// src/pages/Login.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link } from 'react-router-dom'
import { loginSchema, type LoginInput } from '@/schemas/auth'
import { useAuth } from '@/auth/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginInput) {
    setErro('')
    try {
      await login(data.email, data.password)
      navigate('/painel')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao entrar')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
      <form onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-4">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark text-center">Painel Administrativo</h1>
        {erro && <p className="text-red-600 text-sm text-center">{erro}</p>}
        <div>
          <label className="block text-sm mb-1">E-mail</label>
          <input type="email" {...register('email')} className="w-full border rounded px-3 py-2" />
          {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm mb-1">Senha</label>
          <input type="password" {...register('password')} className="w-full border rounded px-3 py-2" />
          {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full bg-iasd-dark text-white rounded py-2 hover:bg-iasd-accent transition disabled:opacity-60">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="text-center text-sm">
          <Link to="/esqueci-senha" className="text-iasd-accent hover:underline">Esqueci minha senha</Link>
        </p>
      </form>
    </main>
  )
}
```

- [ ] **Step 2: Página Esqueci a Senha**

```tsx
// src/pages/EsqueciSenha.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { emailSchema } from '@/schemas/auth'
import { apiFetch, ensureCsrf } from '@/auth/auth-api'

type Input = z.infer<typeof emailSchema>

export default function EsqueciSenha() {
  const [enviado, setEnviado] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Input>({ resolver: zodResolver(emailSchema) })

  async function onSubmit(data: Input) {
    await ensureCsrf()
    await apiFetch('/forgot-password', { method: 'POST', body: JSON.stringify(data) })
    setEnviado(true) // resposta sempre genérica
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-4">
        <h1 className="text-xl font-heading font-bold text-iasd-dark text-center">Recuperar acesso</h1>
        {enviado ? (
          <p className="text-sm text-center text-gray-700">
            Se houver uma conta com este e-mail, enviamos um link de redefinição.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">E-mail</label>
              <input type="email" {...register('email')} className="w-full border rounded px-3 py-2" />
              {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting}
              className="w-full bg-iasd-dark text-white rounded py-2 hover:bg-iasd-accent transition disabled:opacity-60">
              Enviar link
            </button>
          </form>
        )}
        <p className="text-center text-sm">
          <Link to="/login" className="text-iasd-accent hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Página Redefinir Senha**

```tsx
// src/pages/RedefinirSenha.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { z } from 'zod'
import { novaSenhaSchema } from '@/schemas/auth'
import { apiFetch, ensureCsrf } from '@/auth/auth-api'

type Input = z.infer<typeof novaSenhaSchema>

export default function RedefinirSenha() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [erro, setErro] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Input>({ resolver: zodResolver(novaSenhaSchema) })

  async function onSubmit(data: Input) {
    setErro('')
    await ensureCsrf()
    const res = await apiFetch('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: data.password }),
    })
    if (res.ok) { navigate('/login') }
    else {
      const body = await res.json().catch(() => ({}))
      setErro(body.error || 'Não foi possível redefinir a senha.')
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
        <p className="text-gray-700">Link inválido. <Link to="/esqueci-senha" className="text-iasd-accent underline">Solicitar novo</Link>.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-iasd-light px-4">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-4">
        <h1 className="text-xl font-heading font-bold text-iasd-dark text-center">Nova senha</h1>
        {erro && <p className="text-red-600 text-sm text-center">{erro}</p>}
        <div>
          <label className="block text-sm mb-1">Nova senha</label>
          <input type="password" {...register('password')} className="w-full border rounded px-3 py-2" />
          {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-sm mb-1">Confirmar senha</label>
          <input type="password" {...register('confirm')} className="w-full border rounded px-3 py-2" />
          {errors.confirm && <p className="text-red-600 text-xs mt-1">{errors.confirm.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full bg-iasd-dark text-white rounded py-2 hover:bg-iasd-accent transition disabled:opacity-60">
          Redefinir
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Painel placeholder protegido**

```tsx
// src/pages/Painel.tsx
import { useAuth } from '@/auth/AuthContext'

export default function Painel() {
  const { user, logout } = useAuth()
  return (
    <main className="min-h-screen bg-iasd-light p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-heading font-bold text-iasd-dark mb-2">Painel</h1>
        <p className="text-gray-700">Olá, {user?.name} ({user?.email}).</p>
        <p className="text-sm text-gray-500 mt-1">Papéis: {user?.roles?.join(', ') || '—'}</p>
        <button onClick={logout}
          className="mt-6 bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition">
          Sair
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Rotas e provider no `App.tsx`**

Reescrever `src/App.tsx` para envolver tudo no `AuthProvider`, manter as rotas públicas com Header/Footer e adicionar as rotas de auth (sem Header/Footer) + `/painel` protegida:

```tsx
// src/App.tsx
import { useEffect } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'

import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Sermoes from './pages/Sermoes'
import Galeria from './pages/Galeria'
import Login from './pages/Login'
import EsqueciSenha from './pages/EsqueciSenha'
import RedefinirSenha from './pages/RedefinirSenha'
import Painel from './pages/Painel'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'

function PublicLayout() {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  )
}

export default function App() {
  useEffect(() => {
    AOS.init({ duration: 800, once: true, easing: 'ease-out' })
  }, [])

  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/sermoes" element={<Sermoes />} />
          <Route path="/galeria" element={<Galeria />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/painel" element={<ProtectedRoute><Painel /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  )
}
```

- [ ] **Step 6: Validação manual (browser, fluxo completo)**

```bash
# terminal 1: backend (com Postgres/Mailpit de pé e envs)
npm run dev:server
# terminal 2: frontend
npm run dev
```
No browser (http://localhost:5173):
1. Acessar `/painel` deslogado → redireciona para `/login`.
2. Logar com o admin do seed → cai em `/painel` mostrando nome/e-mail/papéis.
3. Recarregar a página → continua logado (sessão persistente via `/me`).
4. Esperar o access expirar (ou apagar só o cookie `access_token` no devtools) e navegar → `apiFetch` faz `/refresh` automático e mantém logado.
5. "Sair" → volta para `/login`; `/painel` bloqueado de novo.
6. `/esqueci-senha` → enviar e-mail → abrir Mailpit (`:8025`) → seguir link `/redefinir-senha?token=…` → definir nova senha → login com a nova senha.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Login.tsx src/pages/EsqueciSenha.tsx src/pages/RedefinirSenha.tsx src/pages/Painel.tsx src/App.tsx
git commit -m "feat(auth-ui): telas de login/esqueci/redefinir + painel protegido [US-01..US-05]"
```

---

## Task 17: Validação ponta-a-ponta e build de produção

**Files:** nenhum (verificação)

- [ ] **Step 1: Build completo**

```bash
npm run build
```
Esperado: `vite build` + `tsc -p tsconfig.server.json` sem erros + `dist-server/migrations/001_auth_foundation.sql` presente (confirma o `cp`).

- [ ] **Step 2: Checklist de aceitação por história** — percorrer manualmente confirmando:
  - **US-01:** login `200` + cookies; `401` genérico; `403` disabled (mudar `status` no banco e testar); `422` validação; `last_login_at` atualizado; contadores zerados.
  - **US-02:** logout `204`, cookies limpos, refresh pós-logout `401`, logout repetido `204`.
  - **US-03:** refresh rotaciona e revoga anterior; reuso de token revogado revoga a família; refresh expirado `401`; `/me` com access válido sem tocar refresh.
  - **US-04:** e-mail no Mailpit; resposta idêntica p/ conta existente e inexistente; tokens anteriores invalidados; `429` ao exceder o rate-limit de forgot.
  - **US-05:** reset consome token único; `400` em token inválido/usado/expirado; `422` em senha fraca; todas as sessões revogadas após sucesso.
  - **US-08:** `429` por IP no login; lockout progressivo por conta (1→5→15→60 min); reset de contadores no sucesso; mensagens genéricas.
  - **US-09:** seed cria role `admin` + catálogo de permissões + 1º usuário; idempotente; sem envs apenas avisa.

- [ ] **Step 3: Finalização do branch**

Usar a skill superpowers:finishing-a-development-branch para decidir merge/PR. Sugestão de mensagem final:

```bash
git add -A && git commit -m "docs(auth): conclui épico de autenticação (backend + telas mínimas)" || true
```

---

## Notas finais para o executor

- **Ordem importa:** as tasks 1→17 são incrementais; cada uma compila e é validável isoladamente (exceto dependências explicitamente adiadas para a task seguinte, sinalizadas nos passos de validação).
- **Segredos em dev:** exportar `JWT_ACCESS_SECRET`, `CSRF_SECRET`, `DATABASE_URL`, `SEED_ADMIN_*` no shell do `dev:server`, ou usar um `.env.local` carregado pelo seu runner. Em produção, `deploy.sh` já gera tudo.
- **Não tocar** nas APIs públicas existentes (`/api/contato`, `/api/flickr`, `/api/youtube`) nem na convenção de cache do Flickr.
- **`JWT_REFRESH_SECRET`** permanece no `.env` mas não é consumido (refresh é opaco); não wire-ar.
- **Fora deste plano (specs futuras):** `requirePermission` granular + endpoints de roles (US-10/11), convites (US-06/07), layout completo do painel (US-13+).
