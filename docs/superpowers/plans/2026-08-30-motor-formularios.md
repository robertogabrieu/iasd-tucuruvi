# Motor de Formulários — Plano de Implementação (US-30)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda submissão de todo formulário do site fica gravada no Postgres e aparece numa tela do
painel com filtro e exportação em CSV — e formulário novo entra declarando um arquivo, sem tela nova.

**Architecture:** Uma tabela (`form_submissions`) com os dados em `jsonb`; um catálogo de definições
em código, validado no boot, do qual derivam validação, colunas, filtros, detalhe e CSV; backend em
camadas (`routes → controller → service → repository`) no módulo `server/modules/forms/`; painel
dirigido pelo catálogo servido pela API, sem cópia da definição no frontend.

**Tech Stack:** Express 5 · Postgres 16 (`pg`) · Zod 4 · React 18 + React Router 7 · Tailwind ·
Jest + ts-jest. **Nenhuma dependência nova.**

> ✅ **Executado** na [PR #22](https://github.com/robertogabrieu/iasd-tucuruvi/pull/22), nos quatro
> commits `feat(formulários)` / `feat(painel)` / `refactor(formulários)`. As caixas abaixo ficam
> como estavam: o registro do que foi feito são os commits, e o plano se lê melhor como o roteiro
> que foi seguido. O que mudou de rumo durante a execução está anotado na spec (§12 e §13).

**Spec:** `docs/superpowers/specs/2026-08-30-motor-formularios-design.md`
**História:** `docs/historias/US-30-motor-formularios.md`

## Global Constraints

- **ESM no backend:** todo import interno em `server/` leva sufixo `.js`, mesmo apontando para `.ts`
  (`import { x } from './forms.csv.js'`). Sem isso o build quebra em runtime.
- **Camadas, sem atalho:** `routes → controller → service → repository → db`. Controller não executa
  SQL; service não toca `req`/`res`; repository não tem regra de negócio. Injeção por construtor,
  montada em `server/container.ts`.
- **Classe só com estado + comportamento coeso e mais de um consumidor.** `validateCatalog`,
  `buildSubmissionSchema` e `toCsv` são **funções puras**, não classes.
- **Listagem paginada:** contrato `?page=&limit=` (page ≥ 1 default 1; limit 1–100 default 20) e
  envelope `{ data, pagination: { page, limit, total, totalPages } }`, via `server/core/pagination.ts`.
- **Erros:** `throw new BadRequestError(...)` / `NotFoundError` / `ForbiddenError` de
  `server/core/errors.ts`; o middleware central traduz para HTTP. Sem `try/catch` para montar resposta.
- **Painel compõe o kit** `@/painel/ui` — proibido cartão/botão/badge com Tailwind solto. Primitivo
  que falta entra no kit **e** em `docs/patterns/area-administrativa-visual.md`.
- **Path alias `@/`** → `src/` nos imports do frontend.
- **Permissão nova é linha em `server/seed/permissions.catalog.ts`** — nunca migration.
- **Texto de interface em português**, com acentuação correta.
- **Rodar os testes:** `npx jest <caminho>` (a Task 1 adiciona `npm test`).

---

## O que NÃO quebra (verificado — não gaste tempo provando de novo)

- **`server/lib/sanitize.ts` e `server/lib/rate-limit.ts` continuam como estão.** O motor os
  reutiliza; nenhuma assinatura muda, e `__tests__/lib/sanitize.test.ts` e
  `__tests__/lib/rate-limit.test.ts` continuam passando sem edição.
- **`sendMail` / `sendMailWith` / `resolveEmailConfig` não mudam.** Só `sendContatoEmail` sai
  (`server/lib/mail.ts:80`); o resto de `mail.ts` fica intacto, e a configuração de e-mail do painel
  não é tocada.
- **As rotas de `/api/flickr`, `/api/youtube`, `/api/auth` e `/api/admin` existentes não são
  tocadas.** O único bloco removido de `server/index.ts` é o de `/api/contato` (linhas 30-61).
- **A ordem de montagem no `server/index.ts` já é segura:** todas as rotas de API são registradas
  antes do catch-all da SPA (`server/index.ts:153`), então `/api/formularios` não conflita com
  `/painel/formularios`, que é rota do React Router.
- **O runner de migrations aplica arquivos `.sql` em ordem alfabética** (`server/core/db.ts:49`), e a
  última é `006_boletim_templates.sql` — `007_...` entra sem ajuste nenhum no runner.
- **`gen_random_uuid()` já é usado** em `server/migrations/005_boletins.sql:5`; não precisa de extensão.

---

## Estrutura de arquivos

**Backend — `server/modules/forms/` (novo)**

| Arquivo | Responsabilidade |
|---|---|
| `dto/form-definition.ts` | Tipos `FieldType`, `FormField`, `FormDefinition` e a projeção pública |
| `dto/submission-row.ts` | `SubmissionRow` — o formato de uma linha da tabela |
| `forms.definition.utils.ts` | `validateCatalog`, `buildSubmissionSchema`, `toPublicDefinition` — funções puras |
| `catalog/estudos-biblicos.ts` | A definição do primeiro formulário |
| `catalog/index.ts` | `FORMS` e `findForm(key)` |
| `forms.csv.ts` | `toCsv` — função pura de serialização |
| `forms.mail.ts` | Corpo do aviso, montado a partir da definição |
| `dto/submission.dto.ts` | Zod da query de listagem e dos filtros |
| `forms.repository.ts` | Único ponto com SQL |
| `forms.service.ts` | Gravar, notificar, listar, exportar |
| `forms.controller.ts` | HTTP fino |
| `forms.routes.ts` | `makeFormsPublicRoutes` e `makeFormsAdminRoutes` |

**Frontend**

| Arquivo | Responsabilidade |
|---|---|
| `src/painel/ui/FilterBar.tsx` (novo) | Faixa de filtros — primitivo novo do kit |
| `src/painel/forms-api.ts` (novo) | Tipos e chamadas do painel |
| `src/painel/pages/Formularios.tsx` (novo) | Índice de formulários |
| `src/painel/pages/FormularioSubmissoes.tsx` (novo) | Listagem, filtros, detalhe, exportação |

**Modificados:** `server/migrations/007_form_submissions.sql` (novo), `server/container.ts`,
`server/index.ts`, `server/seed/permissions.catalog.ts`, `server/lib/mail.ts`, `src/App.tsx`,
`src/painel/nav-config.tsx`, `src/painel/ui/index.ts`, `src/components/EstudosBiblicos.tsx`,
`package.json`, `CLAUDE.md`, `docs/patterns/area-administrativa-visual.md`.
**Removidos:** `server/lib/schemas.ts`, `src/schemas/contato.ts`, `__tests__/schemas/contato.test.ts`.

---

## Task 1 — Definição, catálogo e CSV (funções puras)

Tudo aqui roda sem banco e sem servidor. É onde o motor pode errar em silêncio, então é onde os
testes ficam.

**Files:**
- Create: `server/modules/forms/dto/form-definition.ts`
- Create: `server/modules/forms/dto/submission-row.ts`
- Create: `server/modules/forms/forms.definition.utils.ts`
- Create: `server/modules/forms/catalog/estudos-biblicos.ts`
- Create: `server/modules/forms/catalog/index.ts`
- Create: `server/modules/forms/forms.csv.ts`
- Create: `server/migrations/007_form_submissions.sql`
- Modify: `server/seed/permissions.catalog.ts`
- Modify: `package.json` (script `test`)
- Test: `__tests__/forms/definition.test.ts`, `__tests__/forms/csv.test.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces:
  - `type FieldType = 'text' | 'longtext' | 'email' | 'phone' | 'choice' | 'date'`
  - `interface FormField { key: string; label: string; type: FieldType; required?: boolean; options?: string[]; maxLength?: number; inList?: boolean; searchable?: boolean }`
  - `interface FormDefinition { key: string; label: string; description?: string; fields: FormField[]; notify?: { subject: string; to?: string } }`
  - `interface PublicFormDefinition { key: string; label: string; description?: string; fields: FormField[] }`
  - `validateCatalog(forms: FormDefinition[]): void` — lança `Error` com mensagem nomeando formulário e campo
  - `buildSubmissionSchema(def: FormDefinition): z.ZodType<Record<string, string>>`
  - `toPublicDefinition(def: FormDefinition): PublicFormDefinition`
  - `FORMS: FormDefinition[]`, `findForm(key: string): FormDefinition | undefined`
  - `interface SubmissionRow { id, form_key, data: Record<string,string>, notified_at: Date|null, notify_error: string|null, submitted_ip: string|null, user_agent: string|null, created_at: Date }`
  - `toCsv(def: FormDefinition, rows: SubmissionRow[]): string`

- [ ] **Step 1: Adicionar o script de teste**

Em `package.json`, dentro de `"scripts"`, logo após `"dev:server"`:

```json
    "test": "jest",
```

O Jest já está configurado (`jest.config.cjs`, preset `ts-jest`, mapeamento do sufixo `.js`); só
faltava o atalho.

- [ ] **Step 2: Escrever os testes de definição, falhando**

`__tests__/forms/definition.test.ts`:

```ts
import { validateCatalog, buildSubmissionSchema } from '../../server/modules/forms/forms.definition.utils'
import type { FormDefinition } from '../../server/modules/forms/dto/form-definition'

const base: FormDefinition = {
  key: 'teste',
  label: 'Teste',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, searchable: true, inList: true },
    { key: 'turno', label: 'Turno', type: 'choice', required: true, options: ['Manhã', 'Tarde'] },
  ],
}

describe('validateCatalog', () => {
  it('aceita um catálogo válido', () => {
    expect(() => validateCatalog([base])).not.toThrow()
  })

  it('recusa chave de formulário repetida', () => {
    expect(() => validateCatalog([base, { ...base }])).toThrow(/teste/)
  })

  it('recusa chave de formulário fora do formato de URL', () => {
    expect(() => validateCatalog([{ ...base, key: 'Teste Form' }])).toThrow(/Teste Form/)
  })

  it('recusa chave de campo repetida dentro do formulário', () => {
    const dup = { ...base, fields: [...base.fields, { key: 'nome', label: 'Outro', type: 'text' as const }] }
    expect(() => validateCatalog([dup])).toThrow(/nome/)
  })

  it('recusa campo de escolha sem opções', () => {
    const semOpcoes = { ...base, fields: [{ key: 'turno', label: 'Turno', type: 'choice' as const }] }
    expect(() => validateCatalog([semOpcoes])).toThrow(/turno/)
  })

  it('recusa mais de quatro colunas de destaque', () => {
    const cinco = {
      ...base,
      fields: ['a', 'b', 'c', 'd', 'e'].map(k => ({ key: k, label: k, type: 'text' as const, inList: true })),
    }
    expect(() => validateCatalog([cinco])).toThrow(/quatro/i)
  })

  it('recusa busca em campo que não é de texto', () => {
    const buscaEmEscolha = {
      ...base,
      fields: [{ key: 'turno', label: 'Turno', type: 'choice' as const, options: ['Manhã'], searchable: true }],
    }
    expect(() => validateCatalog([buscaEmEscolha])).toThrow(/turno/)
  })
})

describe('buildSubmissionSchema', () => {
  const schema = buildSubmissionSchema(base)

  it('aceita um envio válido', () => {
    const r = schema.safeParse({ nome: 'Maria', turno: 'Manhã', honeypot: '' })
    expect(r.success).toBe(true)
  })

  it('recusa obrigatório vazio', () => {
    expect(schema.safeParse({ nome: '', turno: 'Manhã', honeypot: '' }).success).toBe(false)
  })

  it('recusa valor fora das opções', () => {
    expect(schema.safeParse({ nome: 'Maria', turno: 'Madrugada', honeypot: '' }).success).toBe(false)
  })

  it('recusa campo desconhecido', () => {
    expect(schema.safeParse({ nome: 'Maria', turno: 'Manhã', extra: 'x', honeypot: '' }).success).toBe(false)
  })

  it('recusa o campo-armadilha preenchido', () => {
    expect(schema.safeParse({ nome: 'Maria', turno: 'Manhã', honeypot: 'robô' }).success).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx jest __tests__/forms/definition.test.ts`
Expected: FAIL — `Cannot find module '../../server/modules/forms/forms.definition.utils'`

- [ ] **Step 4: Criar os tipos**

`server/modules/forms/dto/form-definition.ts`:

```ts
export type FieldType = 'text' | 'longtext' | 'email' | 'phone' | 'choice' | 'date'

/** Tipos em que faz sentido procurar por trecho. */
export const TEXTUAL_TYPES: FieldType[] = ['text', 'longtext', 'email', 'phone']

export interface FormField {
  key: string
  /** Rótulo que a pessoa viu no site. Vira cabeçalho de coluna e do CSV. */
  label: string
  type: FieldType
  required?: boolean
  /** Obrigatório quando type === 'choice'. */
  options?: string[]
  maxLength?: number
  /** Vira coluna na listagem. No máximo 4 por formulário. */
  inList?: boolean
  /** Entra na busca livre. Só em campos de texto. */
  searchable?: boolean
}

export interface FormDefinition {
  /** Segmento de URL: minúsculas, dígitos e hífens. */
  key: string
  label: string
  description?: string
  fields: FormField[]
  /** Ausente = o formulário não avisa ninguém; a submissão só é gravada. */
  notify?: { subject: string; to?: string }
}

/** O que o painel recebe: sem o destinatário do aviso. */
export interface PublicFormDefinition {
  key: string
  label: string
  description?: string
  fields: FormField[]
}

export const MAX_LIST_COLUMNS = 4
```

- [ ] **Step 5: Implementar as funções puras**

`server/modules/forms/forms.definition.utils.ts`:

```ts
import { z } from 'zod'
import {
  MAX_LIST_COLUMNS, TEXTUAL_TYPES,
  type FormDefinition, type FormField, type PublicFormDefinition,
} from './dto/form-definition.js'

const KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

const DEFAULT_MAX_LENGTH: Record<string, number> = {
  text: 200, longtext: 2000, email: 200, phone: 20, choice: 200, date: 10,
}

/**
 * Roda no boot, antes de as rotas subirem. Definição inconsistente só apareceria quebrada na tela
 * semanas depois, e a tela não tem como se defender dela — então o servidor recusa subir.
 */
export function validateCatalog(forms: FormDefinition[]): void {
  const seen = new Set<string>()
  for (const f of forms) {
    if (!KEY_RE.test(f.key)) {
      throw new Error(`Formulário "${f.key}": a chave precisa ser minúsculas, dígitos e hífens.`)
    }
    if (seen.has(f.key)) throw new Error(`Formulário "${f.key}": chave repetida no catálogo.`)
    seen.add(f.key)

    const fieldKeys = new Set<string>()
    for (const c of f.fields) {
      if (!KEY_RE.test(c.key)) {
        throw new Error(`Formulário "${f.key}", campo "${c.key}": chave fora do formato.`)
      }
      if (fieldKeys.has(c.key)) {
        throw new Error(`Formulário "${f.key}", campo "${c.key}": chave repetida.`)
      }
      fieldKeys.add(c.key)
      if (c.type === 'choice' && (!c.options || c.options.length === 0)) {
        throw new Error(`Formulário "${f.key}", campo "${c.key}": campo de escolha sem opções.`)
      }
      if (c.searchable && !TEXTUAL_TYPES.includes(c.type)) {
        throw new Error(`Formulário "${f.key}", campo "${c.key}": busca só vale em campo de texto.`)
      }
    }

    const listCount = f.fields.filter(c => c.inList).length
    if (listCount > MAX_LIST_COLUMNS) {
      throw new Error(
        `Formulário "${f.key}": ${listCount} campos marcados como coluna; o limite é quatro. ` +
        `Os demais aparecem no detalhe.`,
      )
    }
  }
}

function fieldSchema(c: FormField): z.ZodType<string> {
  const max = c.maxLength ?? DEFAULT_MAX_LENGTH[c.type] ?? 200
  if (c.type === 'choice') {
    const base = z.enum(c.options as [string, ...string[]])
    return (c.required ? base : z.union([base, z.literal('')])) as z.ZodType<string>
  }
  let s = z.string().max(max, `Máximo de ${max} caracteres.`)
  if (c.type === 'email') s = s.pipe(z.string().email('E-mail inválido.')) as unknown as z.ZodString
  if (c.type === 'phone') {
    s = s.pipe(z.string().regex(/^[\d\s()+-]+$/, 'Telefone inválido.')) as unknown as z.ZodString
  }
  return c.required ? s.pipe(z.string().min(1, 'Campo obrigatório.')) : s
}

/** Zod do envio, derivado da definição. `strict` recusa campo desconhecido. */
export function buildSubmissionSchema(def: FormDefinition) {
  const shape: Record<string, z.ZodTypeAny> = { honeypot: z.string().max(0) }
  for (const c of def.fields) {
    const s = fieldSchema(c)
    shape[c.key] = c.required ? s : s.optional()
  }
  return z.strictObject(shape)
}

/** Projeção enviada ao painel: sem o destinatário do aviso. */
export function toPublicDefinition(def: FormDefinition): PublicFormDefinition {
  const { key, label, description, fields } = def
  return { key, label, description, fields }
}
```

- [ ] **Step 6: Rodar os testes de definição**

Run: `npx jest __tests__/forms/definition.test.ts`
Expected: PASS — 12 testes.

- [ ] **Step 7: Escrever o teste do CSV, falhando**

`__tests__/forms/csv.test.ts`:

```ts
import { toCsv } from '../../server/modules/forms/forms.csv'
import type { FormDefinition } from '../../server/modules/forms/dto/form-definition'

const def: FormDefinition = {
  key: 'teste',
  label: 'Teste',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'obs', label: 'Observação', type: 'longtext' },
  ],
}

const linha = (data: Record<string, string>, extra: Partial<{ notified_at: Date | null; notify_error: string | null }> = {}) => ({
  id: '1', form_key: 'teste', data,
  notified_at: extra.notified_at ?? null,
  notify_error: extra.notify_error ?? null,
  submitted_ip: null, user_agent: null,
  created_at: new Date('2026-08-30T14:05:00Z'),
})

describe('toCsv', () => {
  it('começa com BOM e usa ponto-e-vírgula', () => {
    const csv = toCsv(def, [linha({ nome: 'Maria', obs: 'ok' })])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Recebido em;Nome;Observação;Aviso por e-mail')
  })

  it('separa linhas com CRLF', () => {
    const csv = toCsv(def, [linha({ nome: 'Maria', obs: 'ok' })])
    expect(csv).toContain('\r\n')
  })

  it('escapa aspas e ponto-e-vírgula dentro do valor', () => {
    const csv = toCsv(def, [linha({ nome: 'Ana; a "boa"', obs: '' })])
    expect(csv).toContain('"Ana; a ""boa"""')
  })

  it('neutraliza valor que a planilha calcularia como fórmula', () => {
    for (const perigoso of ['=1+1', '+1', '-1', '@SUM(A1)']) {
      const csv = toCsv(def, [linha({ nome: perigoso, obs: '' })])
      expect(csv).toContain(`'${perigoso}`)
    }
  })

  it('descreve a situação do aviso por e-mail', () => {
    expect(toCsv(def, [linha({ nome: 'a', obs: '' }, { notified_at: new Date() })])).toContain('Enviado')
    expect(toCsv(def, [linha({ nome: 'a', obs: '' }, { notify_error: 'timeout' })])).toContain('Falhou')
    expect(toCsv(def, [linha({ nome: 'a', obs: '' })])).toContain('Não configurado')
  })

  it('deixa a célula vazia quando o campo não foi preenchido', () => {
    const csv = toCsv(def, [linha({ nome: 'Maria' })])
    expect(csv).toContain('Maria;;')
  })
})
```

- [ ] **Step 8: Rodar e confirmar que falha**

Run: `npx jest __tests__/forms/csv.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 9: Implementar o CSV**

`server/modules/forms/forms.csv.ts`:

`server/modules/forms/dto/submission-row.ts` (criado antes, no mesmo passo — o formato da linha é
compartilhado por repository, serviço e CSV, então não pode morar dentro de nenhum dos três):

```ts
export interface SubmissionRow {
  id: string
  form_key: string
  data: Record<string, string>
  notified_at: Date | null
  notify_error: string | null
  submitted_ip: string | null
  user_agent: string | null
  created_at: Date
}
```

`server/modules/forms/forms.csv.ts`:

```ts
import type { FormDefinition } from './dto/form-definition.js'
import type { SubmissionRow } from './dto/submission-row.js'

const FORMULA_START = /^[=+\-@\t\r]/

/**
 * O dado vem de formulário aberto na internet: valor começando com sinal de cálculo é executado
 * pela planilha ao abrir. O apóstrofo à frente faz o Excel tratar como texto.
 */
function escapeCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function notifyLabel(row: SubmissionRow): string {
  if (row.notified_at) return 'Enviado'
  if (row.notify_error) return 'Falhou'
  return 'Não configurado'
}

function formatDate(d: Date): string {
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Separador `;` e BOM UTF-8: é o que faz o Excel em português abrir com as colunas separadas e a
 * acentuação certa. Vírgula e sem BOM produzem uma coluna só, com os acentos corrompidos.
 */
export function toCsv(def: FormDefinition, rows: SubmissionRow[]): string {
  const header = ['Recebido em', ...def.fields.map(f => f.label), 'Aviso por e-mail']
  const lines = [header.map(escapeCell).join(';')]
  for (const row of rows) {
    lines.push([
      formatDate(row.created_at),
      ...def.fields.map(f => row.data[f.key] ?? ''),
      notifyLabel(row),
    ].map(escapeCell).join(';'))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}
```

- [ ] **Step 10: Rodar os testes do CSV**

Run: `npx jest __tests__/forms/csv.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 11: Criar o catálogo**

`server/modules/forms/catalog/estudos-biblicos.ts` — reproduz os campos de hoje
(`src/schemas/contato.ts`, `src/components/EstudosBiblicos.tsx:7`):

```ts
import type { FormDefinition } from '../dto/form-definition.js'

export const estudosBiblicos: FormDefinition = {
  key: 'estudos-biblicos',
  label: 'Estudos Bíblicos',
  description: 'Pedidos de estudo bíblico feitos pela página principal do site.',
  fields: [
    { key: 'nome',     label: 'Nome',                        type: 'text',   required: true, maxLength: 100, inList: true, searchable: true },
    { key: 'telefone', label: 'Telefone / WhatsApp',         type: 'phone',  required: true, maxLength: 15,  inList: true, searchable: true },
    { key: 'email',    label: 'E-mail',                      type: 'email',  required: true, maxLength: 200, inList: true, searchable: true },
    { key: 'horario',  label: 'Melhor horário para contato', type: 'choice', required: true, inList: true,
      options: ['Manhã', 'Tarde', 'Noite', 'Qualquer horário'] },
  ],
  notify: { subject: 'Novo pedido de estudo bíblico — Site IASD Tucuruvi' },
}
```

`server/modules/forms/catalog/index.ts`:

```ts
import type { FormDefinition } from '../dto/form-definition.js'
import { estudosBiblicos } from './estudos-biblicos.js'

/** Catálogo dos formulários do site. Formulário novo = um arquivo aqui e uma linha nesta lista. */
export const FORMS: FormDefinition[] = [estudosBiblicos]

export function findForm(key: string): FormDefinition | undefined {
  return FORMS.find(f => f.key === key)
}
```

- [ ] **Step 12: Criar a migration**

`server/migrations/007_form_submissions.sql`:

```sql
-- server/migrations/007_form_submissions.sql
-- Motor de formulários: toda submissão de todo formulário público (US-30).
-- form_key é texto sem chave estrangeira de propósito: o catálogo vive no código, não no banco.
CREATE TABLE form_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key      text NOT NULL,
  data          jsonb NOT NULL,
  notified_at   timestamptz,
  notify_error  text,
  submitted_ip  inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Listagem e filtro por período sempre partem de um formulário.
CREATE INDEX idx_form_submissions_form_created ON form_submissions (form_key, created_at DESC);
```

- [ ] **Step 13: Registrar as permissões**

Em `server/seed/permissions.catalog.ts`, ao fim do array:

```ts
  { key: 'forms:read', description: 'Ver submissões de formulários' },
  { key: 'forms:export', description: 'Exportar submissões de formulários' },
```

O papel `admin` recebe as duas no próximo boot (`server/seed/seed.ts:15` religa todas a cada start).

- [ ] **Step 14: Rodar a suíte inteira e commitar**

Run: `npm test`
Expected: PASS — os cinco arquivos que já existiam mais os dois novos.

```bash
git add server/modules/forms server/migrations/007_form_submissions.sql \
        server/seed/permissions.catalog.ts package.json __tests__/forms
git commit
```

Título: `feat(formulários): catálogo de definições que valida o envio e monta o CSV`

---

## Task 2 — Backend do motor: gravar, listar, exportar

**Files:**
- Create: `server/modules/forms/dto/submission.dto.ts`
- Create: `server/modules/forms/forms.repository.ts`
- Create: `server/modules/forms/forms.service.ts`
- Create: `server/modules/forms/forms.controller.ts`
- Create: `server/modules/forms/forms.routes.ts`
- Create: `server/modules/forms/forms.mail.ts`
- Modify: `server/container.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `FORMS`, `findForm`, `validateCatalog`, `buildSubmissionSchema`, `toPublicDefinition`,
  `toCsv`, `SubmissionRow` (Task 1). `SubmissionRow` vem de `dto/submission-row.js`, nunca do
  arquivo do CSV.
- Produces:
  - `makeFormsPublicRoutes(controller: FormsController): Router` — montada em `/api/formularios`
  - `makeFormsAdminRoutes(controller, requireAuth, requirePermission): Router` — montada em `/api/admin`
  - `formsService.validateCatalogOrDie(): void` — chamada no bootstrap

- [ ] **Step 1: DTO da listagem**

`server/modules/forms/dto/submission.dto.ts`:

```ts
import { z } from 'zod'
import { paginationQuery } from '../../../core/pagination.js'
import type { FormDefinition } from './form-definition.js'

export const submissionListQuery = paginationQuery.extend({
  q: z.string().max(200).optional(),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
export type SubmissionListQuery = z.infer<typeof submissionListQuery>

export interface FieldFilter { key: string; value: string }

/**
 * Lê os `f_<chave>` da query e confere cada um contra a definição. Chave desconhecida ou valor fora
 * das opções vira erro — nada daqui chega ao SQL sem passar pela definição.
 */
export function parseFieldFilters(
  query: Record<string, unknown>,
  def: FormDefinition,
): { filters: FieldFilter[]; error?: string } {
  const filters: FieldFilter[] = []
  for (const [name, raw] of Object.entries(query)) {
    if (!name.startsWith('f_')) continue
    const key = name.slice(2)
    const field = def.fields.find(f => f.key === key)
    if (!field || field.type !== 'choice') return { filters: [], error: `Filtro desconhecido: ${key}.` }
    const value = String(raw)
    if (value === '') continue
    if (!field.options?.includes(value)) return { filters: [], error: `Valor inválido para ${field.label}.` }
    filters.push({ key, value })
  }
  return { filters }
}
```

- [ ] **Step 2: Repository**

`server/modules/forms/forms.repository.ts` — único ponto com SQL. Métodos:

```ts
import type { Pool } from 'pg'
import type { SubmissionRow } from './dto/submission-row.js'
import type { FieldFilter } from './dto/submission.dto.js'

export interface CreateSubmissionInput {
  formKey: string
  data: Record<string, string>
  ip: string | null
  userAgent: string | null
}

export interface ListFilters {
  formKey: string
  q?: string
  searchableKeys: string[]
  de?: string
  ate?: string
  fields: FieldFilter[]
}

export class FormSubmissionRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateSubmissionInput): Promise<SubmissionRow>
  async markNotified(id: string): Promise<void>
  async markNotifyFailed(id: string, error: string): Promise<void>
  async list(f: ListFilters, page: { limit: number; offset: number }): Promise<{ rows: SubmissionRow[]; total: number }>
  async listAll(f: ListFilters, max: number): Promise<SubmissionRow[]>
  async countByForm(): Promise<{ form_key: string; total: number; last_at: Date }[]>
}
```

O `WHERE` é montado por um helper privado compartilhado por `list` e `listAll`, para que a
exportação não divirja da tela:

```ts
  private buildWhere(f: ListFilters): { sql: string; params: unknown[] } {
    const parts = ['form_key = $1']
    const params: unknown[] = [f.formKey]
    if (f.q && f.searchableKeys.length > 0) {
      const ors = f.searchableKeys.map(k => {
        params.push(k, `%${f.q}%`)
        return `data->>$${params.length - 1} ILIKE $${params.length}`
      })
      parts.push(`(${ors.join(' OR ')})`)
    }
    if (f.de) { params.push(f.de); parts.push(`created_at >= $${params.length}::date`) }
    // `ate` inclui o dia inteiro: comparar com a data crua cortaria tudo que chegou depois de 00h00.
    if (f.ate) { params.push(f.ate); parts.push(`created_at < ($${params.length}::date + interval '1 day')`) }
    for (const ff of f.fields) {
      params.push(ff.key, ff.value)
      parts.push(`data->>$${params.length - 1} = $${params.length}`)
    }
    return { sql: `WHERE ${parts.join(' AND ')}`, params }
  }
```

`create` grava o IP com `$3::inet` e recebe `null` quando o endereço não parseia (ver Step 3).

- [ ] **Step 3: Service**

`server/modules/forms/forms.service.ts`. Regras que precisam estar exatamente assim:

```ts
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/
const IPV6 = /^[0-9a-f:]+$/i

/**
 * A coluna é `inet`: valor que não é endereço derruba a inserção. O código antigo caía na string
 * 'unknown' quando não descobria a origem — perder a origem nunca pode custar o pedido.
 */
export function normalizeIp(raw: string | undefined): string | null {
  if (!raw) return null
  const ip = raw.replace(/^::ffff:/, '')
  return IPV4.test(ip) || IPV6.test(ip) ? ip : null
}
```

`submit(formKey, body, ip, userAgent)`:
1. `findForm(formKey)`; ausente → `NotFoundError('Formulário não encontrado.')`.
2. `buildSubmissionSchema(def).safeParse(body)`; falhou → `ValidationError` com `fieldErrors`.
3. Sanitiza cada valor com `sanitize` (`server/lib/sanitize.ts:1`) e descarta `honeypot`.
4. `repository.create(...)` → devolve a linha.
5. Retorna a linha. **A notificação não acontece aqui.**

`notifyInBackground(def, row)` — chamada pelo controller **depois** de responder:
```ts
  if (!def.notify) return
  try {
    await sendMail({ to: def.notify.to, subject: def.notify.subject, text: buildNotifyBody(def, row) })
    await this.repository.markNotified(row.id)
  } catch (e) {
    await this.repository.markNotifyFailed(row.id, String((e as Error).message).slice(0, 300))
  }
```
`sendMail` (`server/lib/mail.ts:62`) já resolve a configuração banco→env e aplica o destinatário
padrão quando `to` é `undefined`.

`list(formKey, query)` → `paginate(rows, total, query)` de `server/core/pagination.ts:26`.
`exportCsv(formKey, query)` → `toCsv(def, await repository.listAll(filters, 10_000))`.
`catalogSummary()` → `FORMS.map(toPublicDefinition)` cruzado com `countByForm()`.
`validateCatalogOrDie()` → `validateCatalog(FORMS)`.

- [ ] **Step 4: Corpo do aviso**

`server/modules/forms/forms.mail.ts` — `buildNotifyBody(def, row)` devolve texto simples: uma linha
`Rótulo: valor` por campo da definição, na ordem, mais a data de recebimento. Genérico: serve
qualquer formulário sem alteração.

- [ ] **Step 5: Controller e rotas**

`forms.controller.ts` — métodos como *arrow properties* (o padrão do projeto, para não perder o
`this` ao passar como handler). No `submit`: responde `{ success: true }` e **só então** dispara
`notifyInBackground`, cujo erro nunca vira erro HTTP.

`forms.routes.ts`:

```ts
const limiter = rateLimit({ maxRequests: 5, windowMs: 60_000 })

export function makeFormsPublicRoutes(controller: FormsController): Router {
  const r = Router()
  r.post('/:formKey', rateLimitMiddleware(limiter), wrap(controller.submit))
  return r
}

export function makeFormsAdminRoutes(
  controller: FormsController,
  requireAuth: RequestHandler,
  requirePermission: (key: string) => RequestHandler,
): Router {
  const r = Router()
  const read = requirePermission('forms:read')
  const exportar = requirePermission('forms:export')
  r.get('/formularios', wrap(requireAuth), read, wrap(controller.catalog))
  r.get('/formularios/:formKey/submissoes', wrap(requireAuth), read, wrap(controller.list))
  r.get('/formularios/:formKey/submissoes.csv', wrap(requireAuth), exportar, wrap(controller.exportCsv))
  return r
}
```

O `wrap` é o mesmo helper de `server/modules/media/media.routes.ts:8`.

Na exportação, o controller define os cabeçalhos antes de escrever:
```ts
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${def.key}-${hoje}.csv"`)
```

- [ ] **Step 6: Ligar no container e no servidor**

Em `server/container.ts`, seguindo o padrão das linhas 88-98:

```ts
const formsRepository = new FormSubmissionRepository(pool)
const formsService = new FormsService(formsRepository)
const formsController = new FormsController(formsService)
export const formsPublicRoutes = makeFormsPublicRoutes(formsController)
export const formsAdminRoutes = makeFormsAdminRoutes(formsController, requireAuth, requirePermission)
export { formsService }
```

Em `server/index.ts`: importar `formsPublicRoutes`, `formsAdminRoutes` e `formsService` do container;
montar `app.use('/api/formularios', formsPublicRoutes)` e `app.use('/api/admin', formsAdminRoutes)`
junto das demais (linhas 96-106); e chamar `formsService.validateCatalogOrDie()` no bootstrap,
**antes** de o servidor passar a escutar.

- [ ] **Step 7: Verificar que o servidor sobe e a migration aplica**

Run: `npx tsx --env-file=.env.dev.local server/index.ts`
Expected: log `[migrations] aplicada: 007_form_submissions.sql` e o servidor escutando na 3001, sem
erro de catálogo.

- [ ] **Step 8: Provar a via de entrada**

```bash
curl -s -X POST localhost:3001/api/formularios/estudos-biblicos \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Maria Teste","telefone":"11999998888","email":"m@t.com","horario":"Manhã","honeypot":""}'
```
Expected: `{"success":true}`, e a linha presente em `form_submissions`.

- [ ] **Step 9: Commitar**

Título: `feat(formulários): submissão gravada antes do aviso, com listagem e exportação`

---

## Task 3 — Painel: índice, listagem, filtros e exportação

**Files:**
- Create: `src/painel/ui/FilterBar.tsx`
- Create: `src/painel/forms-api.ts`
- Create: `src/painel/pages/Formularios.tsx`
- Create: `src/painel/pages/FormularioSubmissoes.tsx`
- Modify: `src/painel/ui/index.ts`
- Modify: `src/painel/nav-config.tsx`
- Modify: `src/App.tsx`
- Modify: `docs/patterns/area-administrativa-visual.md`

**Interfaces:**
- Consumes: `GET /api/admin/formularios`, `GET /api/admin/formularios/:formKey/submissoes`,
  `GET /api/admin/formularios/:formKey/submissoes.csv` (Task 2).
- Produces: rotas `/painel/formularios` e `/painel/formularios/:formKey`; `FilterBar` no kit.

- [ ] **Step 1: `FilterBar` no kit**

`src/painel/ui/FilterBar.tsx` — superfície branca `rounded-xl shadow-sm` como o `Card`, campos em
`grid gap-4` que vira coluna no celular, e a ação de limpar à direita, renderizada **só quando há
filtro ativo** (elemento que aparece e desloca o resto faz errar o clique — então ele ocupa o mesmo
lugar sempre, com visibilidade alternada).

```tsx
import type { ReactNode } from 'react'

/**
 * Faixa de filtros de uma listagem. O botão de limpar ocupa o mesmo lugar sempre e só troca de
 * visibilidade: elemento que aparece e desloca o resto faz a pessoa errar o clique.
 */
export default function FilterBar(
  { children, active = false, onClear }: { children: ReactNode; active?: boolean; onClear?: () => void },
) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <div className="flex items-end gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 flex-1">{children}</div>
        <button
          type="button"
          onClick={onClear}
          className={`text-sm text-gray-500 hover:text-iasd-accent transition-colors shrink-0 pb-2 ${
            active ? '' : 'invisible'
          }`}
        >
          Limpar
        </button>
      </div>
    </section>
  )
}
```

Exportar em `src/painel/ui/index.ts` e documentar na tabela de componentes de
`docs/patterns/area-administrativa-visual.md`. **Nenhum valor de espaçamento fora da escala do
projeto** (`gap-4`, `gap-6`, `space-y-6`).

- [ ] **Step 2: Cliente da API**

`src/painel/forms-api.ts`. O ponto que não pode ser simplificado é o download:

```ts
/**
 * O download NÃO pode ser um <a href> para a rota: o cookie de sessão dura ~15 min e a renovação só
 * acontece dentro do adminFetch (api-core.ts:36-44). Uma tela aberta há mais tempo entregaria um
 * JSON de erro no lugar da planilha.
 */
export async function baixarCsv(formKey: string, params: URLSearchParams): Promise<void> {
  const res = await adminFetch(`/formularios/${formKey}/submissoes.csv?${params}`)
  if (!res.ok) throw new Error('Não foi possível exportar.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeDoArquivo(res.headers.get('Content-Disposition')) ?? `${formKey}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 3: Índice de formulários**

`src/painel/pages/Formularios.tsx`: `PageHeader` "Formulários" + `grid gap-6 md:grid-cols-2` de
`Card`s (nome, descrição, total de envios, data do último), cartão inteiro linkando para
`/painel/formularios/<chave>`. `Spinner` enquanto carrega; `EmptyState` se o catálogo vier vazio.

- [ ] **Step 4: Tela de submissões**

`src/painel/pages/FormularioSubmissoes.tsx`. Ordem de cima para baixo — **esta é a composição
aprovada, não improvise outra**:

1. `PageHeader` — título = `label` do formulário; subtítulo = descrição + total; `actions` = um único
   `Button` **Exportar CSV**, renderizado só com `forms:export` (`hasPermission` do contexto de auth).
2. `FilterBar` — `Input` de busca (o mais largo), `Input type="date"` de e até, e um `Select` por
   campo `choice` da definição, com `<option value="">Todos</option>` na frente. Um formulário sem
   campo de escolha mostra só busca e período.
3. `Table` — `Recebido em` + os campos com `inList` + `Aviso` (`Badge`) + ícone de detalhe.
4. `Pager`.

Estado dos filtros em `useSearchParams` (não em `useState`): recarregar, voltar e compartilhar o link
preservam o filtro, e a exportação reaproveita **os mesmos parâmetros**.

**Detalhe:** `Modal title={def.label} size="lg"` com pares rótulo/valor na ordem da definição, e
rodapé discreto com recebido em, situação do aviso e endereço de origem.

**Os quatro estados, todos obrigatórios:**

| Estado | O que aparece |
|---|---|
| Carregando | `Spinner` centralizado no lugar da tabela — nunca o vazio piscando antes |
| Vazio, sem filtro | `EmptyState title="Nenhum envio ainda"` com descrição dizendo que os envios do site aparecem aqui |
| Vazio, por filtro | `EmptyState title="Nenhum envio corresponde ao filtro"` + `action` que limpa |
| Erro | `Alert` de erro acima da tabela |

- [ ] **Step 5: Navegação e rotas**

`src/painel/nav-config.tsx` — uma entrada, antes de Configurações:

```tsx
  { key: 'formularios', label: 'Formulários', icon: icon(I.forms), to: '/painel/formularios', perm: 'forms:read' },
```
com `forms` acrescentado ao objeto `I` (traço de ícone no estilo dos existentes: prancheta).

`src/App.tsx` — duas rotas dentro do bloco `/painel`, no padrão da linha 70:

```tsx
          <Route path="formularios" element={<RequirePermission perm="forms:read"><Formularios /></RequirePermission>} />
          <Route path="formularios/:formKey" element={<RequirePermission perm="forms:read"><FormularioSubmissoes /></RequirePermission>} />
```

- [ ] **Step 6: Conferir a tela medindo, não olhando**

Run: `npm run dev` (Vite :5173, com `npm run dev:server` no ar) e, no navegador autenticado:
- `/painel/formularios` lista Estudos Bíblicos com o total certo;
- filtrar, recarregar a página e confirmar que o filtro voltou igual;
- comparar no DOM o espaçamento entre grupos e entre campos da `FilterBar` — o de fora tem de ser
  visivelmente maior que o de dentro;
- exportar e abrir o arquivo.

- [ ] **Step 7: Commitar**

Título: `feat(painel): tela de submissões com filtro, detalhe e exportação`

---

## Task 4 — Migrar o formulário existente e limpar

**Files:**
- Modify: `src/components/EstudosBiblicos.tsx`
- Modify: `server/index.ts` (remover o bloco de `/api/contato`, linhas 30-61)
- Modify: `server/lib/mail.ts` (remover `sendContatoEmail`, linha 80 até o fim da função)
- Modify: `__tests__/lib/mail.test.ts` (remover o `describe('sendContatoEmail')`, linhas 38-45)
- Modify: `CLAUDE.md`
- Delete: `server/lib/schemas.ts`, `src/schemas/contato.ts`, `__tests__/schemas/contato.test.ts`

**Interfaces:**
- Consumes: `POST /api/formularios/estudos-biblicos` (Task 2).
- Produces: nada.

- [ ] **Step 1: Apontar o formulário para a rota nova**

Em `src/components/EstudosBiblicos.tsx`, trocar `fetch('/api/contato', ...)` por
`fetch('/api/formularios/estudos-biblicos', ...)`. O schema Zod do cliente sai de
`@/schemas/contato` e passa a ser declarado no próprio componente — a validação que vale é a do
servidor, derivada da definição; a do cliente existe só para mostrar o erro junto do campo.

- [ ] **Step 2: Confirmar o envio ponta a ponta antes de remover o caminho antigo**

Preencher o formulário no site rodando e confirmar a linha nova na tela do painel. **Só depois
seguir.** Remover o caminho antigo antes disso deixaria o site sem via de envio se algo estiver
errado.

- [ ] **Step 3: Remover o caminho antigo**

Apagar de `server/index.ts` o handler de `/api/contato` (linhas 30-61) e os imports que ficam órfãos
(`contatoSchema`, `sendContatoEmail`, e `sanitize`/`rateLimit` **apenas se** nenhum outro ponto do
arquivo os usar — conferir antes com `grep -n`). Apagar `server/lib/schemas.ts`,
`src/schemas/contato.ts` e `__tests__/schemas/contato.test.ts`, e remover `sendContatoEmail` de
`server/lib/mail.ts` junto com o bloco que o cobre em `__tests__/lib/mail.test.ts:38-45`.

- [ ] **Step 4: Suíte inteira verde**

Run: `npm test`
Expected: PASS, sem nenhum arquivo referenciando `contatoSchema` ou `sendContatoEmail`.
Conferir com: `grep -rn "contatoSchema\|sendContatoEmail\|api/contato" server src __tests__`
Expected: nenhum resultado.

- [ ] **Step 5: Atualizar o CLAUDE.md**

Três pontos:
1. Em **Stack**, trocar a linha do formulário: a submissão vai para o Postgres e o e-mail é aviso.
2. Em **Convenções de código**, substituir "Schemas Zod são duplicados" (que deixa de valer) e
   "Sem suíte de testes ativa" (que está errado — há cinco arquivos sob Jest, e agora `npm test`).
3. Seção nova descrevendo o motor: onde fica o catálogo, e que **criar formulário novo é escrever um
   arquivo em `server/modules/forms/catalog/` e uma linha em `catalog/index.ts`** — a tela do painel
   não é tocada.

- [ ] **Step 6: Rodar o roteiro de verificação manual da spec (§11) inteiro**

Os dez itens. É o gate da entrega.

- [ ] **Step 7: Commitar**

Título: `refactor(formulários): Estudos Bíblicos passa a entrar pelo motor`

---

## Execução

### Níveis

| Nível | O que roda aqui |
|---|---|
| **sessão** | Uma só. As quatro tasks são sequenciais (2 depende de 1, 3 de 2, 4 de 3) — não há trabalho paralelo a isolar. |
| **agente principal** | Decisões, `git` (nenhum subagente roda git), revisão dos diffs, e os arquivos de dono compartilhado: `server/container.ts`, `server/index.ts`, `src/App.tsx`, `src/painel/nav-config.tsx`, `src/painel/ui/index.ts`, `server/seed/permissions.catalog.ts`, `package.json`. |
| **subagente** | Uma task por subagente, com o contrato de retorno abaixo. A execução da suíte vai sempre para o subagente de teste — saída de Jest não entra no contexto de quem escreve o código. |

### A conta do fatiamento

Feita para ninguém "otimizar" depois em nenhuma das duas direções. São ~33 arquivos alterados.

| Arranjo | Pacotes | Arquivos/pacote | Avaliação |
|---|---:|---:|---|
| Um pacote por arquivo | 33 | 1 | Piso de subagente (~27k) pago 33 vezes; a releitura não compensa nada |
| **Quatro pacotes** | **4** | **8–10** | **Dentro da faixa de menor custo por arquivo (6–10)** |
| Um pacote só | 1 | 33 | Releitura acumulada: o passo final custa ~2,6× o inicial |

Overhead: ~36k de sessão + 4 × ~27k = **~144k**, contra ~36k inline. O que justifica pagar é o
contexto do principal, que é o único que não se recicla: saída de suíte, tentativa e erro e leitura
de arquivo ficam fora dele.

### Contrato de retorno de cada subagente

1. pacotes concluídos;
2. arquivos tocados — **caminhos, nunca conteúdo**;
3. suíte: quantos verdes e os nomes que falharam;
4. decisões que teve de tomar sozinho, uma linha cada;
5. pendências.

Sem diff colado, sem trecho de arquivo, sem recapitular a spec.

### Restrição de subida (a decisão de calendário não é deste plano)

A migration `007` precisa estar aplicada antes de o código novo atender — o runner faz isso sozinho
no boot (`server/core/db.ts:49`). Não há passo manual pós-deploy, e nada aqui exige coordenação com
outra entrega.

---

## ONDE FICA

```
- handler antigo do formulário, a remover     server/index.ts:30-61
- montagem das rotas de API                   server/index.ts:96-106
- catch-all da SPA (rotas de API vêm antes)   server/index.ts:153
- envio de e-mail (sendMail, config banco→env) server/lib/mail.ts:62-74
- sendContatoEmail, a remover                 server/lib/mail.ts:80
- sanitização de entrada                      server/lib/sanitize.ts:1
- limitador por IP                            server/lib/rate-limit.ts:11,15
- contrato de paginação                       server/core/pagination.ts:5,20,26
- hierarquia de erros                         server/core/errors.ts:11-21
- runner de migrations (ordem alfabética)     server/core/db.ts:40,49
- seed religa permissões do admin a cada boot server/seed/seed.ts:15
- catálogo de permissões                      server/seed/permissions.catalog.ts
- padrão de rotas de módulo (wrap, guards)    server/modules/media/media.routes.ts:8,33-45
- padrão de repository (list + count)         server/modules/media/media.repository.ts:44-58
- composição das rotas no container           server/container.ts:88-99
- renovação de sessão em 401 (afeta o CSV)    src/auth/api-core.ts:36-44
- cliente autenticado do painel               src/painel/admin-api.ts:4
- guarda de permissão na tela                 src/auth/RequirePermission.tsx:5
- rotas do painel                             src/App.tsx:67-80
- menu lateral                                src/painel/nav-config.tsx
- kit de UI (índice)                          src/painel/ui/index.ts
- listagem de referência (tabela + pager)     src/painel/pages/UsuariosLista.tsx:36-46,60-105
- assinaturas: Field/Input/Select             src/painel/ui/Field.tsx:6,16,22
- assinaturas: EmptyState / Pager / Modal     src/painel/ui/EmptyState.tsx:4 · components/Pager.tsx:3 · components/Modal.tsx:7
- formulário público a migrar                 src/components/EstudosBiblicos.tsx:26,7
- testes que quebram com a limpeza            __tests__/schemas/contato.test.ts · __tests__/lib/mail.test.ts:38-45
- conferido em                                8698039
```
