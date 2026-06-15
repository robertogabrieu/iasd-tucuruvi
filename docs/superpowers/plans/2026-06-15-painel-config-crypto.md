# Painel: shell + configurações de e-mail + criptografia — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a primeira interface real do painel — shell `/painel/*` com menu lateral colapsável e persistente (US-13), tela de configurações de e-mail editável sem redeploy (US-14) e o mecanismo transversal de criptografia reversível (AES-256-GCM) que protege a senha SMTP (US-15).

**Architecture:** Backend em camadas por módulo (`routes → controller → service → repository → db`) com os 4 design patterns do `CLAUDE.md` (Repository, Service Layer, DI por construtor no `container.ts`, hierarquia de erros + handler central). Segredos reversíveis cifrados via `CryptoService` em `core/security/` (envelope versionado em jsonb). Config de e-mail persistida na tabela genérica `settings` (chave→valor); transporter Nodemailer construído na hora a partir da config vigente (banco→env). Frontend: shell `/painel/*` com layout + `<Outlet/>`, sidebar config-driven, hook de persistência em `localStorage`, e cliente `admin-api` reaproveitando a infra de CSRF/refresh existente. Spec: [`docs/superpowers/specs/2026-06-15-painel-config-crypto-design.md`](../specs/2026-06-15-painel-config-crypto-design.md).

**Tech Stack:** Express 5 (ESM, imports internos com sufixo `.js`), PostgreSQL 16 (`pg`), `node:crypto` (AES-256-GCM, sem dependência nova), Nodemailer (já no projeto), Zod v4, React 18 + React Router v7 + React Hook Form + Zod, Tailwind (`iasd-dark`/`iasd-accent`/`iasd-light`). Mailpit em dev.

> **Convenção de verificação deste projeto:** **sem suíte de testes automatizada** (decisão registrada no `CLAUDE.md` — "validação manual no browser"). Cada tarefa verifica com **typecheck** e, quando aplicável, **validação manual em runtime** (curl/Mailpit/browser/psql). **Não adicionar testes.**
>
> **Typecheck do backend (quase toda tarefa de backend):**
> `npx tsc -p tsconfig.server.json --noEmit` → Esperado: sem saída, exit 0.
>
> **Typecheck do frontend (tarefas de frontend):**
> `npm run build` → Esperado: build conclui sem erros de tipo.

---

## Mapa de arquivos

**Criar (backend):**
- `server/core/security/crypto.service.ts` — `CryptoService` (AES-256-GCM) + `parseKey`. (US-15)
- `server/migrations/003_settings.sql` — tabela `settings`. (US-14)
- `server/modules/settings/settings.repository.ts` — SQL `get`/`upsert`. (US-14)
- `server/modules/settings/settings.service.ts` — regra: merge banco→env, cifra/decifra, e-mail de teste. (US-14/15)
- `server/modules/settings/settings.controller.ts` — HTTP fino. (US-14)
- `server/modules/settings/settings.routes.ts` — rotas admin. (US-14)
- `server/modules/settings/dto/email-settings.dto.ts` — Zod (server). (US-14)
- `server/scripts/rotate-config-key.ts` — rotação de chave. (US-15 CA-06)

**Modificar (backend):**
- `server/core/config.ts` — `configEncryptionKey`, `configEncryptionKeyOld`, `emailEnvFallback`.
- `server/seed/permissions.catalog.ts` — `settings:manage`.
- `server/lib/mail.ts` — `ResolvedEmailConfig`, `sendMail`, provider injetável; remove transporter estático.
- `server/mail/auth-mail.ts` — usar `sendMail` em vez do `transporter`.
- `server/container.ts` — instanciar crypto/settings, exportar `settingsRoutes`, wirar `setEmailConfigProvider`.
- `server/index.ts` — montar `/api/admin` (settings).
- `.env.example` — `CONFIG_ENCRYPTION_KEY`, `CONFIG_ENCRYPTION_KEY_OLD`, `SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS`.
- `deploy.sh` — gerar `CONFIG_ENCRYPTION_KEY`.
- `package.json` — script `rotate:config-key`.

**Criar (frontend):**
- `src/auth/api-core.ts` — núcleo compartilhado de fetch (CSRF + auto-refresh) com `makeApiClient(prefix)`.
- `src/painel/admin-api.ts` — cliente `/api/admin`.
- `src/painel/usePersistentState.ts` — hook state ↔ localStorage.
- `src/painel/nav-config.tsx` — estrutura de navegação + ícones SVG inline.
- `src/painel/Sidebar.tsx` — menu lateral.
- `src/painel/PainelLayout.tsx` — shell (sidebar + `<Outlet/>`).
- `src/painel/pages/Dashboard.tsx` — placeholder.
- `src/painel/pages/EmBreve.tsx` — stub para itens de menu ainda não entregues.
- `src/painel/pages/Configuracoes.tsx` — tela de configurações (US-14).
- `src/painel/components/VerticalTabs.tsx` — abas verticais reutilizáveis.
- `src/schemas/settings.ts` — Zod (client, espelha o server).

**Modificar (frontend):**
- `src/auth/auth-api.ts` — passar a usar `api-core` (mantém exports `apiFetch`/`ensureCsrf`).
- `src/App.tsx` — rotas aninhadas `/painel/*`.
- `src/pages/Painel.tsx` — **remover** (substituído por `src/painel/pages/Dashboard.tsx`).

---

# Parte A — Criptografia (US-15)

## Task 1: Config — chave de cifragem + fallback de e-mail

**Files:**
- Modify: `server/core/config.ts`
- Modify: `.env.example`
- Modify: `deploy.sh`

- [ ] **Step 1: Adicionar variáveis ao config**

Em `server/core/config.ts`, dentro do objeto `config`, logo após a linha `invitationTtlDays: int('INVITE_TTL_DAYS', 7),`, adicionar:

```ts

  // Criptografia de segredos reversíveis (US-15). 32 bytes em hex (64 chars) ou base64.
  configEncryptionKey: req('CONFIG_ENCRYPTION_KEY') ||
    '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff', // dev — trocar em prod
  configEncryptionKeyOld: process.env.CONFIG_ENCRYPTION_KEY_OLD || '', // usada só durante rotação

  // Fallback inicial da config de e-mail (US-14 CA-03): vale só enquanto não há config no banco.
  emailEnvFallback: {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 1025,
    secure: process.env.SMTP_SECURE === 'true',
    from: process.env.SMTP_FROM || 'noreply@iasdtucuruvi.com.br',
    to: process.env.SMTP_TO || 'contato@iasdtucuruvi.com.br',
    authUser: process.env.SMTP_USER || '',
    authPass: process.env.SMTP_PASS || '',
  },
```

- [ ] **Step 2: Documentar as envs no `.env.example`**

Em `.env.example`, na seção SMTP, substituir o bloco SMTP atual por (adiciona `SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS` como fallback opcional):

```
# --- SMTP / E-mail (fallback inicial; o painel sobrescreve via banco) ---
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=noreply@iasdtucuruvi.com.br
SMTP_TO=contato@iasdtucuruvi.com.br
SMTP_USER=
SMTP_PASS=
PORT=3001
```

E, ao final do arquivo, adicionar a seção de criptografia:

```
# --- Criptografia de segredos de configuração (US-15) ---
# Chave AES-256-GCM (32 bytes). Gere com: openssl rand -hex 32  (deploy.sh faz isso).
CONFIG_ENCRYPTION_KEY=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff
# Preencha apenas durante a rotação de chave (chave antiga); deixe vazio no dia a dia.
CONFIG_ENCRYPTION_KEY_OLD=
```

- [ ] **Step 3: Gerar a chave no `deploy.sh`**

Em `deploy.sh`, logo após a linha `csrf_secret="$(gen_secret 32)"`, adicionar:

```bash
  config_encryption_key="$(gen_secret 32)"
```

E no heredoc do `.env`, logo após a linha `CSRF_SECRET=$csrf_secret`, adicionar:

```bash

# --- Criptografia de segredos de configuração (US-15) ---
CONFIG_ENCRYPTION_KEY=$config_encryption_key
CONFIG_ENCRYPTION_KEY_OLD=
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/core/config.ts .env.example deploy.sh
git commit -m "feat(config): CONFIG_ENCRYPTION_KEY + fallback de e-mail por env [US-14/15]"
```

---

## Task 2: CryptoService (AES-256-GCM)

**Files:**
- Create: `server/core/security/crypto.service.ts`

- [ ] **Step 1: Criar o serviço**

`server/core/security/crypto.service.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Envelope cifrado, gravável direto como jsonb. Texto claro nunca é persistido. */
export interface EncryptedValue {
  ciphertext: string // base64
  iv: string         // base64 (12 bytes, nonce GCM)
  authTag: string    // base64 (16 bytes)
  keyVersion: number // habilita rotação (US-15 CA-06)
}

const ALGO = 'aes-256-gcm'

/** Converte a chave (hex de 64 chars OU base64) em Buffer de 32 bytes. Falha cedo se inválida. */
export function parseKey(raw: string): Buffer {
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }
  if (key.length !== 32) {
    throw new Error('CONFIG_ENCRYPTION_KEY inválida: precisa ter 32 bytes (hex de 64 chars ou base64).')
  }
  return key
}

/**
 * Cifragem reversível de segredos de configuração (US-15). Reutilizável por qualquer feature
 * que precise guardar um segredo recuperável em texto claro (ex.: senha SMTP).
 * É uma classe porque carrega estado (chave + versão) e tem mais de um consumidor previsto.
 */
export class CryptoService {
  constructor(private readonly key: Buffer, private readonly keyVersion = 1) {}

  encrypt(plaintext: string): EncryptedValue {
    const iv = randomBytes(12)
    const cipher = createCipheriv(ALGO, this.key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.keyVersion,
    }
  }

  decrypt(value: EncryptedValue): string {
    const decipher = createDecipheriv(ALGO, this.key, Buffer.from(value.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'))
    try {
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, 'base64')),
        decipher.final(), // lança se o authTag não bate (conteúdo adulterado — US-15 CA-03)
      ])
      return plaintext.toString('utf8')
    } catch {
      // Não vaza conteúdo; o handler central traduz para 500 e loga server-side.
      throw new Error('Falha ao decifrar segredo de configuração (integridade inválida).')
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 3: Sanidade do round-trip (runtime, descartável)**

Run:
```bash
npx tsx -e "import('./server/core/security/crypto.service.ts').then(({CryptoService,parseKey})=>{const c=new CryptoService(parseKey('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'));const e=c.encrypt('s3nh4-smtp');console.log('decifrado ok:', c.decrypt(e)==='s3nh4-smtp');e.authTag='AAAAAAAAAAAAAAAAAAAAAA==';try{c.decrypt(e);console.log('FALHOU: não detectou adulteração')}catch{console.log('adulteração detectada ok')}})"
```
Expected: `decifrado ok: true` e `adulteração detectada ok`.

- [ ] **Step 4: Commit**

```bash
git add server/core/security/crypto.service.ts
git commit -m "feat(security): CryptoService AES-256-GCM reutilizável [US-15]"
```

---

# Parte B — Configurações de e-mail (US-14)

## Task 3: Migration `settings` + permissão `settings:manage`

**Files:**
- Create: `server/migrations/003_settings.sql`
- Modify: `server/seed/permissions.catalog.ts`

- [ ] **Step 1: Criar a migration**

`server/migrations/003_settings.sql`:

```sql
-- server/migrations/003_settings.sql
-- Configurações do sistema, chave→valor (US-14). Segredos reversíveis ficam em linha própria,
-- com value = envelope cifrado (US-15).
CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
```

- [ ] **Step 2: Adicionar a permissão ao catálogo**

Em `server/seed/permissions.catalog.ts`, adicionar uma linha ao array `PERMISSIONS`:

```ts
  { key: 'settings:manage', description: 'Gerenciar configurações do sistema' },
```

(O seed roda no boot e vincula a nova permissão à role `admin` automaticamente — sem migration de dados.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Validar migration + seed em runtime**

Run: `docker compose up -d db && npm run dev:server`
Expected: logs `[migrations] aplicada: 003_settings.sql` e seed sem erro. Conferir (em outro terminal):
```bash
docker compose exec -T db psql -U iasd -d iasd -c "\d settings" -c "SELECT key FROM permissions WHERE key='settings:manage';"
```
Expected: a tabela `settings` existe e a permissão `settings:manage` aparece. Parar o server.

- [ ] **Step 5: Commit**

```bash
git add server/migrations/003_settings.sql server/seed/permissions.catalog.ts
git commit -m "feat(db): tabela settings + permissão settings:manage [US-14]"
```

---

## Task 4: SettingsRepository

**Files:**
- Create: `server/modules/settings/settings.repository.ts`

- [ ] **Step 1: Criar o repositório**

`server/modules/settings/settings.repository.ts`:

```ts
import type { Pool } from 'pg'
import type { Queryable } from '../../core/db.js'

/** Único ponto de SQL da tabela settings. Valores são jsonb arbitrários. */
export class SettingsRepository {
  constructor(private readonly pool: Pool) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const r = await this.pool.query<{ value: T }>('SELECT value FROM settings WHERE key = $1', [key])
    return r.rows[0]?.value ?? null
  }

  async upsert(key: string, value: unknown, updatedBy: string | null = null, executor: Queryable = this.pool): Promise<void> {
    await executor.query(
      `INSERT INTO settings (key, value, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, JSON.stringify(value), updatedBy],
    )
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/modules/settings/settings.repository.ts
git commit -m "feat(settings): SettingsRepository (get/upsert) [US-14]"
```

---

## Task 5: Transporter dinâmico em `lib/mail.ts`

Remove o transporter singleton; passa a construir o transporter a partir de uma config resolvida (banco→env), injetada por um provider no bootstrap. A senha decifrada só entra no transporter no momento do envio (nunca retornada/logada).

**Files:**
- Modify: `server/lib/mail.ts`
- Modify: `server/mail/auth-mail.ts`

- [ ] **Step 1: Reescrever `lib/mail.ts`**

Substituir todo o conteúdo de `server/lib/mail.ts` por:

```ts
import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer/index.js'
import { config } from '../core/config.js'

/** Config de e-mail já resolvida (banco→env) e pronta para envio. authPass é a senha em claro (em memória). */
export interface ResolvedEmailConfig {
  host: string
  port: number
  secure: boolean
  from: string
  to: string
  authUser?: string
  authPass?: string
}

// Provider injetado no bootstrap (container.ts). Antes disso, cai no fallback de env.
let provider: (() => Promise<ResolvedEmailConfig>) | null = null
export function setEmailConfigProvider(fn: () => Promise<ResolvedEmailConfig>): void {
  provider = fn
}

function envFallback(): ResolvedEmailConfig {
  const e = config.emailEnvFallback
  return {
    host: e.host, port: e.port, secure: e.secure, from: e.from, to: e.to,
    authUser: e.authUser || undefined, authPass: e.authPass || undefined,
  }
}

export async function resolveEmailConfig(): Promise<ResolvedEmailConfig> {
  return provider ? provider() : envFallback()
}

function buildTransporter(cfg: ResolvedEmailConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.authUser ? { user: cfg.authUser, pass: cfg.authPass ?? '' } : undefined,
  })
}

/** Envia uma mensagem usando a config vigente (banco→env). Aplica o remetente padrão se ausente. */
export async function sendMail(message: Mail.Options): Promise<void> {
  const cfg = await resolveEmailConfig()
  const transporter = buildTransporter(cfg)
  await transporter.sendMail({ from: message.from ?? cfg.from, ...message })
}

/** Permite à camada de serviço enviar com uma config explícita (ex.: e-mail de teste). */
export async function sendMailWith(cfg: ResolvedEmailConfig, message: Mail.Options): Promise<void> {
  const transporter = buildTransporter(cfg)
  await transporter.sendMail({ from: message.from ?? cfg.from, ...message })
}

interface EmailData { nome: string; telefone: string; email: string; horario: string }

export async function sendContatoEmail(data: EmailData): Promise<void> {
  await sendMail({
    to: config.emailEnvFallback.to, // destino do formulário público
    subject: `Novo pedido de estudo bíblico — ${data.nome}`,
    html: `
      <h2>Novo pedido de estudo bíblico</h2>
      <p><strong>Nome:</strong> ${data.nome}</p>
      <p><strong>Telefone/WhatsApp:</strong> ${data.telefone}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Melhor horário:</strong> ${data.horario}</p>
    `,
  })
}
```

> Nota: o `to` do contato usa o destino configurado; ao salvar a config no painel, o `resolveEmailConfig` passa a refletir o banco. (Se preferir, o `to` do contato pode usar `cfg.to`; mantido em `emailEnvFallback.to` para preservar o comportamento atual do formulário público.)

- [ ] **Step 2: Atualizar `auth-mail.ts` para usar `sendMail`**

Em `server/mail/auth-mail.ts`, trocar o import do topo:

```ts
import { transporter } from '../lib/mail.js'
```

por:

```ts
import { sendMail } from '../lib/mail.js'
```

E, nas duas funções, trocar cada `await transporter.sendMail({ from: ..., to, subject, html })` por `await sendMail({ to, subject, html })` (remover a linha `from: process.env.SMTP_FROM || ...`, pois `sendMail` já aplica o remetente). Ex.:

```ts
export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${config.appBaseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`
  await sendMail({
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

export async function sendInvitationEmail(to: string, token: string): Promise<void> {
  const link = `${config.appBaseUrl}/aceitar-convite?token=${encodeURIComponent(token)}`
  await sendMail({
    to,
    subject: 'Convite — Painel IASD Tucuruvi',
    html: `
      <h2>Você foi convidado para o painel da IASD Tucuruvi</h2>
      <p>Para ativar seu acesso, defina sua senha pelo link abaixo (válido por ${config.invitationTtlDays} dias):</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não esperava este convite, ignore este e-mail.</p>
    `,
  })
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/lib/mail.ts server/mail/auth-mail.ts
git commit -m "refactor(mail): transporter dinâmico (banco→env) via provider injetável [US-14]"
```

---

## Task 6: DTO + SettingsService

**Files:**
- Create: `server/modules/settings/dto/email-settings.dto.ts`
- Create: `server/modules/settings/settings.service.ts`

- [ ] **Step 1: DTO de entrada (PUT) e do teste**

`server/modules/settings/dto/email-settings.dto.ts`:

```ts
import { z } from 'zod'

export const emailSettingsDto = z.object({
  host: z.string().min(1, 'Informe o host SMTP.'),
  port: z.number().int('Porta deve ser inteira.').min(1).max(65535),
  secure: z.boolean(),
  from: z.email('Remetente inválido.'),
  to: z.email('Destinatário inválido.'),
  authUser: z.string().optional().default(''),
  // Opcional e somente-escrita: em branco/ausente preserva a senha salva (US-14 CA-06).
  password: z.string().optional(),
})
export type EmailSettingsInput = z.infer<typeof emailSettingsDto>

export const testEmailDto = z.object({ to: z.email('Destinatário inválido.') })
```

- [ ] **Step 2: Criar o service**

`server/modules/settings/settings.service.ts`:

```ts
import { config } from '../../core/config.js'
import type { CryptoService, EncryptedValue } from '../../core/security/crypto.service.js'
import { sendMailWith, type ResolvedEmailConfig } from '../../lib/mail.js'
import type { SettingsRepository } from './settings.repository.js'
import type { EmailSettingsInput } from './dto/email-settings.dto.js'

const EMAIL_KEY = 'email'
const EMAIL_PASSWORD_KEY = 'email.smtp_password'

interface StoredEmail {
  host: string
  port: number
  secure: boolean
  from: string
  to: string
  authUser: string
}

/** Forma exposta ao cliente: sem a senha, com flag indicando se há uma salva. */
export interface PublicEmailSettings extends StoredEmail {
  hasPassword: boolean
}

export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly crypto: CryptoService,
  ) {}

  /** Lê a config não sensível (banco→env). Acrescenta hasPassword. Nunca devolve a senha. */
  async getEmailSettings(): Promise<PublicEmailSettings> {
    const stored = await this.settings.get<StoredEmail>(EMAIL_KEY)
    const e = config.emailEnvFallback
    const base: StoredEmail = stored ?? {
      host: e.host, port: e.port, secure: e.secure, from: e.from, to: e.to, authUser: e.authUser,
    }
    const enc = await this.settings.get<EncryptedValue>(EMAIL_PASSWORD_KEY)
    const hasPassword = enc != null || !!config.emailEnvFallback.authPass
    return { ...base, hasPassword }
  }

  /** Config resolvida para ENVIO (inclui senha decifrada). Uso interno; nunca exposta. */
  async getConfigForSending(): Promise<ResolvedEmailConfig> {
    const pub = await this.getEmailSettings()
    let authPass: string | undefined
    const enc = await this.settings.get<EncryptedValue>(EMAIL_PASSWORD_KEY)
    if (enc) authPass = this.crypto.decrypt(enc)
    else if (config.emailEnvFallback.authPass) authPass = config.emailEnvFallback.authPass
    return {
      host: pub.host, port: pub.port, secure: pub.secure, from: pub.from, to: pub.to,
      authUser: pub.authUser || undefined,
      authPass,
    }
  }

  /** Salva a config. Senha cifrada só se enviada; em branco preserva a anterior (CA-06). Vale sem restart. */
  async updateEmailSettings(input: EmailSettingsInput, updatedBy: string | null): Promise<PublicEmailSettings> {
    const stored: StoredEmail = {
      host: input.host, port: input.port, secure: input.secure,
      from: input.from, to: input.to, authUser: input.authUser ?? '',
    }
    await this.settings.upsert(EMAIL_KEY, stored, updatedBy)
    if (input.password && input.password.length > 0) {
      const envelope = this.crypto.encrypt(input.password)
      await this.settings.upsert(EMAIL_PASSWORD_KEY, envelope, updatedBy)
    }
    return this.getEmailSettings()
  }

  /** Envia um e-mail de teste com a config atual. Falha de SMTP retorna ok:false + motivo (não é erro HTTP). */
  async sendTestEmail(to: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const cfg = await this.getConfigForSending()
    try {
      await sendMailWith(cfg, {
        to,
        subject: 'E-mail de teste — Painel IASD Tucuruvi',
        html: '<p>Este é um e-mail de teste enviado pelo painel. Se você o recebeu, o SMTP está configurado corretamente.</p>',
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Falha desconhecida no envio.' }
    }
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/modules/settings/dto/email-settings.dto.ts server/modules/settings/settings.service.ts
git commit -m "feat(settings): SettingsService (config e-mail banco→env, cifra senha, teste) [US-14/15]"
```

---

## Task 7: Controller + rotas de settings

**Files:**
- Create: `server/modules/settings/settings.controller.ts`
- Create: `server/modules/settings/settings.routes.ts`

- [ ] **Step 1: Controller**

`server/modules/settings/settings.controller.ts`:

```ts
import type { Request, Response } from 'express'
import { emailSettingsDto, testEmailDto } from './dto/email-settings.dto.js'
import type { SettingsService } from './settings.service.js'

export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  getEmail = async (_req: Request, res: Response) => {
    res.json({ email: await this.settings.getEmailSettings() })
  }

  putEmail = async (req: Request, res: Response) => {
    const dto = emailSettingsDto.parse(req.body)
    const email = await this.settings.updateEmailSettings(dto, req.user?.id ?? null)
    res.json({ email })
  }

  testEmail = async (req: Request, res: Response) => {
    const { to } = testEmailDto.parse(req.body)
    res.json(await this.settings.sendTestEmail(to))
  }
}
```

- [ ] **Step 2: Rotas**

`server/modules/settings/settings.routes.ts`:

```ts
import { Router, type RequestHandler } from 'express'
import { requireCsrf } from '../auth/middleware/require-csrf.js'
import type { SettingsController } from './settings.controller.js'

const wrap = (h: RequestHandler): RequestHandler => (req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)

/** Montado em /api/admin. Tudo exige settings:manage (US-14 CA-07). */
export function makeSettingsRoutes(
  controller: SettingsController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const perm = requirePermission('settings:manage')
  r.get('/settings/email', wrap(requireAuth), perm, wrap(controller.getEmail))
  r.put('/settings/email', wrap(requireAuth), perm, requireCsrf, wrap(controller.putEmail))
  r.post('/settings/email/test', wrap(requireAuth), perm, requireCsrf, wrap(controller.testEmail))
  return r
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/modules/settings/settings.controller.ts server/modules/settings/settings.routes.ts
git commit -m "feat(settings): controller + rotas /api/admin/settings/email [US-14]"
```

---

## Task 8: Composition root + montagem + provider de e-mail

**Files:**
- Modify: `server/container.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Wiring no container**

Em `server/container.ts`, adicionar os imports (após os imports existentes):

```ts
import { CryptoService, parseKey } from './core/security/crypto.service.js'
import { setEmailConfigProvider } from './lib/mail.js'
import { SettingsRepository } from './modules/settings/settings.repository.js'
import { SettingsService } from './modules/settings/settings.service.js'
import { SettingsController } from './modules/settings/settings.controller.js'
import { makeSettingsRoutes } from './modules/settings/settings.routes.js'
```

E, antes da função `bootstrap`, adicionar:

```ts
// --- Configurações + criptografia (US-14/15) ---
const cryptoService = new CryptoService(parseKey(config.configEncryptionKey))
const settingsRepo = new SettingsRepository(pool)
const settingsService = new SettingsService(settingsRepo, cryptoService)
const settingsController = new SettingsController(settingsService)

export const settingsRoutes = makeSettingsRoutes(settingsController, requireAuth, requirePermission)

// O envio de e-mail passa a resolver a config vigente (banco→env, senha decifrada) a cada disparo.
setEmailConfigProvider(() => settingsService.getConfigForSending())
```

- [ ] **Step 2: Montar a rota no index**

Em `server/index.ts`, no import do container, acrescentar `settingsRoutes`:

```ts
import {
  authRoutes, roleRoutes, invitationAdminRoutes, invitationPublicRoutes, settingsRoutes, bootstrap,
} from './container.js'
```

E logo após a linha `app.use('/api/admin', roleRoutes)`, adicionar:

```ts
app.use('/api/admin', settingsRoutes)
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Validar montagem em runtime**

Run: `docker compose up -d db mailpit && npm run dev:server`
Expected: server sobe sem erro. Em outro terminal:
```bash
curl -i http://localhost:3001/api/admin/settings/email
```
Expected: `401 Unauthorized` (sem cookie) — confirma a rota montada e protegida por `requireAuth` antes da permissão. Parar o server.

- [ ] **Step 5: Commit**

```bash
git add server/container.ts server/index.ts
git commit -m "feat(admin): monta /api/admin/settings + provider de e-mail no bootstrap [US-14]"
```

---

## Task 9: Script de rotação de chave

**Files:**
- Create: `server/scripts/rotate-config-key.ts`
- Modify: `package.json`

- [ ] **Step 1: Criar o script**

`server/scripts/rotate-config-key.ts`:

```ts
/**
 * Rotação da CONFIG_ENCRYPTION_KEY (US-15 CA-06).
 * Uso: defina CONFIG_ENCRYPTION_KEY_OLD (chave atual) e CONFIG_ENCRYPTION_KEY (nova), então:
 *   npm run rotate:config-key
 * Decifra cada segredo com a chave antiga e recifra com a nova, em transação.
 */
import { pool, withTransaction } from '../core/db.js'
import { config } from '../core/config.js'
import { CryptoService, parseKey, type EncryptedValue } from '../core/security/crypto.service.js'

function isEnvelope(v: unknown): v is EncryptedValue {
  return !!v && typeof v === 'object' &&
    'ciphertext' in v && 'iv' in v && 'authTag' in v && 'keyVersion' in v
}

async function main() {
  if (!config.configEncryptionKeyOld) {
    throw new Error('Defina CONFIG_ENCRYPTION_KEY_OLD (chave antiga) para rotacionar.')
  }
  const oldCrypto = new CryptoService(parseKey(config.configEncryptionKeyOld))
  const newCrypto = new CryptoService(parseKey(config.configEncryptionKey), 2) // bump de versão

  const { rows } = await pool.query<{ key: string; value: unknown }>('SELECT key, value FROM settings')
  const targets = rows.filter(r => isEnvelope(r.value))
  console.log(`[rotate] ${targets.length} segredo(s) cifrado(s) encontrado(s).`)

  await withTransaction(async (tx) => {
    for (const row of targets) {
      const plaintext = oldCrypto.decrypt(row.value as EncryptedValue)
      const recifrado = newCrypto.encrypt(plaintext)
      await tx.query('UPDATE settings SET value = $2::jsonb, updated_at = now() WHERE key = $1',
        [row.key, JSON.stringify(recifrado)])
      console.log(`[rotate] recifrado: ${row.key}`)
    }
  })
  console.log('[rotate] concluído. Atualize CONFIG_ENCRYPTION_KEY no .env e remova CONFIG_ENCRYPTION_KEY_OLD.')
  await pool.end()
}

main().catch((e) => { console.error('[rotate] falhou:', e); process.exit(1) })
```

- [ ] **Step 2: Adicionar o npm script**

Em `package.json`, no objeto `scripts`, adicionar:

```json
    "rotate:config-key": "tsx server/scripts/rotate-config-key.ts",
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/scripts/rotate-config-key.ts package.json
git commit -m "feat(security): script de rotação da chave de cifragem [US-15]"
```

---

# Parte C — Frontend: shell do painel (US-13) + tela de configurações (US-14)

## Task 10: Núcleo de API compartilhado + cliente admin

DRY: extrai a lógica de CSRF + auto-refresh do `auth-api.ts` para um núcleo reutilizável; cria o cliente `/api/admin` sem duplicar nada. O refresh sempre aponta para `/api/auth/refresh` (path do cookie).

**Files:**
- Create: `src/auth/api-core.ts`
- Modify: `src/auth/auth-api.ts`
- Create: `src/painel/admin-api.ts`

- [ ] **Step 1: Criar o núcleo**

`src/auth/api-core.ts`:

```ts
function readCookie(name: string): string | undefined {
  return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1]
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function rawFetch(prefix: string, path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (MUTATING.has(method)) {
    const csrf = readCookie('csrf_token')
    if (csrf) headers.set('X-CSRF-Token', decodeURIComponent(csrf))
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  }
  return fetch(`${prefix}${path}`, { ...init, headers, credentials: 'same-origin' })
}

let refreshing: Promise<boolean> | null = null
function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = rawFetch('/api/auth', '/refresh', { method: 'POST' })
      .then(r => r.ok)
      .catch(() => false)
      .finally(() => { refreshing = null })
  }
  return refreshing
}

/** Garante que o cookie CSRF existe (chamar no boot). */
export async function ensureCsrf(): Promise<void> {
  if (!readCookie('csrf_token')) await rawFetch('/api/auth', '/csrf')
}

/** Cria um cliente para um prefixo (/api/auth, /api/admin) com auto-refresh em 401. */
export function makeApiClient(prefix: string) {
  async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    let res = await rawFetch(prefix, path, init)
    if (res.status === 401 && path !== '/refresh' && path !== '/login') {
      if (await tryRefresh()) res = await rawFetch(prefix, path, init)
    }
    return res
  }
  return { apiFetch }
}
```

- [ ] **Step 2: `auth-api.ts` passa a delegar ao núcleo**

Substituir todo o conteúdo de `src/auth/auth-api.ts` por:

```ts
import { makeApiClient, ensureCsrf } from './api-core.js'

const client = makeApiClient('/api/auth')
export const apiFetch = client.apiFetch
export { ensureCsrf }
```

(Mantém os exports `apiFetch`/`ensureCsrf` que `AuthContext.tsx` e `AceitarConvite.tsx` já consomem.)

- [ ] **Step 3: Criar o cliente admin**

`src/painel/admin-api.ts`:

```ts
import { makeApiClient } from '@/auth/api-core'

const client = makeApiClient('/api/admin')
export const adminFetch = client.apiFetch
```

- [ ] **Step 4: Build (typecheck do frontend)**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/auth/api-core.ts src/auth/auth-api.ts src/painel/admin-api.ts
git commit -m "refactor(api): núcleo de fetch compartilhado + cliente admin-api [US-14]"
```

---

## Task 11: Hook de persistência

**Files:**
- Create: `src/painel/usePersistentState.ts`

- [ ] **Step 1: Criar o hook**

`src/painel/usePersistentState.ts`:

```ts
import { useEffect, useState } from 'react'

/** Estado sincronizado com localStorage (US-13 CA-03/CA-04). */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* armazenamento indisponível — ignora */
    }
  }, [key, value])

  return [value, setValue]
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/painel/usePersistentState.ts
git commit -m "feat(painel): hook usePersistentState (localStorage) [US-13]"
```

---

## Task 12: Configuração de navegação + ícones

**Files:**
- Create: `src/painel/nav-config.tsx`

- [ ] **Step 1: Criar a config de navegação**

`src/painel/nav-config.tsx` (estrutura US-13 CA-08; ícones SVG inline, sem dependência). Itens sem página pronta apontam para rotas que caem no stub "Em breve":

```tsx
import type { ReactNode } from 'react'

export interface NavLeaf { label: string; to: string }
export interface NavGroup { key: string; label: string; icon: ReactNode; children: NavLeaf[] }
export interface NavItem { key: string; label: string; icon: ReactNode; to: string }
export type NavEntry = NavItem | NavGroup

export function isGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).children !== undefined
}

const icon = (d: string): ReactNode => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

// Caminhos de ícones (Heroicons outline simplificados).
const I = {
  dashboard: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  content: 'M4 6h16M4 12h16M4 18h10',
  users: 'M16 14a4 4 0 10-8 0M12 7a3 3 0 100-6 3 3 0 000 6M3 20a6 6 0 0118 0',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6M19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 2h-5l-.3 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.4L2.1 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.6h5l.3-2.6a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z',
}

export const NAV: NavEntry[] = [
  { key: 'dashboard', label: 'Dashboard', icon: icon(I.dashboard), to: '/painel' },
  {
    key: 'conteudo', label: 'Conteúdo', icon: icon(I.content), children: [
      { label: 'Sermões', to: '/painel/conteudo/sermoes' },
      { label: 'Galeria', to: '/painel/conteudo/galeria' },
      { label: 'Departamentos', to: '/painel/conteudo/departamentos' },
    ],
  },
  {
    key: 'usuarios', label: 'Usuários', icon: icon(I.users), children: [
      { label: 'Lista', to: '/painel/usuarios' },
      { label: 'Convites', to: '/painel/usuarios/convites' },
      { label: 'Papéis', to: '/painel/usuarios/papeis' },
    ],
  },
  { key: 'configuracoes', label: 'Configurações', icon: icon(I.settings), to: '/painel/configuracoes' },
]
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/painel/nav-config.tsx
git commit -m "feat(painel): config de navegação + ícones do menu [US-13]"
```

---

## Task 13: Sidebar

**Files:**
- Create: `src/painel/Sidebar.tsx`

- [ ] **Step 1: Criar a Sidebar**

`src/painel/Sidebar.tsx` (cobre CA-01..CA-07). Logo `/img/logo-iasd.svg` (confirmado em `public/img/`):

```tsx
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { usePersistentState } from './usePersistentState'
import { NAV, isGroup, type NavGroup } from './nav-config'

export default function Sidebar() {
  const [collapsed, setCollapsed] = usePersistentState<boolean>('admin.sidebar.collapsed', false)
  const [openGroups, setOpenGroups] = usePersistentState<string[]>('admin.sidebar.openGroups', [])
  const [flyout, setFlyout] = useState<string | null>(null)
  const { logout } = useAuth()
  const navigate = useNavigate()

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const linkBase = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors'
  const leafClass = ({ isActive }: { isActive: boolean }) =>
    `${linkBase} ${isActive ? 'bg-iasd-accent text-white' : 'text-white/80 hover:bg-white/10'}`

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} shrink-0 bg-iasd-dark text-white flex flex-col
      transition-[width] duration-300 ease-in-out h-screen sticky top-0`}>
      {/* Topo: logo (CA-01) */}
      <div className="flex items-center gap-2 px-3 h-16 border-b border-white/10">
        <img src="/img/logo-iasd.svg" alt="IASD Tucuruvi" className="w-9 h-9 rounded shrink-0" />
        {!collapsed && <span className="font-heading font-bold leading-tight">IASD Tucuruvi</span>}
        <button onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-white/70 hover:text-white" aria-label="Colapsar menu">
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {/* Lista de itens (rola; CA-02/04/05/06) */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {NAV.map(entry => {
          if (!isGroup(entry)) {
            return (
              <NavLink key={entry.key} to={entry.to} end={entry.to === '/painel'} className={leafClass}
                title={collapsed ? entry.label : undefined}>
                {entry.icon}{!collapsed && <span>{entry.label}</span>}
              </NavLink>
            )
          }
          const group = entry as NavGroup
          const open = openGroups.includes(group.key)
          return (
            <div key={group.key} className="relative"
              onMouseEnter={() => collapsed && setFlyout(group.key)}
              onMouseLeave={() => collapsed && setFlyout(null)}>
              <button onClick={() => !collapsed && toggleGroup(group.key)}
                className={`${linkBase} w-full text-white/80 hover:bg-white/10`}
                title={collapsed ? group.label : undefined}>
                {group.icon}
                {!collapsed && <>
                  <span>{group.label}</span>
                  <span className={`ml-auto transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                </>}
              </button>

              {/* Expandido: subitens inline (CA-04) */}
              {!collapsed && open && (
                <div className="ml-7 mt-1 space-y-1 border-l border-white/10 pl-2">
                  {group.children.map(c => (
                    <NavLink key={c.to} to={c.to} className={leafClass}>{c.label}</NavLink>
                  ))}
                </div>
              )}

              {/* Trilho: flyout no hover (CA-05) */}
              {collapsed && flyout === group.key && (
                <div className="absolute left-full top-0 ml-1 z-20 w-48 rounded-lg bg-iasd-dark
                  shadow-xl border border-white/10 p-2 space-y-1">
                  <p className="px-2 py-1 text-xs uppercase text-white/50">{group.label}</p>
                  {group.children.map(c => (
                    <NavLink key={c.to} to={c.to} className={leafClass}>{c.label}</NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Rodapé: Sair fixo (CA-07) */}
      <div className="border-t border-white/10 p-2">
        <button onClick={handleLogout}
          className={`${linkBase} w-full text-white/80 hover:bg-white/10`}
          title={collapsed ? 'Sair' : undefined}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          </svg>
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/painel/Sidebar.tsx
git commit -m "feat(painel): Sidebar colapsável com flyout, persistência e logout [US-13]"
```

---

## Task 14: Layout do painel + páginas placeholder

**Files:**
- Create: `src/painel/PainelLayout.tsx`
- Create: `src/painel/pages/Dashboard.tsx`
- Create: `src/painel/pages/EmBreve.tsx`

- [ ] **Step 1: Layout**

`src/painel/PainelLayout.tsx`:

```tsx
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function PainelLayout() {
  return (
    <div className="flex min-h-screen bg-iasd-light">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-8">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Dashboard (substitui o placeholder antigo)**

`src/painel/pages/Dashboard.tsx`:

```tsx
import { useAuth } from '@/auth/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-heading font-bold text-iasd-dark mb-2">Painel</h1>
      <p className="text-gray-700">Olá, {user?.name} ({user?.email}).</p>
      <p className="text-sm text-gray-500 mt-1">Papéis: {user?.roles?.join(', ') || '—'}</p>
    </div>
  )
}
```

- [ ] **Step 3: Stub "Em breve"**

`src/painel/pages/EmBreve.tsx`:

```tsx
export default function EmBreve() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-heading font-bold text-iasd-dark mb-2">Em breve</h1>
      <p className="text-gray-600">Esta seção ainda não foi implementada.</p>
    </div>
  )
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/painel/PainelLayout.tsx src/painel/pages/Dashboard.tsx src/painel/pages/EmBreve.tsx
git commit -m "feat(painel): PainelLayout + Dashboard + stub Em breve [US-13]"
```

---

## Task 15: Abas verticais + schema + tela de Configurações

**Files:**
- Create: `src/painel/components/VerticalTabs.tsx`
- Create: `src/schemas/settings.ts`
- Create: `src/painel/pages/Configuracoes.tsx`

- [ ] **Step 1: Abas verticais reutilizáveis**

`src/painel/components/VerticalTabs.tsx`:

```tsx
import { useState, type ReactNode } from 'react'

export interface Tab { key: string; label: string; content: ReactNode }

/** Abas verticais extensíveis (US-14 CA-01). Novas abas entram só adicionando itens. */
export default function VerticalTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key)
  return (
    <div className="flex gap-6">
      <nav className="w-48 shrink-0 space-y-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActive(t.key)}
            className={`block w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
              active === t.key ? 'bg-iasd-dark text-white' : 'text-gray-700 hover:bg-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="flex-1">{tabs.find(t => t.key === active)?.content}</div>
    </div>
  )
}
```

- [ ] **Step 2: Schema (client; espelha o DTO do server)**

`src/schemas/settings.ts`:

```ts
import { z } from 'zod'

export const emailSettingsSchema = z.object({
  host: z.string().min(1, 'Informe o host SMTP.'),
  // Divergência intencional do server (z.number): o input HTML é string; z.coerce converte para number
  // antes do JSON.stringify, então o server recebe number. NÃO trocar por z.number aqui.
  port: z.coerce.number().int('Porta deve ser inteira.').min(1, 'Porta inválida.').max(65535, 'Porta inválida.'),
  secure: z.boolean(),
  from: z.email('Remetente inválido.'),
  to: z.email('Destinatário inválido.'),
  authUser: z.string().optional(),
  password: z.string().optional(), // somente-escrita: em branco preserva a salva
})
export type EmailSettingsForm = z.infer<typeof emailSettingsSchema>
```

- [ ] **Step 3: Tela de Configurações**

`src/painel/pages/Configuracoes.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { emailSettingsSchema, type EmailSettingsForm } from '@/schemas/settings'
import VerticalTabs from '@/painel/components/VerticalTabs'

function EmailTab() {
  const [hasPassword, setHasPassword] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testTo, setTestTo] = useState('')
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<EmailSettingsForm>({ resolver: zodResolver(emailSettingsSchema) })

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      const res = await adminFetch('/settings/email')
      if (res.ok) {
        const { email } = await res.json()
        setHasPassword(email.hasPassword)
        reset({ host: email.host, port: email.port, secure: email.secure,
          from: email.from, to: email.to, authUser: email.authUser ?? '', password: '' })
      }
    })()
  }, [reset])

  async function onSubmit(data: EmailSettingsForm) {
    setMsg(null)
    const body = { ...data, authUser: data.authUser ?? '' }
    if (!data.password) delete (body as Record<string, unknown>).password // em branco preserva (CA-06)
    const res = await adminFetch('/settings/email', { method: 'PUT', body: JSON.stringify(body) })
    if (res.ok) {
      const { email } = await res.json()
      setHasPassword(email.hasPassword)
      reset({ ...email, authUser: email.authUser ?? '', password: '' })
      setMsg({ kind: 'ok', text: 'Configuração salva.' })
    } else {
      setMsg({ kind: 'err', text: 'Não foi possível salvar (verifique os campos).' })
    }
  }

  async function sendTest() {
    setMsg(null)
    const res = await adminFetch('/settings/email/test', { method: 'POST', body: JSON.stringify({ to: testTo }) })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) setMsg({ kind: 'ok', text: 'E-mail de teste enviado.' })
    else setMsg({ kind: 'err', text: `Falha no envio: ${data.reason ?? 'erro desconhecido'}` })
  }

  const field = 'w-full border rounded px-3 py-2'
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <h2 className="text-lg font-heading font-bold text-iasd-dark">E-mail</h2>
      {msg && <p className={msg.kind === 'ok' ? 'text-green-700 text-sm' : 'text-red-600 text-sm'}>{msg.text}</p>}

      <div>
        <label className="block text-sm mb-1">Host SMTP</label>
        <input {...register('host')} className={field} />
        {errors.host && <p className="text-red-600 text-xs mt-1">{errors.host.message}</p>}
      </div>
      <div>
        <label className="block text-sm mb-1">Porta</label>
        <input type="number" {...register('port')} className={field} />
        {errors.port && <p className="text-red-600 text-xs mt-1">{errors.port.message}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('secure')} /> Usar TLS (secure)
      </label>
      <div>
        <label className="block text-sm mb-1">Remetente (from)</label>
        <input {...register('from')} className={field} />
        {errors.from && <p className="text-red-600 text-xs mt-1">{errors.from.message}</p>}
      </div>
      <div>
        <label className="block text-sm mb-1">Destinatário padrão (to)</label>
        <input {...register('to')} className={field} />
        {errors.to && <p className="text-red-600 text-xs mt-1">{errors.to.message}</p>}
      </div>
      <div>
        <label className="block text-sm mb-1">Usuário de autenticação</label>
        <input {...register('authUser')} className={field} />
      </div>
      <div>
        <label className="block text-sm mb-1">Senha SMTP {hasPassword && <span className="text-gray-500">(já existe uma salva — preencha só para trocar)</span>}</label>
        <input type="password" autoComplete="new-password" {...register('password')} className={field}
          placeholder={hasPassword ? '••••••••' : ''} />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isSubmitting}
          className="bg-iasd-dark text-white rounded px-4 py-2 hover:bg-iasd-accent transition disabled:opacity-60">
          Salvar
        </button>
      </div>

      <div className="border-t pt-4 mt-4">
        <label className="block text-sm mb-1">Enviar e-mail de teste para:</label>
        <div className="flex gap-2">
          <input type="email" value={testTo} onChange={e => setTestTo(e.target.value)}
            className={field} placeholder="voce@exemplo.com" />
          <button type="button" onClick={sendTest}
            className="shrink-0 border border-iasd-dark text-iasd-dark rounded px-4 py-2 hover:bg-gray-200 transition">
            Enviar teste
          </button>
        </div>
      </div>
    </form>
  )
}

export default function Configuracoes() {
  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-iasd-dark mb-6">Configurações</h1>
      <VerticalTabs tabs={[{ key: 'email', label: 'E-mail', content: <EmailTab /> }]} />
    </div>
  )
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/painel/components/VerticalTabs.tsx src/schemas/settings.ts src/painel/pages/Configuracoes.tsx
git commit -m "feat(painel): tela de Configurações (aba E-mail) com abas verticais [US-14]"
```

---

## Task 16: Roteamento do painel no App

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/pages/Painel.tsx`

- [ ] **Step 1: Atualizar imports e rotas**

Em `src/App.tsx`, remover o import `import Painel from './pages/Painel'` e adicionar:

```tsx
import PainelLayout from './painel/PainelLayout'
import Dashboard from './painel/pages/Dashboard'
import Configuracoes from './painel/pages/Configuracoes'
import EmBreve from './painel/pages/EmBreve'
```

Substituir a rota antiga `<Route path="/painel" element={<ProtectedRoute><Painel /></ProtectedRoute>} />` por:

```tsx
        <Route path="/painel" element={<ProtectedRoute><PainelLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<EmBreve />} />
        </Route>
```

- [ ] **Step 2: Remover o placeholder antigo**

```bash
git rm src/pages/Painel.tsx
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build conclui sem erros (sem referências remanescentes a `pages/Painel`).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(painel): shell /painel/* com rotas aninhadas [US-13/14]"
```

---

## Task 17: Validação manual ponta-a-ponta

Sem testes automatizados (convenção do projeto). Validar tudo no ambiente de dev.

**Pré-requisitos:**
- `docker compose up -d db mailpit`
- `.env`/`.env.local` com `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (senha conforme política) e `CONFIG_ENCRYPTION_KEY` definido.
- Backend: `npm run dev:server` · Frontend: `npm run dev` · Mailpit UI: http://localhost:8025
- Logar em `/login` como admin antes dos passos do painel.

**US-13 — menu lateral:**
- [ ] Acessar `/painel`: logo + nome no topo; itens Dashboard/Conteúdo/Usuários/Configurações; Sair no rodapé (CA-01/08).
- [ ] Colapsar: vira trilho de ícones com transição suave; expandir volta os rótulos (CA-02).
- [ ] Recarregar a página: o menu reabre no mesmo estado (colapsado/expandido) — `localStorage admin.sidebar.collapsed` (CA-03).
- [ ] Abrir submenus (Conteúdo/Usuários), navegar e recarregar: os grupos abertos persistem — `admin.sidebar.openGroups` (CA-04).
- [ ] No modo trilho, passar o mouse sobre um grupo: flyout aparece ao lado (CA-05).
- [ ] Item da rota atual fica destacado (CA-06).
- [ ] Clicar em Sair: encerra a sessão e vai para `/login`; `/painel` volta a exigir login (CA-07).

**US-15 — criptografia:**
- [ ] Salvar uma senha SMTP na tela de Configurações; conferir no banco que está cifrada e o claro não aparece:
  ```bash
  docker compose exec -T db psql -U iasd -d iasd -c "SELECT value FROM settings WHERE key='email.smtp_password';"
  ```
  Expected: jsonb com `ciphertext`/`iv`/`authTag`/`keyVersion`; nenhum texto claro.
- [ ] Integridade: adulterar o `ciphertext` no banco e clicar "Enviar teste" → falha clara (não usa dado corrompido).
- [ ] Rotação: copiar a chave atual para `CONFIG_ENCRYPTION_KEY_OLD`, gerar nova `CONFIG_ENCRYPTION_KEY` (`openssl rand -hex 32`), rodar `npm run rotate:config-key` → segredos recifrados; "Enviar teste" segue funcionando.

**US-14 — configurações de e-mail:**
- [ ] `GET` preenche o form com a config vigente (banco→env); senha em branco com aviso de valor salvo quando há (CA-02).
- [ ] Salvar porta não numérica / e-mail malformado → erro por campo, nada gravado (CA-04).
- [ ] Trocar host/porta e salvar; "Enviar teste" usa a config nova **sem reiniciar** o server (CA-03); e-mail aparece no Mailpit (CA-05).
- [ ] Salvar com a senha em branco → a senha anterior é preservada (conferir que `email.smtp_password` não mudou) (CA-06).
- [ ] SMTP inválido no "Enviar teste" → retorno de falha com motivo (CA-05).
- [ ] Autorização: criar uma 2ª role sem `settings:manage` (inserir linhas, sem migration), atribuí-la a um usuário de teste e confirmar `403` no `GET/PUT /api/admin/settings/email` (CA-07).
- [ ] Reset/convite continuam funcionando e respeitam a config do painel (disparar um "esqueci senha" e ver o e-mail no Mailpit).

- [ ] **Commit final (se houver ajustes):**

```bash
git add -A
git commit -m "chore(painel): ajustes da validação manual do painel/config/cripto"
```

---

## Pós-implementação

- [ ] Atualizar `docs/historias/README.md`: marcar US-13, US-14, US-15 como ✅ com os commits principais.
- [ ] Confirmar o asset do logo no `Sidebar` (`/img/logo-iasd.svg` existe; trocar para `.png` se preferir).
- [ ] Usar superpowers:finishing-a-development-branch para decidir merge/PR.
