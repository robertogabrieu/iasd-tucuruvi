# Eventos com vários horários — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um evento passa a ter uma programação de vários horários (sexta 20h, sábado 9h30, sábado 16h30), cada um com nome e frase próprios, numa página só e num link só.

**Architecture:** Tabela `evento_sessoes` ligada ao evento, gravada por substituição integral dentro de uma transação; as colunas de data do evento viram cache derivado da primeira e da última sessão. Toda leitura de evento passa a carregar a programação. As funções puras de resumo e agrupamento vivem duplicadas em `src/lib/` e `server/core/`, como já acontece com as cores do evento.

**Tech Stack:** TypeScript, Express 5, PostgreSQL 16 (`pg`), Zod, React 18 + Vite, Tailwind, Jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-09-12-eventos-sessoes-design.md`
**Mockup aprovado:** `docs/superpowers/specs/2026-09-12-eventos-sessoes-mockup.html` — em caso de divergência com o texto, o mockup vence.

## Global Constraints

- **Fuso da igreja em todo cálculo de data:** `America/Sao_Paulo`. O servidor roda em UTC (nem o `docker-compose.yml` nem o `Dockerfile` definem `TZ`), então toda formatação de dia, intervalo e agrupamento passa `timeZone` explícito.
- **Limite do resumo da programação: 36 caracteres.** É o que a linha do "quando" comporta nas artes geradas.
- **De 1 a 20 sessões por evento.** Piso e teto validados no schema de entrada.
- **Imports internos do backend usam sufixo `.js`** mesmo em arquivos `.ts` (ESM em produção).
- **Path alias do frontend:** `@/*` → `src/*`.
- **Testes:** `npx jest __tests__/eventos/<arquivo> --runInBand` — a máquina tem RAM limitada; nunca rodar a suíte inteira nem dois comandos pesados ao mesmo tempo.
- **Componentes do painel saem do kit** `src/painel/ui/` (`Field`, `Input`, `Button`, `Card`). Não montar botão nem cartão com Tailwind solto.
- **Nenhuma rota nova.** A programação viaja dentro do evento.

---

## Estrutura de arquivos

**Criar**
- `server/migrations/009_evento_sessoes.sql` — tabela, índices, `CHECK`, migração dos eventos existentes.
- `src/lib/programacao.ts` — funções puras: resumo em cascata, agrupamento por dia, primeira/última/próxima sessão, faixa de horário.
- `server/core/programacao.ts` — espelho do anterior para o servidor (mesma convenção de `src/lib/cores.ts` ↔ `server/core/cores.ts`).
- `src/painel/pages/evento/SessoesDoEvento.tsx` — a lista de horários do formulário.
- `src/components/evento/EventoProgramacao.tsx` — o cartão "Programação" da página pública.
- `__tests__/eventos/programacao.test.ts` — cobertura das funções puras.

**Modificar**
- `server/modules/eventos/eventos.repository.ts` — leitura e gravação das sessões, derivadas, consultas novas.
- `server/modules/eventos/eventos.service.ts` — transação, concorrência, sessões em toda leitura.
- `server/modules/eventos/eventos.publish-rules.ts` — regras da programação.
- `server/modules/eventos/dto/evento.dto.ts` e `src/schemas/evento.ts` — schema da sessão; saída de `startsAt`/`endsAt` da escrita.
- `server/modules/eventos/eventos.image.ts` — resumo na arte.
- `src/components/evento/evento-ics.ts` — um `VEVENT` por sessão.
- `src/components/evento/EventoRenderer.tsx` e `EventoHero.tsx` — cartão novo, ordem, link, textos.
- `src/pages/Eventos.tsx` — cartão da lista pública.
- `src/painel/eventos-api.ts` — conversão de fuso por sessão, mapa de pendências, resumo.
- `src/painel/pages/EventoEditor.tsx` — cartão "Quando e onde".
- `src/painel/pages/EventosLista.tsx` — contagem de horários.
- `CLAUDE.md` — parágrafo de Eventos.

---

## Task 1: Funções puras da programação

**Files:**
- Create: `src/lib/programacao.ts`
- Create: `__tests__/eventos/programacao.test.ts`
- Test: `__tests__/eventos/programacao.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface Sessao { id: string; startsAt: string; endsAt: string | null; title: string | null; description: string | null }`
  - `primeiraSessao(s: Sessao[]): Sessao | null`
  - `ultimaSessao(s: Sessao[]): Sessao | null`
  - `proximaSessaoPendente(s: Sessao[], agora: Date): Sessao | null`
  - `resumoDaProgramacao(s: Sessao[]): string`
  - `agruparPorDia(s: Sessao[]): GrupoDeDia[]`, com `interface GrupoDeDia { dia: string; rotulo: string; sessoes: Sessao[] }`
  - `faixaDeHorario(startsAt: string, endsAt: string | null): string`
  - `LIMITE_RESUMO = 36`

- [ ] **Step 1: Escrever os testes que falham**

Criar `__tests__/eventos/programacao.test.ts`:

```ts
import {
  LIMITE_RESUMO, agruparPorDia, faixaDeHorario, primeiraSessao,
  proximaSessaoPendente, resumoDaProgramacao, ultimaSessao, type Sessao,
} from '../../src/lib/programacao'

let n = 0
function sessao(startsAt: string, endsAt: string | null = null, title: string | null = null): Sessao {
  return { id: `s${++n}`, startsAt, endsAt, title, description: null }
}

// Horários em UTC; 19h30 em São Paulo é 22h30 UTC.
const SEX_20H = '2027-03-13T23:00:00.000Z'
const SEX_2130 = '2027-03-14T00:30:00.000Z'
const SAB_930 = '2027-03-14T12:30:00.000Z'
const SAB_1630 = '2027-03-14T19:30:00.000Z'

describe('primeira, última e próxima', () => {
  it('devolve a primeira e a última em ordem cronológica, mesmo fora de ordem na entrada', () => {
    const lista = [sessao(SAB_1630), sessao(SEX_20H), sessao(SAB_930)]
    expect(primeiraSessao(lista)!.startsAt).toBe(SEX_20H)
    expect(ultimaSessao(lista)!.startsAt).toBe(SAB_1630)
  })

  it('devolve nulo para programação vazia', () => {
    expect(primeiraSessao([])).toBeNull()
    expect(ultimaSessao([])).toBeNull()
  })

  it('a próxima pendente ignora o que já terminou e mantém o que está acontecendo', () => {
    const lista = [sessao(SEX_20H, SEX_2130), sessao(SAB_930), sessao(SAB_1630)]
    // Sábado de manhã, 10h de São Paulo: a de 9h30 não tem término, então já passou.
    expect(proximaSessaoPendente(lista, new Date('2027-03-14T13:00:00.000Z'))!.startsAt).toBe(SAB_1630)
    // Sexta 21h: a de 20h ainda está acontecendo, porque termina 21h30.
    expect(proximaSessaoPendente(lista, new Date('2027-03-14T00:00:00.000Z'))!.startsAt).toBe(SEX_20H)
    // Depois de tudo.
    expect(proximaSessaoPendente(lista, new Date('2027-03-15T00:00:00.000Z'))).toBeNull()
  })
})

describe('resumoDaProgramacao', () => {
  it('um horário mantém o dia da semana e a hora', () => {
    expect(resumoDaProgramacao([sessao('2026-09-26T22:30:00.000Z')]))
      .toBe('Sábado, 26 de setembro · 19h30')
  })

  it('até três no mesmo dia mostram as horas', () => {
    const lista = [
      sessao('2026-09-26T12:30:00.000Z'), // 9h30
      sessao('2026-09-26T17:00:00.000Z'), // 14h
      sessao('2026-09-26T22:30:00.000Z'), // 19h30
    ]
    expect(resumoDaProgramacao(lista)).toBe('26 de setembro · 9h30, 14h e 19h30')
  })

  it('quatro ou mais no mesmo dia trocam as horas pela contagem', () => {
    const lista = ['09:00', '12:00', '15:00', '18:00'].map(h => sessao(`2026-09-26T${h}:00.000Z`))
    expect(resumoDaProgramacao(lista)).toBe('26 de setembro · 4 horários')
  })

  it('dois dias do mesmo mês usam "e"', () => {
    expect(resumoDaProgramacao([sessao(SEX_20H), sessao(SAB_930), sessao(SAB_1630)]))
      .toBe('13 e 14 de março · 3 horários')
  })

  it('três ou mais dias do mesmo mês usam "a"', () => {
    const lista = [
      sessao('2027-03-13T23:00:00.000Z'),
      sessao('2027-03-14T23:00:00.000Z'),
      sessao('2027-03-15T23:00:00.000Z'),
    ]
    expect(resumoDaProgramacao(lista)).toBe('13 a 15 de março · 3 horários')
  })

  it('meses diferentes abreviam o mês', () => {
    const lista = [
      sessao('2027-02-27T23:00:00.000Z'),
      sessao('2027-03-01T23:00:00.000Z'),
      sessao('2027-03-02T23:00:00.000Z'),
    ]
    expect(resumoDaProgramacao(lista)).toBe('27 de fev a 2 de mar · 3 horários')
  })

  it('nenhuma forma passa do limite que cabe na arte', () => {
    const casos: Sessao[][] = [
      [sessao('2026-09-26T22:30:00.000Z')],
      [sessao('2026-09-26T12:30:00.000Z'), sessao('2026-09-26T17:00:00.000Z'), sessao('2026-09-26T22:30:00.000Z')],
      [sessao(SEX_20H), sessao(SAB_930), sessao(SAB_1630)],
      [sessao('2027-02-27T23:00:00.000Z'), sessao('2027-03-02T23:00:00.000Z')],
      Array.from({ length: 20 }, (_, i) => sessao(`2027-11-${String(i + 1).padStart(2, '0')}T23:00:00.000Z`)),
    ]
    for (const caso of casos) {
      expect(resumoDaProgramacao(caso).length).toBeLessThanOrEqual(LIMITE_RESUMO)
    }
  })

  it('programação vazia devolve texto vazio', () => {
    expect(resumoDaProgramacao([])).toBe('')
  })
})

describe('fuso da igreja', () => {
  it('sessão das 21h de sexta não vira sábado', () => {
    // 21h em São Paulo = 00h UTC do dia seguinte.
    const noturna = [sessao('2027-03-14T00:00:00.000Z')]
    expect(resumoDaProgramacao(noturna)).toBe('Sábado, 13 de março · 21h')
    expect(agruparPorDia(noturna)[0].rotulo).toBe('Sábado, 13 de março')
  })
})

describe('agruparPorDia', () => {
  it('junta os horários do mesmo dia, em ordem, e mantém os dias em ordem', () => {
    const grupos = agruparPorDia([sessao(SAB_1630), sessao(SEX_20H), sessao(SAB_930)])
    expect(grupos.map(g => g.rotulo)).toEqual(['Sexta, 13 de março', 'Sábado, 14 de março'])
    expect(grupos[1].sessoes.map(s => s.startsAt)).toEqual([SAB_930, SAB_1630])
  })
})

describe('faixaDeHorario', () => {
  it('mostra só o início quando não há término', () => {
    expect(faixaDeHorario(SAB_930, null)).toBe('9h30')
  })

  it('mostra início e fim quando há término no mesmo dia', () => {
    expect(faixaDeHorario(SEX_20H, SEX_2130)).toBe('20h às 21h30')
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx jest __tests__/eventos/programacao.test.ts --runInBand`
Expected: FAIL — `Cannot find module '../../src/lib/programacao'`.

- [ ] **Step 3: Implementar**

Criar `src/lib/programacao.ts`:

```ts
/**
 * As contas da programação de um evento — resumo de uma linha, agrupamento por dia e
 * qual sessão vem a seguir. Tudo no fuso da igreja: o servidor roda em UTC, e um culto
 * de sexta às 21h cairia no sábado se a formatação usasse o fuso do processo.
 *
 * ESPELHO: server/core/programacao.ts — manter em sincronia (mesma convenção de cores.ts).
 */

export const FUSO = 'America/Sao_Paulo'

/** O que a linha do "quando" comporta nas artes geradas, pela métrica de eventos.image.styles.ts. */
export const LIMITE_RESUMO = 36

export interface Sessao {
  id: string
  startsAt: string
  endsAt: string | null
  title: string | null
  description: string | null
}

export interface GrupoDeDia {
  /** O dia civil em São Paulo, como "2027-03-14" — chave de agrupamento e de React. */
  dia: string
  /** "Sexta, 13 de março" */
  rotulo: string
  sessoes: Sessao[]
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function fmt(opcoes: Intl.DateTimeFormatOptions, locale = 'pt-BR'): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { timeZone: FUSO, ...opcoes })
}

function comMaiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** O dia civil em São Paulo ("2027-03-14"), que é o que decide a que dia a sessão pertence. */
export function diaCivil(iso: string): string {
  return fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }, 'sv-SE').format(new Date(iso))
}

/** "9h30", "14h" — o relógio da igreja, sem minutos quando são zero. */
export function hora(iso: string): string {
  const texto = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  const [h, m] = texto.split(':')
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`
}

/** "19h30 às 22h00", e com a data junto quando a vigília vira a noite. */
export function faixaDeHorario(startsAt: string, endsAt: string | null): string {
  if (!endsAt) return hora(startsAt)
  const fim = diaCivil(endsAt) === diaCivil(startsAt)
    ? hora(endsAt)
    : `${fmt({ day: '2-digit', month: '2-digit' }).format(new Date(endsAt))}, ${hora(endsAt)}`
  return `${hora(startsAt)} às ${fim}`
}

function emOrdem(sessoes: Sessao[]): Sessao[] {
  return [...sessoes].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export function primeiraSessao(sessoes: Sessao[]): Sessao | null {
  return emOrdem(sessoes)[0] ?? null
}

export function ultimaSessao(sessoes: Sessao[]): Sessao | null {
  const ordenadas = emOrdem(sessoes)
  return ordenadas[ordenadas.length - 1] ?? null
}

/** O fim de uma sessão, com recuo para o início quando ninguém publicou hora de encerrar. */
function fimDe(s: Sessao): string {
  return s.endsAt ?? s.startsAt
}

export function proximaSessaoPendente(sessoes: Sessao[], agora: Date): Sessao | null {
  return emOrdem(sessoes).find(s => new Date(fimDe(s)).getTime() >= agora.getTime()) ?? null
}

export function agruparPorDia(sessoes: Sessao[]): GrupoDeDia[] {
  const grupos = new Map<string, GrupoDeDia>()
  for (const s of emOrdem(sessoes)) {
    const dia = diaCivil(s.startsAt)
    const grupo = grupos.get(dia) ?? {
      dia,
      rotulo: comMaiuscula(fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(s.startsAt))),
      sessoes: [],
    }
    grupo.sessoes.push(s)
    grupos.set(dia, grupo)
  }
  return [...grupos.values()]
}

function diaEMes(iso: string): { dia: number; mes: number } {
  const partes = diaCivil(iso).split('-').map(Number)
  return { mes: partes[1], dia: partes[2] }
}

function mesPorExtenso(iso: string): string {
  return fmt({ month: 'long' }).format(new Date(iso))
}

/**
 * O resumo de uma linha, montado em cascata: vale a forma mais informativa que cabe em
 * LIMITE_RESUMO. As horas ficam enquanto couberem — é o que faz alguém decidir se dá para ir,
 * e a arte gerada é o que a maioria vê, sem abrir o link.
 */
export function resumoDaProgramacao(sessoes: Sessao[]): string {
  const ordenadas = emOrdem(sessoes)
  if (ordenadas.length === 0) return ''

  const candidatas: string[] = []
  const dias = [...new Set(ordenadas.map(s => diaCivil(s.startsAt)))]
  const primeira = ordenadas[0]
  const ultima = ordenadas[ordenadas.length - 1]
  const quantas = `${ordenadas.length} horários`

  if (ordenadas.length === 1) {
    const dia = comMaiuscula(fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(primeira.startsAt)))
    candidatas.push(`${dia} · ${hora(primeira.startsAt)}`)
  } else if (dias.length === 1) {
    const dia = `${diaEMes(primeira.startsAt).dia} de ${mesPorExtenso(primeira.startsAt)}`
    const horas = ordenadas.map(s => hora(s.startsAt))
    if (ordenadas.length <= 3) {
      candidatas.push(`${dia} · ${horas.slice(0, -1).join(', ')} e ${horas[horas.length - 1]}`)
    }
    candidatas.push(`${dia} · ${quantas}`)
  } else {
    const a = diaEMes(primeira.startsAt)
    const b = diaEMes(ultima.startsAt)
    const ligacao = dias.length === 2 ? 'e' : 'a'
    if (a.mes === b.mes) {
      candidatas.push(`${a.dia} ${ligacao} ${b.dia} de ${mesPorExtenso(primeira.startsAt)} · ${quantas}`)
    } else {
      candidatas.push(
        `${a.dia} de ${MESES_CURTOS[a.mes - 1]} a ${b.dia} de ${MESES_CURTOS[b.mes - 1]} · ${quantas}`,
      )
    }
  }

  const escolhida = candidatas.find(c => c.length <= LIMITE_RESUMO) ?? candidatas[candidatas.length - 1]
  // Rede: nenhuma forma deveria chegar aqui, mas texto que estoura é desenhado por cima da foto.
  return escolhida.length <= LIMITE_RESUMO ? escolhida : `${escolhida.slice(0, LIMITE_RESUMO - 1)}…`
}
```

- [ ] **Step 4: Rodar até passar**

Run: `npx jest __tests__/eventos/programacao.test.ts --runInBand`
Expected: PASS, 12 testes.

- [ ] **Step 5: Criar o espelho do servidor**

Copiar o arquivo para `server/core/programacao.ts`, mudando só o comentário do topo (`ESPELHO: src/lib/programacao.ts`). Sem imports internos, então não há sufixo `.js` a acrescentar.

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/lib/programacao.ts server/core/programacao.ts __tests__/eventos/programacao.test.ts
git commit -m "feat(eventos): as contas da programação de vários horários"
```

---

## Task 2: Migration da tabela de sessões

**Files:**
- Create: `server/migrations/009_evento_sessoes.sql`

**Interfaces:**
- Consumes: nada.
- Produces: tabela `evento_sessoes (id, evento_id, starts_at, ends_at, title, description, created_at)`.

- [ ] **Step 1: Escrever a migration**

Criar `server/migrations/009_evento_sessoes.sql`:

```sql
CREATE TABLE evento_sessoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  title       text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evento_sessoes_termino_depois CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_evento_sessoes_evento ON evento_sessoes (evento_id, starts_at);
CREATE UNIQUE INDEX idx_evento_sessoes_instante ON evento_sessoes (evento_id, starts_at);

-- Cada evento que já existe vira um evento de uma sessão só.
-- O CASE existe porque rascunho pode ter término anterior ao início: a regra só é cobrada
-- na publicação, e a tabela de eventos não tem restrição. Copiado como está, o dado violaria
-- o CHECK acima e a migration derrubaria o boot.
INSERT INTO evento_sessoes (evento_id, starts_at, ends_at)
SELECT id, starts_at, CASE WHEN ends_at > starts_at THEN ends_at END
FROM eventos;
```

- [ ] **Step 2: Rodar o servidor e verificar que a migration aplica**

Run: `docker compose up -d db && npm run dev:server`
Expected: o log do boot mostra `009_evento_sessoes` aplicada, sem erro. Parar o servidor depois (`Ctrl+C`).

- [ ] **Step 3: Conferir o dado migrado**

Run: `docker compose exec db psql -U postgres -d iasd -c "SELECT count(*) FROM eventos" -c "SELECT count(*) FROM evento_sessoes"`
Expected: as duas contagens iguais.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/009_evento_sessoes.sql
git commit -m "feat(eventos): tabela da programação, com os eventos de hoje migrados"
```

---

## Task 3: Schemas de entrada e saída

**Files:**
- Modify: `server/modules/eventos/dto/evento.dto.ts`
- Modify: `src/schemas/evento.ts`
- Create: `__tests__/eventos/sessoes-schema.test.ts`

**Interfaces:**
- Consumes: `Sessao` (Task 1) como forma de referência.
- Produces:
  - `sessaoInputSchema` — `{ startsAt: Date; endsAt: Date | null; title: string | null; description: string | null }`
  - `sessionsSchema` — array de 1 a 20, sem instantes repetidos
  - `EventoDTO.sessions: SessaoDTO[]`, com `SessaoDTO = { id, startsAt, endsAt, title, description }` (strings ISO)
  - `UpdateEventoDto.expectedUpdatedAt?: string`

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/eventos/sessoes-schema.test.ts`:

```ts
import { sessionsSchema } from '../../server/modules/eventos/dto/evento.dto'

const umaSessao = (startsAt: string, endsAt: string | null = null) => ({
  startsAt, endsAt, title: null, description: null,
})

describe('sessionsSchema', () => {
  it('aceita uma programação de um horário', () => {
    expect(sessionsSchema.safeParse([umaSessao('2027-03-13T23:00:00.000Z')]).success).toBe(true)
  })

  it('recusa programação vazia', () => {
    const r = sessionsSchema.safeParse([])
    expect(r.success).toBe(false)
    expect(JSON.stringify(r)).toContain('pelo menos um horário')
  })

  it('recusa mais de vinte horários', () => {
    const muitos = Array.from({ length: 21 }, (_, i) =>
      umaSessao(`2027-11-${String(i + 1).padStart(2, '0')}T23:00:00.000Z`))
    expect(sessionsSchema.safeParse(muitos).success).toBe(false)
  })

  it('recusa dois horários no mesmo instante, dizendo qual', () => {
    const r = sessionsSchema.safeParse([
      umaSessao('2027-03-14T12:30:00.000Z'),
      umaSessao('2027-03-14T12:30:00.000Z'),
    ])
    expect(r.success).toBe(false)
    expect(JSON.stringify(r)).toContain('2º horário')
  })

  it('recusa término anterior ao início', () => {
    const r = sessionsSchema.safeParse([
      umaSessao('2027-03-14T12:30:00.000Z', '2027-03-14T11:00:00.000Z'),
    ])
    expect(r.success).toBe(false)
    expect(JSON.stringify(r)).toContain('término precisa ser depois do início')
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx jest __tests__/eventos/sessoes-schema.test.ts --runInBand`
Expected: FAIL — `sessionsSchema` não existe.

- [ ] **Step 3: Implementar no DTO do servidor**

Em `server/modules/eventos/dto/evento.dto.ts`, acrescentar antes de `camposDoEvento`:

```ts
export const MAX_SESSOES = 20

export const sessaoInputSchema = z.object({
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().default(null),
  title: z.string().trim().max(120).nullable().default(null),
  description: z.string().trim().max(500).nullable().default(null),
})

/**
 * A programação inteira. O instante repetido também é barrado por índice único no banco —
 * aqui existe para dizer QUAL horário repetiu, que é o que a tela precisa para marcar o bloco.
 */
export const sessionsSchema = z.array(sessaoInputSchema)
  .min(1, 'Informe pelo menos um horário para o evento.')
  .max(MAX_SESSOES, `Um evento comporta no máximo ${MAX_SESSOES} horários.`)
  .superRefine((sessoes, ctx) => {
    const vistos = new Map<number, number>()
    sessoes.forEach((s, i) => {
      if (s.endsAt && s.endsAt.getTime() <= s.startsAt.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom, path: [i, 'endsAt'],
          message: `No ${i + 1}º horário, o término precisa ser depois do início.`,
        })
      }
      const instante = s.startsAt.getTime()
      const antes = vistos.get(instante)
      if (antes !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom, path: [i, 'startsAt'],
          message: `O ${i + 1}º horário é igual ao ${antes + 1}º.`,
        })
      } else {
        vistos.set(instante, i)
      }
    })
  })
```

No mesmo arquivo, **tirar `startsAt` e `endsAt` de `camposDoEvento`** (eles passam a ser derivados — §4.3 da spec) e acrescentar `sessions: sessionsSchema` como campo opcional em criar e editar. Em `updateEventoSchema`, acrescentar `expectedUpdatedAt: z.string().datetime().optional()`.

Na interface `EventoDTO` do mesmo arquivo, acrescentar:

```ts
export interface SessaoDTO {
  id: string
  startsAt: string
  endsAt: string | null
  title: string | null
  description: string | null
}
```
e o campo `sessions: SessaoDTO[]` (mantendo `startsAt`/`endsAt` na resposta, agora derivados).

- [ ] **Step 4: Espelhar no cliente**

Repetir as mesmas definições em `src/schemas/evento.ts`, que é o espelho declarado no topo do arquivo.

- [ ] **Step 5: Rodar até passar**

Run: `npx jest __tests__/eventos/sessoes-schema.test.ts --runInBand`
Expected: PASS, 5 testes.

- [ ] **Step 6: Commit**

```bash
git add server/modules/eventos/dto/evento.dto.ts src/schemas/evento.ts __tests__/eventos/sessoes-schema.test.ts
git commit -m "feat(eventos): a programação entra pelo schema do evento, com piso, teto e horário repetido"
```

---

## Task 4: Repositório — ler, gravar e derivar

**Files:**
- Modify: `server/modules/eventos/eventos.repository.ts`

**Interfaces:**
- Consumes: `SessaoDTO` (Task 3).
- Produces, na classe `EventosRepository`:
  - `sessoesDe(eventoIds: string[]): Promise<Map<string, SessaoRow[]>>`
  - `substituirSessoes(eventoId: string, sessoes: SessaoInput[], expectedUpdatedAt?: Date): Promise<EventoRow>` — grava a programação, recalcula `starts_at`/`ends_at` e devolve o evento; lança `ConflictError` se `expectedUpdatedAt` não bater
  - `listUpcomingPublished(): Promise<EventoRow[]>` — agora pela programação
  - `SessaoRow = { id: string; evento_id: string; starts_at: Date; ends_at: Date | null; title: string | null; description: string | null }`

- [ ] **Step 1: Acrescentar a leitura das sessões**

Em `server/modules/eventos/eventos.repository.ts`:

```ts
export interface SessaoRow {
  id: string
  evento_id: string
  starts_at: Date
  ends_at: Date | null
  title: string | null
  description: string | null
}

export interface SessaoInput {
  startsAt: Date
  endsAt: Date | null
  title: string | null
  description: string | null
}
```

E, na classe:

```ts
  /** A programação de vários eventos de uma vez, em ordem cronológica. */
  async sessoesDe(eventoIds: string[]): Promise<Map<string, SessaoRow[]>> {
    const mapa = new Map<string, SessaoRow[]>()
    if (eventoIds.length === 0) return mapa
    const r = await this.pool.query<SessaoRow>(
      `SELECT * FROM evento_sessoes WHERE evento_id = ANY($1::uuid[]) ORDER BY starts_at ASC`,
      [eventoIds],
    )
    for (const row of r.rows) {
      const lista = mapa.get(row.evento_id) ?? []
      lista.push(row)
      mapa.set(row.evento_id, lista)
    }
    return mapa
  }
```

- [ ] **Step 2: Acrescentar a gravação integral, em transação**

```ts
  /**
   * Substitui a programação inteira e recalcula as datas do evento, que são cache da
   * primeira e da última sessão (spec §4.3). Tudo numa transação: evento sem programação,
   * nem que por um instante, é estado que a listagem pública já enxergaria.
   */
  async substituirSessoes(
    eventoId: string, sessoes: SessaoInput[], expectedUpdatedAt?: Date,
  ): Promise<EventoRow> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      if (expectedUpdatedAt) {
        const atual = await client.query<{ updated_at: Date }>(
          'SELECT updated_at FROM eventos WHERE id = $1 FOR UPDATE', [eventoId],
        )
        if (atual.rows[0] && atual.rows[0].updated_at.getTime() !== expectedUpdatedAt.getTime()) {
          throw new ConflictError('Alguém salvou este evento antes de você. Recarregue a página.')
        }
      }

      await client.query('DELETE FROM evento_sessoes WHERE evento_id = $1', [eventoId])
      for (const s of sessoes) {
        await client.query(
          `INSERT INTO evento_sessoes (evento_id, starts_at, ends_at, title, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [eventoId, s.startsAt, s.endsAt, s.title, s.description],
        )
      }

      const ordenadas = [...sessoes].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      const primeira = ordenadas[0]
      const ultima = ordenadas[ordenadas.length - 1]

      const r = await client.query<EventoRow>(
        `UPDATE eventos SET starts_at = $1, ends_at = $2, updated_at = now()
         WHERE id = $3 RETURNING *`,
        [primeira.startsAt, ultima.endsAt, eventoId],
      )
      await client.query('COMMIT')
      return r.rows[0]
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
```

Importar `ConflictError` de `../../core/errors.js`. Se a hierarquia ainda não tiver essa classe, criar em `server/core/errors.ts` seguindo as irmãs (status 409) e traduzir no `error-handler.ts` como as demais.

- [ ] **Step 3: Trocar a consulta da lista pública**

Substituir o corpo de `listUpcomingPublished`:

```ts
  /**
   * Publicados que ainda têm horário por vir, ordenados pelo próximo horário pendente.
   * Ordenar por starts_at poria um evento que já começou à frente de tudo para sempre.
   */
  async listUpcomingPublished(): Promise<EventoRow[]> {
    const r = await this.pool.query<EventoRow>(
      `SELECT e.* FROM eventos e
       WHERE e.status = 'published'
         AND EXISTS (
           SELECT 1 FROM evento_sessoes s
           WHERE s.evento_id = e.id AND coalesce(s.ends_at, s.starts_at) >= now()
         )
       ORDER BY (
         SELECT min(s.starts_at) FROM evento_sessoes s
         WHERE s.evento_id = e.id AND coalesce(s.ends_at, s.starts_at) >= now()
       ) ASC, e.id ASC`,
    )
    return r.rows
  }
```

E, na `list` do painel, trocar o filtro de período pelo mesmo critério — `proximos` vira o `EXISTS` acima, `passados` vira `NOT EXISTS` —, para que as duas listas do sistema não discordem sobre um evento que está acontecendo.

- [ ] **Step 4: Verificar a compilação**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem erro.

- [ ] **Step 5: Commit**

```bash
git add server/modules/eventos/eventos.repository.ts server/core/errors.ts server/core/error-handler.ts
git commit -m "feat(eventos): programação gravada em transação, com as datas do evento derivadas dela"
```

---

## Task 5: Service e regras de publicação

**Files:**
- Modify: `server/modules/eventos/eventos.service.ts`
- Modify: `server/modules/eventos/eventos.publish-rules.ts`
- Modify: `__tests__/eventos/publish-rules.test.ts`

**Interfaces:**
- Consumes: `substituirSessoes`, `sessoesDe` (Task 4); `sessionsSchema` (Task 3).
- Produces: `EventoDTO.sessions` preenchido em toda leitura; `faltaParaPublicar(e: EventoDTO): string[]` cobrindo a programação.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `__tests__/eventos/publish-rules.test.ts` (o arquivo já tem um helper `evento()`; acrescentar `sessions: []` ao objeto base e depois estes casos):

```ts
  it('cobra a programação quando não há nenhum horário', () => {
    expect(faltaParaPublicar(evento({ sessions: [] })))
      .toContain('Informe pelo menos um horário para o evento.')
  })

  it('não cobra nada quando há um horário', () => {
    const comHorario = evento({
      sessions: [{ id: 's1', startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: null, description: null }],
    })
    expect(faltaParaPublicar(comHorario)).not.toContain('Informe pelo menos um horário para o evento.')
  })

  it('diz qual horário tem término antes do início', () => {
    const torto = evento({
      sessions: [
        { id: 's1', startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: null, description: null },
        { id: 's2', startsAt: '2027-03-14T12:30:00.000Z', endsAt: '2027-03-14T11:00:00.000Z', title: null, description: null },
      ],
    })
    expect(faltaParaPublicar(torto)).toContain('No 2º horário, o término precisa ser depois do início.')
  })
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx jest __tests__/eventos/publish-rules.test.ts --runInBand`
Expected: FAIL nos três casos novos.

- [ ] **Step 3: Trocar a regra de data pela regra de programação**

Em `server/modules/eventos/eventos.publish-rules.ts`, remover as duas linhas que hoje olham `startsAt`/`endsAt` e pôr:

```ts
  if (!e.sessions || e.sessions.length === 0) {
    falta.push('Informe pelo menos um horário para o evento.')
  }

  e.sessions?.forEach((s, i) => {
    if (s.endsAt && new Date(s.endsAt) <= new Date(s.startsAt)) {
      falta.push(`No ${i + 1}º horário, o término precisa ser depois do início.`)
    }
  })
```

- [ ] **Step 4: Rodar até passar**

Run: `npx jest __tests__/eventos/publish-rules.test.ts --runInBand`
Expected: PASS.

- [ ] **Step 5: Carregar as sessões em toda leitura do service**

Em `server/modules/eventos/eventos.service.ts`, `toDTO` passa a receber as sessões:

```ts
  private toDTO = (row: EventoRow, sessoes: SessaoRow[] = []): EventoDTO => ({
    // …campos de hoje…
    sessions: sessoes.map(s => ({
      id: s.id,
      startsAt: s.starts_at.toISOString(),
      endsAt: s.ends_at?.toISOString() ?? null,
      title: s.title,
      description: s.description,
    })),
  })

  /** Uma consulta de sessões para a lista inteira, não uma por evento. */
  private async comSessoes(rows: EventoRow[]): Promise<EventoDTO[]> {
    const mapa = await this.repo.sessoesDe(rows.map(r => r.id))
    return rows.map(r => this.toDTO(r, mapa.get(r.id) ?? []))
  }
```

Trocar **todos** os `this.toDTO(row)` do arquivo por esse caminho: `getById`, `getPublishedBySlug`, `list`, `listUpcomingPublished`, `publish`, `unpublish`, `imagePathBySlug`. Uma leitura que esquecer disso falha calada e diferente em cada tela.

- [ ] **Step 6: Gravar a programação no create e no update**

No `create`: o rascunho nasce com **uma sessão em "agora"** quando o pedido não traz programação, pelo mesmo motivo que hoje nasce com `starts_at = now()`.

```ts
  async create(dto: CreateEventoDto, userId: string): Promise<EventoDTO> {
    const sessions = dto.sessions?.length
      ? dto.sessions
      : [{ startsAt: new Date(), endsAt: null, title: null, description: null }]
    const row = await this.repo.create({ ...dto, locationName: dto.locationName ?? '' }, userId)
    const atualizado = await this.repo.substituirSessoes(row.id, sessions)
    return this.toDTO(atualizado, [...(await this.repo.sessoesDe([row.id])).values()][0] ?? [])
  }
```

No `update`, a checagem de "evento publicado não pode ficar incompleto" precisa da **programação efetiva** — a do pedido quando vier, a do banco quando não vier:

```ts
  async update(id: string, dto: UpdateEventoDto): Promise<EventoDTO> {
    const current = await this.repo.findById(id)
    if (!current) throw new NotFoundError('Evento não encontrado.')
    const sessoesAtuais = (await this.repo.sessoesDe([id])).get(id) ?? []

    if (current.status === 'published') {
      const efetivo = { ...this.toDTO(current, sessoesAtuais), ...comoDTO(dto) }
      const falta = faltaParaPublicar(efetivo)
      if (falta.length) throw new BadRequestError('Evento publicado não pode ficar incompleto.', { missing: falta })
    }

    let row = (await this.repo.update(id, dto))!
    if (dto.sessions) {
      row = await this.repo.substituirSessoes(
        id, dto.sessions, dto.expectedUpdatedAt ? new Date(dto.expectedUpdatedAt) : undefined,
      )
    }
    const atualizado = this.toDTO(row, (await this.repo.sessoesDe([id])).get(id) ?? [])
    await this.regerarImagens(atualizado)
    return atualizado
  }
```

Cuidado: `comoDTO(dto)` precisa converter `dto.sessions` (datas `Date`) para o formato do DTO (strings ISO) antes do espalhamento, senão a regra de publicação compara tipos diferentes.

- [ ] **Step 7: Verificar a compilação e commitar**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: sem erro.

```bash
git add server/modules/eventos/eventos.service.ts server/modules/eventos/eventos.publish-rules.ts __tests__/eventos/publish-rules.test.ts
git commit -m "feat(eventos): o servidor grava e devolve a programação em toda leitura do evento"
```

---

## Task 6: Convite de calendário com um compromisso por horário

**Files:**
- Modify: `src/components/evento/evento-ics.ts`
- Modify: `__tests__/eventos/ics.test.ts`

**Interfaces:**
- Consumes: `EventoDTO.sessions` (Task 3).
- Produces: `montarIcs(evento: EventoDTO): string` com um `VEVENT` por sessão.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar em `__tests__/eventos/ics.test.ts`:

```ts
  it('gera um compromisso por horário', () => {
    const ics = montarIcs(evento({
      sessions: [
        { id: 'a', startsAt: '2027-03-13T23:00:00.000Z', endsAt: '2027-03-14T00:30:00.000Z', title: 'Abertura', description: null },
        { id: 'b', startsAt: '2027-03-14T12:30:00.000Z', endsAt: null, title: null, description: null },
      ],
    }))
    expect(linhas(ics).filter(l => l === 'BEGIN:VEVENT')).toHaveLength(2)
  })

  it('o identificador não depende da linha do banco, para não duplicar na agenda', () => {
    const comIds = (a: string, b: string) => evento({
      sessions: [
        { id: a, startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: null, description: null },
        { id: b, startsAt: '2027-03-14T12:30:00.000Z', endsAt: null, title: null, description: null },
      ],
    })
    const uids = (ics: string) => linhas(ics).filter(l => l.startsWith('UID:'))
    // A programação é apagada e regravada a cada salvamento: os ids mudam, o convite não pode mudar.
    expect(uids(montarIcs(comIds('a', 'b')))).toEqual(uids(montarIcs(comIds('x', 'y'))))
  })

  it('o primeiro horário mantém o identificador que o evento já tinha', () => {
    const ics = montarIcs(evento({
      sessions: [{ id: 'a', startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: null, description: null }],
    }))
    expect(linhas(ics)).toContain('UID:11111111-2222-3333-4444-555555555555@iasdtucuruvi.org.br')
  })

  it('o nome do horário entra no título do compromisso', () => {
    const ics = montarIcs(evento({
      sessions: [{ id: 'a', startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: 'Abertura', description: null }],
    }))
    expect(linhas(ics)).toContain('SUMMARY:Vigília de Oração dos Jovens — Abertura')
  })
```

Acrescentar `sessions: []` ao objeto base do helper `evento()` do arquivo.

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx jest __tests__/eventos/ics.test.ts --runInBand`
Expected: FAIL nos quatro casos novos.

- [ ] **Step 3: Implementar**

Em `src/components/evento/evento-ics.ts`, trocar o bloco único de `VEVENT` por um por sessão:

```ts
export function montarIcs(evento: EventoDTO): string {
  const local = [evento.locationName, evento.locationAddress].filter(Boolean).join(', ')
  const agora = instanteUtc(new Date().toISOString())
  const sessoes = [...evento.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const compromissos = sessoes.flatMap((s, i) => [
    'BEGIN:VEVENT',
    // Calculado, nunca o id da sessão: a programação é regravada a cada salvamento, e um
    // identificador novo faria a agenda de quem já baixou ganhar um compromisso repetido.
    `UID:${evento.id}${i === 0 ? '' : `-${i + 1}`}@${DOMINIO}`,
    // O contador é o que faz o calendário aceitar a alteração de um compromisso que já tem.
    `SEQUENCE:${Math.floor(new Date(evento.publishedAt ?? evento.startsAt).getTime() / 1000)}`,
    `DTSTAMP:${agora}`,
    `DTSTART:${instanteUtc(s.startsAt)}`,
    ...(s.endsAt ? [`DTEND:${instanteUtc(s.endsAt)}`] : []),
    `SUMMARY:${escapar(s.title ? `${evento.title} — ${s.title}` : evento.title)}`,
    ...(s.description || evento.summary ? [`DESCRIPTION:${escapar(s.description ?? evento.summary!)}`] : []),
    ...(local ? [`LOCATION:${escapar(local)}`] : []),
    ...(evento.publicUrl ? [`URL:${evento.publicUrl}`] : []),
    'END:VEVENT',
  ])

  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//IASD Tucuruvi//Eventos//PT-BR`, 'CALSCALE:GREGORIAN',
    ...compromissos, 'END:VCALENDAR',
  ].map(dobrar).join('\r\n')
}
```

- [ ] **Step 4: Rodar até passar**

Run: `npx jest __tests__/eventos/ics.test.ts --runInBand`
Expected: PASS, incluindo os testes que já existiam.

- [ ] **Step 5: Commit**

```bash
git add src/components/evento/evento-ics.ts __tests__/eventos/ics.test.ts
git commit -m "feat(eventos): o convite de agenda leva os horários todos, sem duplicar o que já foi salvo"
```

---

## Task 7: As artes de compartilhamento

**Files:**
- Modify: `server/modules/eventos/eventos.image.ts`
- Modify: `__tests__/eventos/image.test.ts`

**Interfaces:**
- Consumes: `resumoDaProgramacao` de `server/core/programacao.js` (Task 1); `EventoDTO.sessions`.
- Produces: campo `quando` da capa montado pelo resumo.

- [ ] **Step 1: Escrever o teste que falha**

Em `__tests__/eventos/image.test.ts`:

```ts
  it('a linha do quando resume a programação inteira', async () => {
    const svg = await svgDaCapa(evento({
      sessions: [
        { id: 'a', startsAt: '2027-03-13T23:00:00.000Z', endsAt: null, title: null, description: null },
        { id: 'b', startsAt: '2027-03-14T12:30:00.000Z', endsAt: null, title: null, description: null },
        { id: 'c', startsAt: '2027-03-14T19:30:00.000Z', endsAt: null, title: null, description: null },
      ],
    }))
    expect(svg).toContain('13 e 14 de março · 3 horários')
  })
```

(Usar o mesmo utilitário de montagem de SVG que os outros casos do arquivo já usam.)

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx jest __tests__/eventos/image.test.ts --runInBand`
Expected: FAIL — sai a data de um horário só.

- [ ] **Step 3: Implementar**

Em `server/modules/eventos/eventos.image.ts`, apagar `quandoPorExtenso` e usar o resumo:

```ts
import { resumoDaProgramacao } from '../../core/programacao.js'
// …
    quando: resumoDaProgramacao(e.sessions),
```

- [ ] **Step 4: Rodar até passar**

Run: `npx jest __tests__/eventos/image.test.ts --runInBand`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/modules/eventos/eventos.image.ts __tests__/eventos/image.test.ts
git commit -m "feat(eventos): a arte de compartilhamento resume a programação em uma linha"
```

---

## Task 8: O formulário do painel

**Files:**
- Create: `src/painel/pages/evento/SessoesDoEvento.tsx`
- Modify: `src/painel/pages/EventoEditor.tsx`
- Modify: `src/painel/eventos-api.ts`
- Modify: `src/painel/pages/EventosLista.tsx`
- Modify: `__tests__/eventos/painel-eventos.test.ts`

**Interfaces:**
- Consumes: `SessaoDTO`; `paraCampoDeDataHora` / `deCampoDeDataHora` (já existem em `eventos-api.ts`); `resumoDaProgramacao` (Task 1).
- Produces: `<SessoesDoEvento sessoes={...} publicado={...} onChange={(s: SessaoDeFormulario[]) => void} />`, com `interface SessaoDeFormulario { chave: string; inicio: string; termino: string; title: string; description: string }`.

Desenho aprovado: seção 1 do mockup. **Ler o mockup antes de escrever a tela.**

- [ ] **Step 1: Escrever o teste de destino das pendências**

Em `__tests__/eventos/painel-eventos.test.ts`:

```ts
  it('as pendências de programação levam ao cartão de horários', () => {
    expect(cartaoDaPendencia('Informe pelo menos um horário para o evento.')).toBe('quando')
    expect(cartaoDaPendencia('No 2º horário, o término precisa ser depois do início.')).toBe('quando')
  })
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx jest __tests__/eventos/painel-eventos.test.ts --runInBand`
Expected: FAIL — as frases caem no primeiro cartão.

- [ ] **Step 3: Atualizar o mapa de trechos**

Em `src/painel/eventos-api.ts`, no `CARTAO_POR_TRECHO`, trocar `['data e a hora', 'quando']` por:

```ts
  ['pelo menos um horário', 'quando'],
  ['horário, o término', 'quando'],
```

- [ ] **Step 4: Rodar até passar**

Run: `npx jest __tests__/eventos/painel-eventos.test.ts --runInBand`
Expected: PASS.

- [ ] **Step 5: Escrever o componente da lista**

Criar `src/painel/pages/evento/SessoesDoEvento.tsx`. Requisitos, todos vindos da revisão das telas:

- Um `<fieldset>` por horário, com `<legend className="sr-only">Horário 2 de 3 — sábado, 14 de março</legend>`; cabeçalho visível com o mesmo texto e o botão "Remover" (`<Button variant="danger">`, tamanho médio).
- Cada `<Field>` recebe `htmlFor` e cada `<Input>` o `id` correspondente.
- Grade interna `grid gap-4 md:grid-cols-3` — início, término, nome; a frase ocupa `md:col-span-3`. **Não usar `sm:`**: a 640px o seletor de data corta o valor.
- **Reordenação só no `onBlur`** do campo de início. Durante a digitação a lista fica parada.
- "Adicionar horário" acrescenta **no fim**, com foco no campo de início do bloco novo (`ref` + `focus()`).
- "Remover" troca o bloco por uma faixa "Horário removido · Desfazer" por 8 segundos; passado o prazo, some. O estado removido vive no componente, não no servidor.
- Horário repetido: comparar os instantes na própria lista e passar `error` ao `Field` do início **dos dois blocos** em conflito, com "Este horário já existe no Nº bloco".
- Quando `publicado`, uma faixa `<Alert>` no topo: "Este evento já está no ar — alterar a programação muda a página e a arte já compartilhada."
- Texto de auxílio embaixo do primeiro bloco: "Em branco, a programação mostra só o horário."
- A chave de React é a `chave` do item (gerada no cliente), **nunca o índice**: remover um bloco do meio com índice como chave embaralha o que está digitado nos outros.

- [ ] **Step 6: Trocar o cartão "Quando e onde" no editor**

Em `src/painel/pages/EventoEditor.tsx`, dentro de `<Cartao chave="quando">`: **Local e Endereço primeiro**, depois um divisor, depois `<SessoesDoEvento …/>`. Remover os dois `<Input type="datetime-local">` de evento. No `salvar`, mandar `sessions` (convertendo com `deCampoDeDataHora`) e `expectedUpdatedAt` com o `updatedAt` que a tela carregou.

- [ ] **Step 7: Mostrar a contagem na lista do painel**

Em `src/painel/pages/EventosLista.tsx`, acrescentar `· N horários` à coluna de data quando `evento.sessions.length > 1`.

- [ ] **Step 8: Conferir no navegador**

Run: `npm run dev` e `npm run dev:server` (dois terminais), abrir `/painel/eventos`, criar um rascunho, acrescentar três horários, salvar, recarregar.
Expected: os três horários voltam na ordem do relógio; remover e desfazer recupera o bloco; dois horários iguais marcam os dois blocos e não deixam salvar.

- [ ] **Step 9: Commit**

```bash
git add src/painel/pages/evento/SessoesDoEvento.tsx src/painel/pages/EventoEditor.tsx src/painel/eventos-api.ts src/painel/pages/EventosLista.tsx __tests__/eventos/painel-eventos.test.ts
git commit -m "feat(eventos): o formulário do evento edita a programação inteira"
```

---

## Task 9: A página pública

**Files:**
- Create: `src/components/evento/EventoProgramacao.tsx`
- Modify: `src/components/evento/EventoRenderer.tsx`
- Modify: `src/components/evento/EventoHero.tsx`
- Modify: `src/pages/Eventos.tsx`

**Interfaces:**
- Consumes: `agruparPorDia`, `faixaDeHorario`, `resumoDaProgramacao` (Task 1); `EventoDTO.sessions`.
- Produces: `<EventoProgramacao sessoes={...} />`, renderizando nada quando há menos de duas sessões.

Desenho aprovado: seção 2 do mockup. **Ler o mockup antes de escrever a tela.**

- [ ] **Step 1: Escrever o cartão da programação**

Criar `src/components/evento/EventoProgramacao.tsx`:

```tsx
import { agruparPorDia, faixaDeHorario } from '@/lib/programacao'
import type { SessaoDTO } from '@/schemas/evento'

/**
 * A programação do evento, agrupada por dia. Evento de um horário só não mostra cartão
 * nenhum: a data continua no topo, como sempre foi.
 */
export default function EventoProgramacao({ sessoes }: { sessoes: SessaoDTO[] }) {
  if (sessoes.length < 2) return null
  const grupos = agruparPorDia(sessoes)

  return (
    <section id="programacao" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-heading font-bold text-iasd-dark">Programação</h2>
      <div className="mt-5 space-y-7">
        {grupos.map(grupo => (
          <div key={grupo.dia}>
            <p className="font-heading text-base font-bold text-iasd-dark">{grupo.rotulo}</p>
            <ul className="mt-2 divide-y divide-gray-100 border-t border-gray-100">
              {grupo.sessoes.map(s => (
                <li key={s.id} className="grid gap-1.5 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
                  <p className="text-sm font-bold text-iasd-accent tnum">{faixaDeHorario(s.startsAt, s.endsAt)}</p>
                  <div className="min-w-0">
                    {s.title && <p className="text-sm font-medium text-gray-800">{s.title}</p>}
                    {s.description && (
                      <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{s.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
```

A hierarquia é de três níveis, e é ela que faz o olho achar o dia: dia maior e escuro, hora em destaque azul, nome em peso normal. Hora e nome no mesmo peso apagam o agrupamento.

- [ ] **Step 2: Encaixar na página**

Em `src/components/evento/EventoRenderer.tsx`, pôr `<EventoProgramacao sessoes={evento.sessions} />` **antes** do cartão "Sobre o evento" na coluna principal. E trocar o texto do cartão "Adicionar à agenda" e o texto que vai para o WhatsApp pelo `resumoDaProgramacao`, que hoje anunciam um horário só.

- [ ] **Step 3: Ajustar o topo**

Em `src/components/evento/EventoHero.tsx`, no bloco "Quando":
- Com uma sessão: o dia por extenso e a faixa de horário, como hoje (lendo da sessão, não mais de `evento.startsAt`).
- Com duas ou mais: o intervalo de dias e, embaixo, `<a href="#programacao">N horários · veja a programação</a>` — link, não texto morto.

- [ ] **Step 4: Ajustar o cartão da lista pública**

Em `src/pages/Eventos.tsx`, trocar `dataLongaDoEvento(evento.startsAt)` por `resumoDaProgramacao(evento.sessions)`.

- [ ] **Step 5: Conferir no navegador**

Run: `npm run dev` + `npm run dev:server`, publicar o evento de três horários criado na Task 8 e abrir `/eventos` e `/eventos/<slug>`.
Expected: o cartão da lista mostra "13 e 14 de março · 3 horários"; a página abre com a programação acima da descrição; o link do topo rola até ela; o botão de agenda baixa um arquivo com três compromissos.

- [ ] **Step 6: Commit**

```bash
git add src/components/evento/EventoProgramacao.tsx src/components/evento/EventoRenderer.tsx src/components/evento/EventoHero.tsx src/pages/Eventos.tsx
git commit -m "feat(eventos): a página do evento mostra a programação, agrupada por dia"
```

---

## Task 10: Documentação

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Atualizar o parágrafo de Eventos**

Na seção "### Eventos (US-29)", trocar a frase sobre data de início e término por: o evento tem uma **programação** de 1 a 20 horários (`evento_sessoes`), cada um com nome e frase opcionais; as colunas de data do evento são cache da primeira e da última sessão; a lista pública ordena pelo próximo horário pendente e o evento sai dela depois do último; o convite de calendário leva um compromisso por horário.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: o evento passa a ter programação de vários horários"
```

---

## Autorrevisão do plano

**Cobertura da spec** — §4.1 e §4.4 na Task 2; §4.2 e §5.2 na Task 3; §4.3, §5.1 e §5.3 na Task 4; §5.4 na Task 5; §6 na Task 7; §7 na Task 6; §8.1 e §8.3 (painel) na Task 8; §8.2 e §8.3 (público) na Task 9; §10 distribuído nas tarefas que criam cada teste.

**Sem lacuna conhecida.** Dois pontos que a spec registra como dívida e que este plano **não** executa, de propósito: o cabeçalho do painel que não cabe no celular (pré-existente) e a altura mínima dos botões pequenos do kit.

**Consistência de nomes:** `Sessao` (funções puras) ↔ `SessaoDTO` (API) ↔ `SessaoRow` (banco) ↔ `SessaoInput` (gravação) ↔ `SessaoDeFormulario` (tela). São formas diferentes do mesmo dado e cada tarefa diz qual usa.
