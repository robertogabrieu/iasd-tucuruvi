# IASD Tucuruvi Site — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a church website for IASD Tucuruvi with fluid animations (inspired by canta.ag), YouTube/Flickr integration, Bible study signup form, and Docker-based dev environment with Mailpit.

**Architecture:** Next.js 14 App Router with TypeScript. Hybrid page model: single-page home with scroll sections + dedicated pages for `/sermoes` and `/galeria`. API route handles form submission via Nodemailer to Mailpit (dev) or real SMTP (prod). Security headers, rate limiting, honeypot, Zod validation, and CSRF protection baked in.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS v4, AOS, React Hook Form, Zod, Nodemailer, Docker Compose, Mailpit.

---

## File Structure

```
iasd-tucuruvi/
├── docker-compose.yml                    # Next.js app + Mailpit services
├── Dockerfile                            # Multi-stage Next.js build
├── .env.local                            # SMTP config (Mailpit defaults)
├── .env.example                          # Template for env vars
├── .gitignore
├── next.config.ts                        # Security headers, image domains
├── tailwind.config.ts                    # IASD color palette, fonts
├── tsconfig.json
├── package.json
├── postcss.config.mjs
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout: fonts, metadata, AOS init
│   │   ├── page.tsx                      # Home: assembles all sections
│   │   ├── globals.css                   # Tailwind imports + custom keyframes
│   │   ├── sermoes/
│   │   │   └── page.tsx                  # Dedicated sermons page
│   │   ├── galeria/
│   │   │   └── page.tsx                  # Dedicated gallery page
│   │   └── api/
│   │       └── contato/
│   │           └── route.ts              # POST: form validation + email send
│   ├── components/
│   │   ├── Header.tsx                    # Sticky nav with smooth scroll links
│   │   ├── Hero.tsx                      # Hero section with downSlice animation
│   │   ├── Sobre.tsx                     # About section with church info
│   │   ├── AoVivo.tsx                    # YouTube live embed
│   │   ├── EstudosBiblicos.tsx           # Bible study form section
│   │   ├── SermoesPreview.tsx            # 4 latest videos preview
│   │   ├── GaleriaPreview.tsx            # 6 photos preview grid
│   │   ├── Footer.tsx                    # Footer with links and social
│   │   ├── DiagonalDivider.tsx           # Reusable diagonal clip-path divider
│   │   ├── SectionTitle.tsx              # Reusable animated section title
│   │   ├── VideoCard.tsx                 # YouTube video thumbnail card
│   │   └── PhotoCard.tsx                 # Flickr photo card
│   ├── lib/
│   │   ├── mail.ts                       # Nodemailer transport config
│   │   ├── rate-limit.ts                 # In-memory rate limiter
│   │   ├── csrf.ts                       # CSRF token generation/validation
│   │   └── sanitize.ts                   # Input sanitization utility
│   └── schemas/
│       └── contato.ts                    # Zod schema for form validation
├── public/
│   ├── img/
│   │   └── logo-iasd.svg                 # IASD official logo
│   └── favicon.ico
└── __tests__/
    ├── api/
    │   └── contato.test.ts               # API route tests
    ├── schemas/
    │   └── contato.test.ts               # Zod schema tests
    └── lib/
        ├── rate-limit.test.ts            # Rate limiter tests
        ├── sanitize.test.ts              # Sanitization tests
        └── csrf.test.ts                  # CSRF tests
```

---

## Task 1: Project Scaffolding + Docker

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `.gitignore`, `.env.local`, `.env.example`, `Dockerfile`, `docker-compose.yml`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /home/robertogabrieu/iasd-tucuruvi
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: Project files created, `node_modules` installed.

- [ ] **Step 2: Create .env.example and .env.local**

`.env.example`:
```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@iasdtucuruvi.com.br
SMTP_TO=contato@iasdtucuruvi.com.br
CSRF_SECRET=change-me-to-a-random-string
```

`.env.local` — same values but with a real CSRF_SECRET (generate with `openssl rand -hex 32`).

- [ ] **Step 3: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Create docker-compose.yml**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    depends_on:
      - mailpit

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "8025:8025"   # Web UI
      - "1025:1025"   # SMTP
    restart: unless-stopped
```

- [ ] **Step 5: Update .gitignore**

Append to the generated `.gitignore`:
```
.env.local
.env*.local
```

- [ ] **Step 6: Configure next.config.ts with security headers and standalone output**

```typescript
import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://live.staticflickr.com https://farm*.staticflickr.com https://i.ytimg.com",
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
      "connect-src 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'live.staticflickr.com' },
      { protocol: 'https', hostname: '*.staticflickr.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
```

- [ ] **Step 7: Configure tailwind.config.ts with IASD palette**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        iasd: {
          dark: '#003366',
          accent: '#0055AA',
          light: '#F5F5F5',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        heading: ['var(--font-montserrat)', 'sans-serif'],
      },
      keyframes: {
        downSlice: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        revealWidth: {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
      },
      animation: {
        'down-slice': 'downSlice 0.8s ease-out forwards',
        'reveal-width': 'revealWidth 0.8s ease-out 0.3s forwards',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 8: Setup globals.css with Tailwind and custom animations**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

@layer utilities {
  .diagonal-top {
    clip-path: polygon(0 0, 100% 8%, 100% 100%, 0 100%);
  }
  .diagonal-bottom {
    clip-path: polygon(0 0, 100% 0, 100% 92%, 0 100%);
  }
}
```

- [ ] **Step 9: Setup root layout with fonts and metadata**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' })

export const metadata: Metadata = {
  title: 'Igreja Adventista do Sétimo Dia — Tucuruvi',
  description:
    'Bem-vindo à IASD Tucuruvi. Cultos, estudos bíblicos, transmissões ao vivo e muito mais.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 10: Create minimal home page placeholder**

`src/app/page.tsx`:
```tsx
export default function Home() {
  return <main><h1>IASD Tucuruvi</h1></main>
}
```

- [ ] **Step 11: Verify dev server starts**

```bash
cd /home/robertogabrieu/iasd-tucuruvi && npm run dev
```

Expected: Server starts on http://localhost:3000, shows "IASD Tucuruvi".

- [ ] **Step 12: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js 14 project with Docker, Tailwind, and security headers"
```

---

## Task 2: Security Utilities (Lib Layer)

**Files:**
- Create: `src/lib/rate-limit.ts`, `src/lib/csrf.ts`, `src/lib/sanitize.ts`, `src/lib/mail.ts`, `src/schemas/contato.ts`
- Create: `__tests__/lib/rate-limit.test.ts`, `__tests__/lib/sanitize.test.ts`, `__tests__/lib/csrf.test.ts`, `__tests__/schemas/contato.test.ts`

- [ ] **Step 1: Install test dependencies**

```bash
npm install --save-dev jest @types/jest ts-jest @jest/globals
npx ts-jest config:init
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install nodemailer zod react-hook-form @hookform/resolvers
npm install --save-dev @types/nodemailer
```

- [ ] **Step 3: Write failing test for sanitize**

`__tests__/lib/sanitize.test.ts`:
```typescript
import { sanitize } from '@/lib/sanitize'

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>Hello')).toBe('Hello')
  })

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(sanitize('')).toBe('')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx jest __tests__/lib/sanitize.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 5: Implement sanitize**

`src/lib/sanitize.ts`:
```typescript
export function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx jest __tests__/lib/sanitize.test.ts
```
Expected: PASS.

- [ ] **Step 7: Write failing test for rate-limit**

`__tests__/lib/rate-limit.test.ts`:
```typescript
import { rateLimit } from '@/lib/rate-limit'

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    const limiter = rateLimit({ maxRequests: 3, windowMs: 60_000 })
    expect(limiter.check('127.0.0.1')).toBe(true)
    expect(limiter.check('127.0.0.1')).toBe(true)
    expect(limiter.check('127.0.0.1')).toBe(true)
  })

  it('blocks requests over the limit', () => {
    const limiter = rateLimit({ maxRequests: 2, windowMs: 60_000 })
    limiter.check('127.0.0.1')
    limiter.check('127.0.0.1')
    expect(limiter.check('127.0.0.1')).toBe(false)
  })

  it('tracks IPs independently', () => {
    const limiter = rateLimit({ maxRequests: 1, windowMs: 60_000 })
    expect(limiter.check('1.1.1.1')).toBe(true)
    expect(limiter.check('2.2.2.2')).toBe(true)
    expect(limiter.check('1.1.1.1')).toBe(false)
  })
})
```

- [ ] **Step 8: Run test to verify it fails**

```bash
npx jest __tests__/lib/rate-limit.test.ts
```
Expected: FAIL.

- [ ] **Step 9: Implement rate-limit**

`src/lib/rate-limit.ts`:
```typescript
interface RateLimitOptions {
  maxRequests: number
  windowMs: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export function rateLimit({ maxRequests, windowMs }: RateLimitOptions) {
  const store = new Map<string, RateLimitEntry>()

  return {
    check(ip: string): boolean {
      const now = Date.now()
      const entry = store.get(ip)

      if (!entry || now > entry.resetAt) {
        store.set(ip, { count: 1, resetAt: now + windowMs })
        return true
      }

      if (entry.count < maxRequests) {
        entry.count++
        return true
      }

      return false
    },
  }
}
```

- [ ] **Step 10: Run test to verify it passes**

```bash
npx jest __tests__/lib/rate-limit.test.ts
```
Expected: PASS.

- [ ] **Step 11: Write failing test for CSRF**

`__tests__/lib/csrf.test.ts`:
```typescript
import { generateCsrfToken, validateCsrfToken } from '@/lib/csrf'

describe('csrf', () => {
  const secret = 'test-secret-key-32-chars-long!!!'

  it('generates a non-empty token', () => {
    const token = generateCsrfToken(secret)
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
  })

  it('validates a correct token', () => {
    const token = generateCsrfToken(secret)
    expect(validateCsrfToken(token, secret)).toBe(true)
  })

  it('rejects a tampered token', () => {
    expect(validateCsrfToken('invalid-token', secret)).toBe(false)
  })
})
```

- [ ] **Step 12: Run test to verify it fails**

```bash
npx jest __tests__/lib/csrf.test.ts
```
Expected: FAIL.

- [ ] **Step 13: Implement CSRF**

`src/lib/csrf.ts`:
```typescript
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export function generateCsrfToken(secret: string): string {
  const nonce = randomBytes(16).toString('hex')
  const hmac = createHmac('sha256', secret).update(nonce).digest('hex')
  return `${nonce}.${hmac}`
}

export function validateCsrfToken(token: string, secret: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [nonce, providedHmac] = parts
  const expectedHmac = createHmac('sha256', secret).update(nonce).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))
  } catch {
    return false
  }
}
```

- [ ] **Step 14: Run test to verify it passes**

```bash
npx jest __tests__/lib/csrf.test.ts
```
Expected: PASS.

- [ ] **Step 15: Write failing test for Zod schema**

`__tests__/schemas/contato.test.ts`:
```typescript
import { contatoSchema } from '@/schemas/contato'

describe('contatoSchema', () => {
  const validData = {
    nome: 'Maria Silva',
    telefone: '11999998888',
    email: 'maria@email.com',
    horario: 'Manhã',
    honeypot: '',
  }

  it('accepts valid data', () => {
    const result = contatoSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = contatoSchema.safeParse({ ...validData, nome: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = contatoSchema.safeParse({ ...validData, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects short phone', () => {
    const result = contatoSchema.safeParse({ ...validData, telefone: '123' })
    expect(result.success).toBe(false)
  })

  it('detects bot via honeypot', () => {
    const result = contatoSchema.safeParse({ ...validData, honeypot: 'bot-filled-this' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 16: Run test to verify it fails**

```bash
npx jest __tests__/schemas/contato.test.ts
```
Expected: FAIL.

- [ ] **Step 17: Implement Zod schema**

`src/schemas/contato.ts`:
```typescript
import { z } from 'zod'

export const contatoSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório').max(100),
  telefone: z
    .string()
    .min(10, 'Telefone inválido')
    .max(15)
    .regex(/^[\d\s()+-]+$/, 'Telefone inválido'),
  email: z.string().email('Email inválido'),
  horario: z.string().min(1, 'Selecione um horário'),
  honeypot: z.string().max(0, 'Spam detectado'),
})

export type ContatoFormData = z.infer<typeof contatoSchema>
```

- [ ] **Step 18: Run test to verify it passes**

```bash
npx jest __tests__/schemas/contato.test.ts
```
Expected: PASS.

- [ ] **Step 19: Implement mail transport**

`src/lib/mail.ts`:
```typescript
import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 1025,
  secure: false,
})

interface EmailData {
  nome: string
  telefone: string
  email: string
  horario: string
}

export async function sendContatoEmail(data: EmailData) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@iasdtucuruvi.com.br',
    to: process.env.SMTP_TO || 'contato@iasdtucuruvi.com.br',
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

- [ ] **Step 20: Run all tests**

```bash
npx jest
```
Expected: All tests PASS.

- [ ] **Step 21: Commit**

```bash
git add -A && git commit -m "feat: add security utilities, Zod schema, and mail transport"
```

---

## Task 3: API Route — Form Submission

**Files:**
- Create: `src/app/api/contato/route.ts`
- Create: `__tests__/api/contato.test.ts`

- [ ] **Step 1: Write failing test for API route**

`__tests__/api/contato.test.ts`:
```typescript
import { POST } from '@/app/api/contato/route'

// Mock mail to avoid real SMTP in tests
jest.mock('@/lib/mail', () => ({
  sendContatoEmail: jest.fn().mockResolvedValue(undefined),
}))

function makeRequest(body: Record<string, string>, csrfToken?: string) {
  return new Request('http://localhost:3000/api/contato', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/contato', () => {
  it('rejects invalid data with 400', async () => {
    const res = await POST(makeRequest({ nome: '' }))
    expect(res.status).toBe(400)
  })

  it('rejects honeypot filled with 400', async () => {
    const res = await POST(
      makeRequest({
        nome: 'Test',
        telefone: '11999998888',
        email: 'test@test.com',
        horario: 'Manhã',
        honeypot: 'bot',
      })
    )
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/contato.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement API route**

`src/app/api/contato/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { contatoSchema } from '@/schemas/contato'
import { sanitize } from '@/lib/sanitize'
import { rateLimit } from '@/lib/rate-limit'
import { sendContatoEmail } from '@/lib/mail'

const limiter = rateLimit({ maxRequests: 5, windowMs: 60_000 })

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  if (!limiter.check(ip)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const result = contatoSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const data = {
    nome: sanitize(result.data.nome),
    telefone: sanitize(result.data.telefone),
    email: sanitize(result.data.email),
    horario: sanitize(result.data.horario),
  }

  try {
    await sendContatoEmail(data)
  } catch {
    return NextResponse.json({ error: 'Erro ao enviar mensagem.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Mensagem enviada com sucesso!' })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/contato.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add /api/contato route with validation, rate limiting, and email"
```

---

## Task 4: Shared UI Components

**Files:**
- Create: `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/components/DiagonalDivider.tsx`, `src/components/SectionTitle.tsx`, `src/components/VideoCard.tsx`, `src/components/PhotoCard.tsx`
- Install: `aos` package

- [ ] **Step 1: Install AOS**

```bash
npm install aos
npm install --save-dev @types/aos
```

- [ ] **Step 2: Create AOS initializer in layout**

Update `src/app/layout.tsx` — add an `AOSInit` client component.

Create `src/components/AOSInit.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'

export default function AOSInit() {
  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out',
    })
  }, [])

  return null
}
```

Update `layout.tsx` body to include `<AOSInit />` before `{children}`.

- [ ] **Step 3: Create DiagonalDivider**

`src/components/DiagonalDivider.tsx`:
```tsx
interface DiagonalDividerProps {
  fromColor?: string
  toColor?: string
  direction?: 'top' | 'bottom'
}

export default function DiagonalDivider({
  fromColor = 'bg-iasd-dark',
  toColor = 'bg-white',
  direction = 'bottom',
}: DiagonalDividerProps) {
  const clipClass = direction === 'bottom' ? 'diagonal-bottom' : 'diagonal-top'
  return (
    <div className={`relative -mt-1`}>
      <div className={`${fromColor} h-20 ${clipClass}`} />
    </div>
  )
}
```

- [ ] **Step 4: Create SectionTitle**

`src/components/SectionTitle.tsx`:
```tsx
interface SectionTitleProps {
  title: string
  subtitle?: string
  light?: boolean
}

export default function SectionTitle({ title, subtitle, light = false }: SectionTitleProps) {
  return (
    <div data-aos="fade-right" className="mb-12">
      <h2
        className={`font-heading text-4xl md:text-5xl font-bold ${
          light ? 'text-white' : 'text-iasd-dark'
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <div className="relative mt-2 inline-block">
          <p className={`text-lg ${light ? 'text-gray-300' : 'text-gray-600'}`}>{subtitle}</p>
          <div
            className={`absolute inset-0 ${light ? 'bg-iasd-dark' : 'bg-white'} animate-reveal-width`}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create VideoCard**

`src/components/VideoCard.tsx`:
```tsx
import Image from 'next/image'

interface VideoCardProps {
  videoId: string
  title: string
  delay?: number
}

export default function VideoCard({ videoId, title, delay = 0 }: VideoCardProps) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      data-aos="zoom-in"
      data-aos-delay={delay}
      className="group block overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:scale-[1.03]"
    >
      <div className="relative aspect-video">
        <Image
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 25vw"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <svg className="h-12 w-12 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <div className="bg-iasd-dark p-3">
        <p className="text-sm font-medium text-white line-clamp-2">{title}</p>
      </div>
    </a>
  )
}
```

- [ ] **Step 6: Create PhotoCard**

`src/components/PhotoCard.tsx`:
```tsx
import Image from 'next/image'

interface PhotoCardProps {
  src: string
  alt: string
  delay?: number
}

export default function PhotoCard({ src, alt, delay = 0 }: PhotoCardProps) {
  return (
    <div
      data-aos="zoom-in"
      data-aos-delay={delay}
      className="group overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:scale-[1.03]"
    >
      <div className="relative aspect-square">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create Header**

`src/components/Header.tsx`:
```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const navLinks = [
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#ao-vivo', label: 'Ao Vivo' },
  { href: '/#estudos', label: 'Estudos Bíblicos' },
  { href: '/sermoes', label: 'Sermões' },
  { href: '/galeria', label: 'Galeria' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 z-50 w-full bg-iasd-dark/95 backdrop-blur-sm">
      <nav className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/img/logo-iasd.svg" alt="IASD Tucuruvi" width={40} height={40} />
          <span className="font-heading text-lg font-bold text-white">IASD Tucuruvi</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden gap-6 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm font-medium text-gray-300 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile hamburger */}
        <button
          className="text-white md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="bg-iasd-dark/95 px-4 pb-4 md:hidden">
          <ul className="space-y-3">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block text-gray-300 hover:text-white"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 8: Create Footer**

`src/components/Footer.tsx`:
```tsx
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-iasd-dark text-white">
      <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <h3 className="font-heading text-lg font-bold">IASD Tucuruvi</h3>
          <p className="mt-2 text-sm text-gray-400">
            Igreja Adventista do Sétimo Dia — Tucuruvi
          </p>
          <p className="mt-1 text-sm text-gray-400">São Paulo, SP</p>
        </div>
        <div>
          <h4 className="font-heading font-bold">Links</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            <li><Link href="/#sobre" className="hover:text-white">Sobre</Link></li>
            <li><Link href="/#ao-vivo" className="hover:text-white">Ao Vivo</Link></li>
            <li><Link href="/#estudos" className="hover:text-white">Estudos Bíblicos</Link></li>
            <li><Link href="/sermoes" className="hover:text-white">Sermões</Link></li>
            <li><Link href="/galeria" className="hover:text-white">Galeria</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-bold">Redes Sociais</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            <li>
              <a href="https://www.youtube.com/@IASDTucuruviOficial" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                YouTube
              </a>
            </li>
            <li>
              <a href="https://www.instagram.com/iasdtucuruvi/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                Instagram
              </a>
            </li>
            <li>
              <a href="https://www.flickr.com/photos/198977834@N03/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                Flickr
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-700 px-4 py-4 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} IASD Tucuruvi. Todos os direitos reservados.
      </div>
    </footer>
  )
}
```

- [ ] **Step 9: Verify app compiles with new components**

```bash
npm run build
```
Expected: Build succeeds (components aren't used yet, but should compile).

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: add shared UI components — Header, Footer, cards, dividers, AOS"
```

---

## Task 5: Home Page Sections

**Files:**
- Create: `src/components/Hero.tsx`, `src/components/Sobre.tsx`, `src/components/AoVivo.tsx`, `src/components/EstudosBiblicos.tsx`, `src/components/SermoesPreview.tsx`, `src/components/GaleriaPreview.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create Hero**

`src/components/Hero.tsx`:
```tsx
export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-iasd-dark pt-16">
      <div className="animate-down-slice text-center">
        <div className="mb-6">
          <img src="/img/logo-iasd.svg" alt="IASD" className="mx-auto h-24 w-24" />
        </div>
        <h1 className="font-heading text-5xl font-bold text-white md:text-7xl">
          IASD Tucuruvi
        </h1>
        <p className="mt-4 text-lg text-gray-300 md:text-xl">
          Igreja Adventista do Sétimo Dia
        </p>
        <div className="relative mt-6 inline-block">
          <p className="text-iasd-accent italic">
            &ldquo;Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.&rdquo;
            — Mateus 11:28
          </p>
          <div className="absolute inset-0 bg-iasd-dark animate-reveal-width" />
        </div>
        <div className="mt-10">
          <a
            href="#ao-vivo"
            className="inline-block rounded-full bg-iasd-accent px-8 py-3 font-heading font-bold text-white transition-transform hover:scale-105"
          >
            Assista ao Vivo
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7" />
        </svg>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create Sobre**

`src/components/Sobre.tsx`:
```tsx
import SectionTitle from './SectionTitle'

export default function Sobre() {
  return (
    <section id="sobre" className="bg-white py-20">
      <div className="container mx-auto px-4">
        <SectionTitle title="Quem Somos" subtitle="Conheça a IASD Tucuruvi" />

        <div className="grid gap-12 md:grid-cols-2">
          <div data-aos="zoom-in">
            <p className="text-gray-700 leading-relaxed">
              Há mais de 70 anos, a Igreja Adventista do Sétimo Dia no Tucuruvi é um lugar onde
              você pode sentir, se aprofundar, celebrar e compartilhar o amor de Jesus. Nossa
              comunidade é acolhedora e comprometida com a missão de levar esperança e
              transformação à vida das pessoas.
            </p>
          </div>

          <div data-aos="zoom-in" data-aos-delay="150">
            <h3 className="font-heading text-xl font-bold text-iasd-dark">Horários de Culto</h3>
            <ul className="mt-4 space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-iasd-accent" />
                <div>
                  <strong>Sábado — Escola Sabatina:</strong> 9h00
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-iasd-accent" />
                <div>
                  <strong>Sábado — Culto Divino:</strong> 11h15
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-iasd-accent" />
                <div>
                  <strong>Quarta-feira — Culto de Oração:</strong> 19h30
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Google Maps embed */}
        <div data-aos="zoom-in" className="mt-12">
          <iframe
            title="Localização IASD Tucuruvi"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3658.123!2d-46.606!3d-23.472!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zIASD+Tucuruvi!5e0!3m2!1spt-BR!2sbr"
            className="h-64 w-full rounded-lg shadow-lg"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create AoVivo**

`src/components/AoVivo.tsx`:
```tsx
import SectionTitle from './SectionTitle'

export default function AoVivo() {
  return (
    <section id="ao-vivo" className="bg-iasd-dark py-20">
      <div className="container mx-auto px-4">
        <SectionTitle title="Ao Vivo" subtitle="Acompanhe nossos cultos" light />

        <div data-aos="zoom-in" className="mx-auto max-w-4xl">
          <div className="relative aspect-video overflow-hidden rounded-lg shadow-2xl">
            <iframe
              src="https://www.youtube.com/embed/live_stream?channel=UCxxxxxxxxxxx&autoplay=0"
              title="Transmissão ao vivo — IASD Tucuruvi"
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">
            Acompanhe também pelo nosso{' '}
            <a
              href="https://www.youtube.com/@IASDTucuruviOficial"
              target="_blank"
              rel="noopener noreferrer"
              className="text-iasd-accent hover:underline"
            >
              canal no YouTube
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Create EstudosBiblicos**

`src/components/EstudosBiblicos.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contatoSchema, type ContatoFormData } from '@/schemas/contato'
import SectionTitle from './SectionTitle'

const horarios = ['Manhã', 'Tarde', 'Noite', 'Qualquer horário']

export default function EstudosBiblicos() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContatoFormData>({
    resolver: zodResolver(contatoSchema),
    defaultValues: { honeypot: '' },
  })

  async function onSubmit(data: ContatoFormData) {
    setStatus('sending')
    try {
      const res = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
      reset()
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="estudos" className="bg-iasd-light py-20">
      <div className="container mx-auto px-4">
        <SectionTitle
          title="Estudos Bíblicos"
          subtitle="Aprenda mais sobre a Palavra de Deus"
        />

        <div className="mx-auto max-w-xl" data-aos="zoom-in">
          <p className="mb-8 text-gray-700">
            Quer conhecer mais sobre a Bíblia? Preencha o formulário abaixo e entraremos em
            contato para agendar estudos bíblicos gratuitos.
          </p>

          {status === 'success' ? (
            <div className="rounded-lg bg-green-50 p-6 text-center text-green-800">
              <p className="font-bold">Mensagem enviada com sucesso!</p>
              <p className="mt-2 text-sm">Entraremos em contato em breve.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Honeypot — hidden from users */}
              <input type="text" {...register('honeypot')} className="hidden" tabIndex={-1} autoComplete="off" />

              <div>
                <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome</label>
                <input
                  id="nome"
                  type="text"
                  {...register('nome')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent"
                />
                {errors.nome && <p className="mt-1 text-sm text-red-600">{errors.nome.message}</p>}
              </div>

              <div>
                <label htmlFor="telefone" className="block text-sm font-medium text-gray-700">Telefone / WhatsApp</label>
                <input
                  id="telefone"
                  type="tel"
                  {...register('telefone')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent"
                />
                {errors.telefone && <p className="mt-1 text-sm text-red-600">{errors.telefone.message}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="horario" className="block text-sm font-medium text-gray-700">Melhor horário para contato</label>
                <select
                  id="horario"
                  {...register('horario')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent"
                >
                  <option value="">Selecione...</option>
                  {horarios.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {errors.horario && <p className="mt-1 text-sm text-red-600">{errors.horario.message}</p>}
              </div>

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full rounded-lg bg-iasd-accent py-3 font-heading font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {status === 'sending' ? 'Enviando...' : 'Quero estudar a Bíblia'}
              </button>

              {status === 'error' && (
                <p className="text-center text-sm text-red-600">
                  Erro ao enviar. Tente novamente.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Create SermoesPreview**

`src/components/SermoesPreview.tsx`:
```tsx
import Link from 'next/link'
import SectionTitle from './SectionTitle'
import VideoCard from './VideoCard'

// Static data — can be replaced with YouTube API later
const videos = [
  { videoId: '0HCo6g9-MS0', title: 'Seja bem-vindo a IASD Tucuruvi (trailer)' },
  { videoId: 'zuvnNGyEM1Y', title: '70 ANOS DE IASD TUCURUVI (9h30) - 25/05/2024' },
  { videoId: 'MZbiBsdgzJc', title: 'Cantata de Natal - Jornada da Fé' },
  { videoId: 'Muq1Tyefq_c', title: 'Musical: EXPERIÊNCIA COM DEUS' },
]

export default function SermoesPreview() {
  return (
    <section className="bg-white py-20">
      <div className="container mx-auto px-4">
        <SectionTitle title="Sermões" subtitle="Mensagens que transformam" />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {videos.map((v, i) => (
            <VideoCard key={v.videoId} videoId={v.videoId} title={v.title} delay={i * 100} />
          ))}
        </div>

        <div className="mt-10 text-center" data-aos="fade-up">
          <Link
            href="/sermoes"
            className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
          >
            Ver todos os sermões
          </Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Create GaleriaPreview**

`src/components/GaleriaPreview.tsx`:
```tsx
import Link from 'next/link'
import SectionTitle from './SectionTitle'
import PhotoCard from './PhotoCard'

// Static placeholder photos — replace with Flickr API or static imports later
const photos = [
  { src: '/img/placeholder-1.jpg', alt: 'IASD Tucuruvi' },
  { src: '/img/placeholder-2.jpg', alt: 'IASD Tucuruvi' },
  { src: '/img/placeholder-3.jpg', alt: 'IASD Tucuruvi' },
  { src: '/img/placeholder-4.jpg', alt: 'IASD Tucuruvi' },
  { src: '/img/placeholder-5.jpg', alt: 'IASD Tucuruvi' },
  { src: '/img/placeholder-6.jpg', alt: 'IASD Tucuruvi' },
]

export default function GaleriaPreview() {
  return (
    <section className="bg-iasd-light py-20">
      <div className="container mx-auto px-4">
        <SectionTitle title="Galeria" subtitle="Momentos especiais" />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {photos.map((p, i) => (
            <PhotoCard key={i} src={p.src} alt={p.alt} delay={i * 80} />
          ))}
        </div>

        <div className="mt-10 text-center" data-aos="fade-up">
          <Link
            href="/galeria"
            className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
          >
            Ver todas as fotos
          </Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Assemble home page**

Update `src/app/page.tsx`:
```tsx
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import DiagonalDivider from '@/components/DiagonalDivider'
import Sobre from '@/components/Sobre'
import AoVivo from '@/components/AoVivo'
import EstudosBiblicos from '@/components/EstudosBiblicos'
import SermoesPreview from '@/components/SermoesPreview'
import GaleriaPreview from '@/components/GaleriaPreview'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <DiagonalDivider fromColor="bg-iasd-dark" toColor="bg-white" />
        <Sobre />
        <DiagonalDivider fromColor="bg-white" toColor="bg-iasd-dark" direction="top" />
        <AoVivo />
        <DiagonalDivider fromColor="bg-iasd-dark" toColor="bg-iasd-light" />
        <EstudosBiblicos />
        <SermoesPreview />
        <GaleriaPreview />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 8: Verify dev server renders all sections**

```bash
npm run dev
```
Open http://localhost:3000 and verify all sections render, scroll is smooth, AOS animations trigger.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add all home page sections with animations and form"
```

---

## Task 6: Dedicated Pages — Sermões and Galeria

**Files:**
- Create: `src/app/sermoes/page.tsx`, `src/app/galeria/page.tsx`

- [ ] **Step 1: Create Sermões page**

`src/app/sermoes/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import VideoCard from '@/components/VideoCard'
import SectionTitle from '@/components/SectionTitle'

export const metadata: Metadata = {
  title: 'Sermões — IASD Tucuruvi',
  description: 'Assista aos sermões e mensagens da Igreja Adventista do Tucuruvi.',
}

// Static data — extend as needed or integrate YouTube API later
const allVideos = [
  { videoId: '0HCo6g9-MS0', title: 'Seja bem-vindo a IASD Tucuruvi (trailer)' },
  { videoId: 'zuvnNGyEM1Y', title: '70 ANOS DE IASD TUCURUVI (9h30) - 25/05/2024' },
  { videoId: 'ZV_UXcNNabM', title: '70 ANOS DE IASD TUCURUVI (17h00) - Especial Musical' },
  { videoId: 'MZbiBsdgzJc', title: 'Cantata de Natal - Jornada da Fé' },
  { videoId: 'Muq1Tyefq_c', title: 'Musical: EXPERIÊNCIA COM DEUS' },
  { videoId: 'mBPypmoo4yw', title: 'Cantata de Páscoa: VIVO ESTÁ' },
  { videoId: 'K1d4r_nIId4', title: 'CORAL ADVENTISTA DE TUCURUVI' },
  { videoId: '9Li0edw61HY', title: 'MUSICAL DE PÁSCOA "VIVO ESTÁ"' },
  { videoId: 'cawrd0aPDvU', title: '70 anos - Convite (Teaser 1)' },
  { videoId: '3hiORI0vaq4', title: '70 anos - Convite (Teaser 2)' },
  { videoId: 'Jg0WyvzXrxE', title: '70 anos - Convite (Depoimentos 2)' },
  { videoId: 'AKX-85v-r2s', title: '70 anos - Convite (Depoimentos 1)' },
]

export default function SermoesPage() {
  return (
    <>
      <Header />
      <main className="bg-white pt-24 pb-20">
        <div className="container mx-auto px-4">
          <SectionTitle title="Sermões" subtitle="Todas as mensagens" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allVideos.map((v, i) => (
              <VideoCard key={v.videoId} videoId={v.videoId} title={v.title} delay={i * 50} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Create Galeria page**

`src/app/galeria/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PhotoCard from '@/components/PhotoCard'
import SectionTitle from '@/components/SectionTitle'

export const metadata: Metadata = {
  title: 'Galeria — IASD Tucuruvi',
  description: 'Confira as fotos da Igreja Adventista do Tucuruvi.',
}

// Placeholder — replace with Flickr photos or static imports
const photos = Array.from({ length: 12 }, (_, i) => ({
  src: `/img/placeholder-${(i % 6) + 1}.jpg`,
  alt: `IASD Tucuruvi - Foto ${i + 1}`,
}))

export default function GaleriaPage() {
  return (
    <>
      <Header />
      <main className="bg-iasd-light pt-24 pb-20">
        <div className="container mx-auto px-4">
          <SectionTitle title="Galeria" subtitle="Nossos momentos" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((p, i) => (
              <PhotoCard key={i} src={p.src} alt={p.alt} delay={i * 50} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <a
              href="https://www.flickr.com/photos/198977834@N03/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full border-2 border-iasd-dark px-8 py-3 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
            >
              Ver todas no Flickr
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 3: Verify both pages render**

```bash
npm run dev
```
Navigate to `/sermoes` and `/galeria` — verify layout, cards, and animations.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add dedicated Sermões and Galeria pages"
```

---

## Task 7: Docker Validation + Final Polish

**Files:**
- Modify: `src/app/layout.tsx` (add AOSInit)
- Verify: `docker-compose.yml`, `Dockerfile`

- [ ] **Step 1: Add placeholder images for gallery**

```bash
mkdir -p public/img
# Create simple placeholder SVGs
for i in 1 2 3 4 5 6; do
  echo '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect fill="#003366" width="400" height="400"/><text fill="#fff" font-family="sans-serif" font-size="24" x="50%" y="50%" text-anchor="middle" dy=".3em">IASD Tucuruvi</text></svg>' > public/img/placeholder-$i.jpg
done
```

- [ ] **Step 2: Add IASD logo placeholder**

```bash
echo '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="#003366" stroke="#0055AA" stroke-width="2"/><text fill="white" font-family="sans-serif" font-size="14" font-weight="bold" x="50%" y="50%" text-anchor="middle" dy=".3em">IASD</text></svg>' > public/img/logo-iasd.svg
```

- [ ] **Step 3: Build and verify no errors**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 4: Run all tests**

```bash
npx jest --coverage
```
Expected: All tests pass, coverage report generated.

- [ ] **Step 5: Test Docker build**

```bash
docker compose build
```
Expected: Image builds successfully.

- [ ] **Step 6: Test Docker up**

```bash
docker compose up -d
```
Expected: Both `app` and `mailpit` containers start. App on :3000, Mailpit UI on :8025.

- [ ] **Step 7: Test form submission end-to-end**

1. Open http://localhost:3000, scroll to "Estudos Bíblicos"
2. Fill form and submit
3. Open http://localhost:8025 (Mailpit) — verify email arrived

- [ ] **Step 8: Docker down**

```bash
docker compose down
```

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add placeholders, verify Docker build and e2e form flow"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|----------------|
| 1 | Project scaffolding + Docker | 12 |
| 2 | Security utilities (lib layer) | 21 |
| 3 | API route — form submission | 5 |
| 4 | Shared UI components | 10 |
| 5 | Home page sections | 9 |
| 6 | Dedicated pages (Sermões, Galeria) | 4 |
| 7 | Docker validation + final polish | 9 |
| **Total** | | **70 steps** |
