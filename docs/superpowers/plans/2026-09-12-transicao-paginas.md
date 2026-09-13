# Transição entre páginas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.
> **Quem executa este plano é um orquestrador** (skill `orquestrador`): as tasks marcadas como
> pacote vão para o `implementador`; git, decisões e as tasks do principal são dele.

**Goal:** Ao navegar entre páginas, o conteúdo da página que sai esmaece em 0,1s e o da que entra
aparece em 0,16s — com cabeçalho e barra lateral parados, e sem animação para quem pede menos
movimento.

**Architecture:** O site sai de `<BrowserRouter>` para `createBrowserRouter` + `<RouterProvider>`
com a mesma árvore de rotas, porque só esse modo aplica a opção `viewTransition`. Toda navegação
passa por `src/lib/navigation.tsx`, que liga a transição quando o caminho muda; o CSS em
`src/globals.css` anima só o elemento com a classe `page-transition`; um teste em `__tests__/`
falha se alguém importar navegação direto do roteador.

**Tech Stack:** React 18 · React Router 7.13 (`react-router-dom`) · Vite 6 · Tailwind 3 ·
Jest 30 + ts-jest (ambiente `node`). **Nenhuma dependência nova.**

**Spec:** `docs/superpowers/specs/2026-09-12-transicao-paginas-design.md` · **PR:** #36 (rascunho) ·
**Branch:** `spec/transicao-paginas` · **Base conferida:** `2593673`

## Global Constraints

- **Tempos, exatos:** `::view-transition-old(page)` = `page-fade-out 100ms ease-in both`;
  `::view-transition-new(page)` = `page-fade-in 160ms ease-out 60ms both`; `animation: none` em
  `::view-transition-group(root)`, `::view-transition-old(root)`, `::view-transition-new(root)` e
  `::view-transition-group(page)`; `@media (prefers-reduced-motion: reduce)` zera as duas de `page`.
- **Um só elemento com `page-transition` por página.** Dois com o mesmo nome fazem o navegador pular
  a transição.
- **O elemento marcado vira contexto de empilhamento o tempo todo**, não só durante a troca (medido
  no Chrome 146). Nada dentro dele sobe acima de algo de fora com camada maior — por isso o
  cabeçalho fixo (`z-50`) fica **fora** e os modais do painel continuam em portal no `body`.
- **`Link`, `NavLink` e `useNavigate` só de `@/lib/navigation`**, nunca de `react-router` ou
  `react-router-dom`. Os demais (`useLocation`, `useParams`, `Outlet`, `Navigate`,
  `useNavigationType`…) continuam vindo do roteador.
- **Caminhos das rotas não mudam.** Nenhum `path`, nenhum `ProtectedRoute`, nenhum
  `RequirePermission` sai do lugar.
- **Estilo do código:** aspas simples, sem ponto e vírgula, alias `@/` para `src/`, comentário em
  português com acentuação e explicando **por quê**.
- **CSS da transição fora de `@layer`**, como `.boletim-prose` no mesmo arquivo — Tailwind 3 não tem
  `@utility`.
- **Checagem de tipos do front é `npx tsc --noEmit`.** `npm run build` não checa tipos de `src/`.
- **Teste de um arquivo:** `npx jest __tests__/lib/navigation-imports.test.ts`. A suíte inteira
  (`npm test`) roda uma vez, na Task 3.
- **Nenhum subagente roda git.**

---

## O que NÃO quebra (verificado — não gaste tempo provando de novo)

- **O servidor não muda.** O Express serve o `index.html` para rotas de tela num catch-all que não
  depende do modo do roteador (`server/index.ts:185-187`); não há Helmet nem CSP no projeto.
- **`src/auth/` não usa gancho de roteador** além do `<Navigate>` de `ProtectedRoute.tsx:8`, que roda
  dentro das rotas. O `AuthProvider` pode envolver o `RouterProvider` por fora.
- **Nenhum teste existente importa `App.tsx`, `main.tsx`, `PainelLayout.tsx` ou navegação.** Os
  testes de `__tests__/` são de funções puras; commits intermediários não quebram `npm test`.
- **Nenhuma sobreposição é afetada pelo contexto de empilhamento novo.** Nas páginas e componentes
  públicos, fora o cabeçalho, não há camada `z-50` ou maior. No painel, o modal (`z-30`,
  `src/painel/components/Modal.tsx:13`) é portal no `body`, fora do `main`; o menu flutuante da barra
  recolhida (`z-20`, `src/painel/Sidebar.tsx:97`) tem camada positiva e fica acima do `main` marcado
  — medido com a barra sem camada e com camada própria.
- **Página alta não impede a transição** — medido no Chrome 146 com elemento marcado de até
  60.000px.
- **`CLAUDE.md` não descreve `BrowserRouter` nem a montagem das rotas.** Só a frase de `:203` sobre o
  que a suíte cobre precisa mudar (Task 2).
- **O `.env`, o Docker e as migrations não mudam.**

---

## Estrutura de arquivos

| Arquivo | Task | Papel |
|---|---|---|
| `src/lib/navigation.tsx` | 1 (criar) | Ponto único: `Link`, `NavLink`, `useNavigate` que ligam a transição quando o caminho muda |
| `src/App.tsx` | 1 | Deixa de exportar `App`; exporta `router`. Ganha `RootLayout` (AOS) e `AcessoLayout` (páginas soltas); `PublicLayout` marca o conteúdo |
| `src/main.tsx` | 1 | `AuthProvider` + `RouterProvider` no lugar de `BrowserRouter` + `App` |
| `src/painel/PainelLayout.tsx` | 1 | Marca o `<main>` |
| `src/globals.css` | 1 | CSS da transição, no fim do arquivo |
| `__tests__/lib/navigation-imports.test.ts` | 1 (criar) · 2 | Task 1: função de detecção e seus casos. Task 2: a varredura de `src/` |
| 25 arquivos de `src/` que importam navegação | 2 | Trocam a origem de `Link`/`NavLink`/`useNavigate` para `@/lib/navigation` (lista no ONDE FICA) |
| `CLAUDE.md` | 2 | A frase de `:203` admite a verificação estática |

---

## Task 0 — Terreno (agente principal)

Nada aqui é código; é o que decide as variantes da Task 1.

- [ ] **Step 1: Atualizar e comparar a base**

```bash
git -C /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas fetch origin
git -C /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas log --oneline 2593673..origin/master
gh pr list --repo robertogabrieu/iasd-tucuruvi --state all --limit 10
```

Anote quais de **#31, #32 e #34** já estão `MERGED`.

- [ ] **Step 2: Trazer o master, se andou**

Se o Step 1 listou commits, traga-os por **merge** (a branch já está no remoto; rebase exigiria push
forçado):

```bash
git -C /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas merge --no-edit origin/master
```

- [ ] **Step 3: Fixar as variantes do briefing da Task 1**

| Se… | Então no briefing |
|---|---|
| #32 entrou | `VARIANTE_32: sim` — `RootLayout` renderiza `<ScrollToTop />` antes do `<Outlet />`, e a linha `<ScrollToTop />` sai de onde a #32 a pôs |
| #32 não entrou | `VARIANTE_32: não` |
| #34 entrou | `VARIANTE_34: sim` — `PublicLayout` na forma de coluna (Task 1, Step 4b) |
| #34 não entrou | `VARIANTE_34: não` — `PublicLayout` na forma base (Task 1, Step 4a) |
| #31 entrou | Nenhuma decisão muda; as linhas citadas de `Header.tsx` deslocam |

- [ ] **Step 4: Dependências no worktree**

O worktree não tem `node_modules`:

```bash
npm --prefix /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas ci
```

- [ ] **Step 5: Baseline por nomes (`testador`)**

`testador` roda `npm test` no worktree **antes de qualquer edição** e devolve verdes e nomes que
falharam. É o diff de nomes da Task 3 que prova "zero falhas novas".

---

## Task 1 — Pacote A: roteador de dados, ponto único, marcação e CSS

**Files:**
- Create: `src/lib/navigation.tsx`
- Create: `__tests__/lib/navigation-imports.test.ts`
- Modify: `src/App.tsx` (arquivo inteiro — ver Step 4)
- Modify: `src/main.tsx` (arquivo inteiro)
- Modify: `src/painel/PainelLayout.tsx:8`
- Modify: `src/globals.css` (acrescentar no fim, depois da linha 122)

**Interfaces:**
- Produces: `Link`, `NavLink` (mesmas props de `react-router-dom`) e `useNavigate(): NavigateFunction`
  exportados de `@/lib/navigation`; `router` exportado de `src/App.tsx`; a função
  `importacoesDiretasDeNavegacao(codigo: string): string[]` exportada de
  `__tests__/lib/navigation-imports.test.ts`, que a Task 2 usa.

O projeto não tem ambiente de DOM no Jest (`testEnvironment: 'node'`, `jest.config.cjs:4`) nem teste
de componente — a verificação desta task é a detecção coberta por teste, `npx tsc --noEmit` e
`npm run build`. O comportamento no navegador é medido na Task 4.

- [ ] **Step 1: Escrever os casos da detecção**

Criar `__tests__/lib/navigation-imports.test.ts`:

```ts
const NOMES_PROIBIDOS = ['Link', 'NavLink', 'useNavigate']

/**
 * Nomes de navegação importados direto do roteador num texto de arquivo. Casa o bloco de
 * importação inteiro — mesmo quebrado em várias linhas — e usa o nome de antes do `as`, para que
 * um apelido não esvazie a trava. Importação só de tipo fica de fora: tipo não navega.
 */
export function importacoesDiretasDeNavegacao(codigo: string): string[] {
  const bloco = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]react-router(?:-dom)?['"]/g
  const achados: string[] = []
  for (const encontro of codigo.matchAll(bloco)) {
    if (encontro[1]) continue
    for (const parte of encontro[2].split(',')) {
      const especificador = parte.trim()
      if (!especificador || especificador.startsWith('type ')) continue
      const nome = especificador.split(/\s+as\s+/)[0].trim()
      if (NOMES_PROIBIDOS.includes(nome)) achados.push(nome)
    }
  }
  return achados
}

describe('importacoesDiretasDeNavegacao', () => {
  it('acusa importação simples', () => {
    expect(importacoesDiretasDeNavegacao("import { Link } from 'react-router-dom'")).toEqual(['Link'])
  })

  it('acusa importação com apelido', () => {
    expect(importacoesDiretasDeNavegacao("import { Link as L } from 'react-router-dom'")).toEqual(['Link'])
  })

  it('acusa importação em várias linhas vinda de react-router', () => {
    const codigo = "import {\n  useLocation,\n  NavLink,\n  useNavigate,\n} from 'react-router'"
    expect(importacoesDiretasDeNavegacao(codigo)).toEqual(['NavLink', 'useNavigate'])
  })

  it('ignora o que não navega', () => {
    expect(importacoesDiretasDeNavegacao("import { useLocation, Outlet } from 'react-router-dom'")).toEqual([])
  })

  it('ignora importação só de tipo', () => {
    expect(importacoesDiretasDeNavegacao("import type { LinkProps } from 'react-router-dom'")).toEqual([])
    expect(importacoesDiretasDeNavegacao("import { type NavLinkProps } from 'react-router-dom'")).toEqual([])
  })

  it('ignora o ponto único de navegação', () => {
    expect(importacoesDiretasDeNavegacao("import { Link, useNavigate } from '@/lib/navigation'")).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar os casos**

Run: `npx jest __tests__/lib/navigation-imports.test.ts`
Expected: PASS, 6 testes. Se algum falhar, a detecção está errada — corrija a função, não o caso.

- [ ] **Step 3: Criar `src/lib/navigation.tsx`**

```tsx
import { useCallback } from 'react'
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  resolvePath,
  useLocation,
  useNavigate as useRouterNavigate,
  useResolvedPath,
} from 'react-router-dom'
import type { LinkProps, NavLinkProps, NavigateFunction, NavigateOptions, To } from 'react-router-dom'

// Toda troca de página passa por aqui para ganhar o esmaecimento (o efeito mora em
// src/globals.css). Só anima quando a página muda: clicar no link da página atual não pisca.

function useMudaDePagina(to: To): boolean {
  const { pathname } = useLocation()
  return useResolvedPath(to).pathname !== pathname
}

export function Link({ to, viewTransition, ...props }: LinkProps) {
  const mudaDePagina = useMudaDePagina(to)
  return <RouterLink to={to} viewTransition={viewTransition ?? mudaDePagina} {...props} />
}

export function NavLink({ to, viewTransition, ...props }: NavLinkProps) {
  const mudaDePagina = useMudaDePagina(to)
  return <RouterNavLink to={to} viewTransition={viewTransition ?? mudaDePagina} {...props} />
}

export function useNavigate(): NavigateFunction {
  const navigate = useRouterNavigate()

  // A página atual é lida na hora da chamada, e não por useLocation: assim a função devolvida não
  // muda a cada navegação, e efeito que depende dela não roda de novo só porque a página trocou.
  const navegarComTransicao = useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        return navigate(to)
      }
      const atual = window.location.pathname
      const mudaDePagina = resolvePath(to, atual).pathname !== atual
      return navigate(to, { viewTransition: mudaDePagina, ...options })
    },
    [navigate],
  )

  // NavigateFunction é uma sobrecarga (destino ou passos no histórico); uma única função que trata
  // os dois casos só se encaixa nela por asserção.
  return navegarComTransicao as NavigateFunction
}
```

- [ ] **Step 4a: `src/App.tsx` — forma base (`VARIANTE_34: não`)**

Substituir o arquivo inteiro. As importações de página (linhas 6-39 de hoje) ficam **idênticas**;
só sai `AuthProvider` (vai para `main.tsx`) e entra a importação do roteador de dados.

```tsx
import { useEffect } from 'react'
import { Outlet, Route, createBrowserRouter, createRoutesFromElements, useLocation } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'

import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Sermoes from './pages/Sermoes'
import Galeria from './pages/Galeria'
import ASA from './pages/ASA'
import VidaESaude from './pages/VidaESaude'
import Desbravadores from './pages/Desbravadores'
import Especialidades from './pages/Especialidades'
import Login from './pages/Login'
import EsqueciSenha from './pages/EsqueciSenha'
import RedefinirSenha from './pages/RedefinirSenha'
import AceitarConvite from './pages/AceitarConvite'
import PainelLayout from './painel/PainelLayout'
import Dashboard from './painel/pages/Dashboard'
import Configuracoes from './painel/pages/Configuracoes'
import EmBreve from './painel/pages/EmBreve'
import UsuariosLista from './painel/pages/UsuariosLista'
import UsuarioDetalhe from './painel/pages/UsuarioDetalhe'
import Convites from './painel/pages/Convites'
import Papeis from './painel/pages/Papeis'
import Midia from './painel/pages/Midia'
import EventosLista from './painel/pages/EventosLista'
import EventoEditor from './painel/pages/EventoEditor'
import EventoPreview from './painel/pages/EventoPreview'
import Eventos from './pages/Eventos'
import EventoPublico from './pages/EventoPublico'
import Boletins from './painel/pages/Boletins'
import BoletimEditor from './painel/pages/BoletimEditor'
import Templates from './painel/pages/Templates'
import Formularios from './painel/pages/Formularios'
import FormularioSubmissoes from './painel/pages/FormularioSubmissoes'
import BoletimPreview from './pages/BoletimPreview'
import BoletimPublico from './pages/BoletimPublico'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RequirePermission } from './auth/RequirePermission'

// Páginas que abrem com hero de tela cheia: o header fica por cima da imagem,
// sem bloco atrás. As demais precisam do bloco — ver comentário abaixo.
const ROTAS_COM_HERO = ['/', '/asa', '/desbravadores', '/desbravadores/especialidades']

// Raiz de todas as rotas. Roda o AOS uma vez e é o limite de baixo de tudo que usa gancho de
// roteador: no roteador de dados não existe componente renderizado fora das rotas.
function RootLayout() {
  useEffect(() => {
    AOS.init({ duration: 800, once: true, easing: 'ease-out' })
  }, [])

  return <Outlet />
}

function PublicLayout() {
  const { pathname } = useLocation()
  // Páginas internas (sem hero) ganham um bloco azul sólido atrás do header fixo.
  // Como está no fluxo normal, ele sobe junto ao rolar — então no topo o header
  // semitransparente fica sobre azul sólido e, ao rolar, vira o glass sobre o conteúdo.
  const temHero = ROTAS_COM_HERO.includes(pathname)
  return (
    <>
      <Header />
      {/* Só o que está aqui dentro esmaece ao trocar de página. O header fica de fora: senão
          piscaria a cada clique, e dentro do elemento marcado ele perderia a camada sobre o conteúdo. */}
      <div className="page-transition">
        {!temHero && <div className="h-16 bg-iasd-dark" aria-hidden />}
        <Outlet />
        <Footer />
      </div>
    </>
  )
}

// Login, recuperação de senha e convite não têm moldura, mas o esmaecimento precisa de um
// elemento marcado para animar.
function AcessoLayout() {
  return (
    <div className="page-transition">
      <Outlet />
    </div>
  )
}

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/sermoes" element={<Sermoes />} />
        <Route path="/galeria" element={<Galeria />} />
        <Route path="/asa" element={<ASA />} />
        <Route path="/vida-e-saude" element={<VidaESaude />} />
        <Route path="/desbravadores" element={<Desbravadores />} />
        <Route path="/desbravadores/especialidades" element={<Especialidades />} />
        <Route path="/boletins/:slug" element={<BoletimPublico />} />
        <Route path="/eventos" element={<Eventos />} />
        <Route path="/eventos/:slug" element={<EventoPublico />} />
      </Route>
      <Route element={<AcessoLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/aceitar-convite" element={<AceitarConvite />} />
      </Route>
      <Route path="/painel" element={<ProtectedRoute><PainelLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="usuarios" element={<RequirePermission perm="users:read"><UsuariosLista /></RequirePermission>} />
        <Route path="usuarios/convites" element={<RequirePermission perm="users:invite"><Convites /></RequirePermission>} />
        <Route path="usuarios/papeis" element={<RequirePermission perm="roles:manage"><Papeis /></RequirePermission>} />
        <Route path="usuarios/:id" element={<RequirePermission perm="users:read"><UsuarioDetalhe /></RequirePermission>} />
        <Route path="formularios" element={<RequirePermission perm="forms:read"><Formularios /></RequirePermission>} />
        <Route path="formularios/:formKey" element={<RequirePermission perm="forms:read"><FormularioSubmissoes /></RequirePermission>} />
        <Route path="midia" element={<RequirePermission perm="media:manage"><Midia /></RequirePermission>} />
        <Route path="boletins" element={<RequirePermission perm="boletim:write"><Boletins /></RequirePermission>} />
        <Route path="boletins/templates" element={<RequirePermission perm="boletim:templates:manage"><Templates /></RequirePermission>} />
        <Route path="boletins/templates/:id" element={<RequirePermission perm="boletim:templates:manage"><BoletimEditor mode="template" /></RequirePermission>} />
        <Route path="boletins/:id" element={<RequirePermission perm="boletim:write"><BoletimEditor /></RequirePermission>} />
        <Route path="boletins/:id/preview" element={<RequirePermission perm="boletim:write"><BoletimPreview /></RequirePermission>} />
        <Route path="eventos" element={<RequirePermission perm="evento:write"><EventosLista /></RequirePermission>} />
        <Route path="eventos/:id" element={<RequirePermission perm="evento:write"><EventoEditor /></RequirePermission>} />
        <Route path="eventos/:id/preview" element={<RequirePermission perm="evento:write"><EventoPreview /></RequirePermission>} />
        <Route path="*" element={<EmBreve />} />
      </Route>
    </Route>,
  ),
)
```

**Se o `master` trouxe rotas novas** (Task 0), elas entram na mesma posição em que estão no
`src/App.tsx` do `master`, com o mesmo `path` e o mesmo envoltório de permissão.

- [ ] **Step 4b: `PublicLayout` na forma de coluna (`VARIANTE_34: sim`)**

Com a #34 no `master`, o `PublicLayout` do Step 4a é substituído por este — a coluna e os
comentários da #34 ficam, e o `page-transition` entra **dentro** dela, nunca no `div` externo que
contém o header:

```tsx
function PublicLayout() {
  const { pathname } = useLocation()
  // Páginas internas (sem hero) ganham um bloco azul sólido atrás do header fixo.
  // Como está no fluxo normal, ele sobe junto ao rolar — então no topo o header
  // semitransparente fica sobre azul sólido e, ao rolar, vira o glass sobre o conteúdo.
  const temHero = ROTAS_COM_HERO.includes(pathname)
  return (
    // Coluna com a janela como altura mínima: em tela de pouco conteúdo o miolo estica e o
    // rodapé encosta embaixo, em vez de subir até o meio e descer quando o conteúdo chega.
    <div className="flex min-h-dvh flex-col">
      <Header />
      {/* Só o que está aqui dentro esmaece ao trocar de página; o header fica de fora. Precisa
          esticar como coluna, senão o rodapé volta a subir em tela de pouco conteúdo. */}
      <div className="page-transition flex flex-1 flex-col">
        {!temHero && <div className="h-16 bg-iasd-dark" aria-hidden />}
        {/* O <main> da página também estica, para que o fundo dela — e não o do body — fique
            atrás do vazio. Página sem <main> na raiz cuida da própria altura. */}
        <div className="flex flex-1 flex-col [&>main]:flex-1">
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  )
}
```

- [ ] **Step 4c: `RootLayout` com rolagem ao topo (`VARIANTE_32: sim`)**

Com a #32 no `master`, acrescentar `import ScrollToTop from './components/ScrollToTop'` junto das
importações de componente, e o `RootLayout` do Step 4a passa a ser:

```tsx
function RootLayout() {
  useEffect(() => {
    AOS.init({ duration: 800, once: true, easing: 'ease-out' })
  }, [])

  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  )
}
```

O `<ScrollToTop />` que a #32 pôs no `return` de `App` não existe mais — `App` deixou de existir.
`src/components/ScrollToTop.tsx` não é editado.

- [ ] **Step 5: `src/main.tsx`**

Substituir o arquivo inteiro:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import { AuthProvider } from './auth/AuthContext'
import './globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
)
```

- [ ] **Step 6: Marcar o `<main>` do painel**

Em `src/painel/PainelLayout.tsx:8`, trocar:

```tsx
      <main className="flex-1 overflow-x-hidden p-8">
```

por:

```tsx
      <main className="page-transition flex-1 overflow-x-hidden p-8">
```

- [ ] **Step 7: CSS da transição**

Acrescentar ao **fim** de `src/globals.css`, fora de qualquer `@layer`:

```css

/* Troca de página: a página que sai esmaece e a que entra aparece em seguida. Só anima o
   elemento com page-transition — o header e a barra lateral trocam na hora, senão piscariam a
   cada clique. Quem liga a transição em cada navegação é src/lib/navigation.tsx.
   A animação padrão de root também sai: ela não aparece, mas durante seus 0,25s o clique
   seguinte não chegava à página. */
.page-transition {
  view-transition-name: page;
}

::view-transition-group(root),
::view-transition-old(root),
::view-transition-new(root),
::view-transition-group(page) {
  animation: none;
}

::view-transition-old(page) {
  animation: page-fade-out 100ms ease-in both;
}

::view-transition-new(page) {
  animation: page-fade-in 160ms ease-out 60ms both;
}

@keyframes page-fade-out {
  to {
    opacity: 0;
  }
}

@keyframes page-fade-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(page),
  ::view-transition-new(page) {
    animation: none;
  }
}
```

- [ ] **Step 8: Conferir que só `main.tsx` importava `App`**

Run: `grep -rn "from './App'\|from '@/App'\|from '../App'" src __tests__`
Expected: só `src/main.tsx`, com `{ router }`.

- [ ] **Step 9: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erro.

Run: `npx jest __tests__/lib/navigation-imports.test.ts`
Expected: PASS, 6 testes.

Run: `npm run build`
Expected: termina sem erro.

- [ ] **Step 10: Commit (agente principal)**

```bash
git -C /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas add src/lib/navigation.tsx src/App.tsx src/main.tsx src/painel/PainelLayout.tsx src/globals.css __tests__/lib/navigation-imports.test.ts
git -C /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas commit
```

Mensagem pela skill `commit`, em português, ex.: `feat(navegação): o site passa ao roteador de dados
e ganha o esmaecimento entre páginas`. Neste ponto nada anima ainda — nenhum arquivo importa do ponto
único; o corpo do commit diz isso.

---

## Task 2 — Pacote B: troca das importações e trava

**Files:**
- Modify: os 25 arquivos da lista do ONDE FICA (só a linha de importação do roteador)
- Modify: `__tests__/lib/navigation-imports.test.ts` (acrescentar a varredura)
- Modify: `CLAUDE.md:203`

**Interfaces:**
- Consumes: `@/lib/navigation` (`Link`, `NavLink`, `useNavigate`) e
  `importacoesDiretasDeNavegacao` da Task 1.

Trabalho mecânico: a troca é um script rodado uma vez, não edição arquivo a arquivo.

- [ ] **Step 1: Acrescentar a varredura (o vermelho desta task)**

No fim de `__tests__/lib/navigation-imports.test.ts`, e com a importação no **topo** do arquivo:

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
```

```ts
const RAIZ_SRC = join(__dirname, '..', '..', 'src')
const PONTO_UNICO = join('lib', 'navigation.tsx')

function arquivosDeCodigo(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivosDeCodigo(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

describe('navegação passa pelo ponto único', () => {
  // Página que importa direto do roteador troca de página sem a transição, e ninguém percebe até
  // notar a diferença no uso. A saída é importar de '@/lib/navigation'.
  it('nenhum arquivo de src importa Link, NavLink ou useNavigate direto do roteador', () => {
    const infratores = arquivosDeCodigo(RAIZ_SRC)
      .filter((arquivo) => relative(RAIZ_SRC, arquivo) !== PONTO_UNICO)
      .filter((arquivo) => importacoesDiretasDeNavegacao(readFileSync(arquivo, 'utf8')).length > 0)
      .map((arquivo) => relative(RAIZ_SRC, arquivo).split(sep).join('/'))

    expect(infratores).toEqual([])
  })
})
```

- [ ] **Step 2: Confirmar o vermelho**

Run: `npx jest __tests__/lib/navigation-imports.test.ts`
Expected: FAIL só em `nenhum arquivo de src importa…`, com **25** caminhos na lista (os do ONDE
FICA; mais, se o `master` trouxe arquivo novo que importe navegação). Os 6 casos da detecção
continuam PASS.

- [ ] **Step 3: Rodar a troca por script**

Salvar fora do repositório (ex.: `/tmp/troca-importacoes.mjs`) e rodar com o caminho do worktree:

```js
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const raiz = join(process.argv[2], 'src')
const MOVER = new Set(['Link', 'NavLink', 'useNavigate'])
const bloco = /import\s+\{([^}]*)\}\s*from\s*'(react-router(?:-dom)?)'(;?)\n/

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

let alterados = 0
for (const arquivo of arquivos(raiz)) {
  if (relative(raiz, arquivo) === join('lib', 'navigation.tsx')) continue
  const codigo = readFileSync(arquivo, 'utf8')
  const encontro = codigo.match(bloco)
  if (!encontro) continue
  const nomes = encontro[1].split(',').map((nome) => nome.trim()).filter(Boolean)
  const movidos = nomes.filter((nome) => MOVER.has(nome.split(/\s+as\s+/)[0]))
  if (movidos.length === 0) continue
  const ficam = nomes.filter((nome) => !movidos.includes(nome))
  const fim = `${encontro[3]}\n`
  let novo = ''
  if (ficam.length > 0) novo += `import { ${ficam.join(', ')} } from '${encontro[2]}'${fim}`
  novo += `import { ${movidos.join(', ')} } from '@/lib/navigation'${fim}`
  writeFileSync(arquivo, codigo.replace(encontro[0], novo))
  alterados++
}
console.log('arquivos alterados:', alterados)
```

Run: `node /tmp/troca-importacoes.mjs /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas`
Expected: `arquivos alterados: 25` (ou o número de caminhos do Step 2).

- [ ] **Step 4: Confirmar o verde**

Run: `npx jest __tests__/lib/navigation-imports.test.ts`
Expected: PASS, 7 testes. Se sobrar arquivo na lista (importação que o script não casou — ex.: duas
importações do roteador no mesmo arquivo), ajuste **aquele** arquivo à mão, só a linha de importação.

Run: `npx tsc --noEmit`
Expected: sem erro.

- [ ] **Step 5: Frase do guia**

Em `CLAUDE.md:203`, trocar o trecho final:

```
e são validados manualmente no browser.
```

por:

```
e são validados manualmente no browser. A exceção é `__tests__/lib/navigation-imports.test.ts`, uma verificação estática, não de tela: falha se algum arquivo de `src/` importar `Link`, `NavLink` ou `useNavigate` direto do roteador em vez de `@/lib/navigation` — o que faria a página trocar sem a transição.
```

- [ ] **Step 6: Commits (agente principal)**

Dois commits, nesta ordem, para a troca mecânica ficar sozinha:

```bash
git -C /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas add src
git -C /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas commit   # refactor(navegação): as páginas passam a navegar pelo ponto que liga a transição
git -C /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas add __tests__/lib/navigation-imports.test.ts CLAUDE.md
git -C /home/robertogabrieu/iasd-tucuruvi/.claude/worktrees/transicao-paginas commit   # test(navegação): importar navegação direto do roteador passa a falhar no teste
```

---

## Task 3 — Regressão (`testador`)

- [ ] **Step 1:** `npm test` no worktree; comparar **nomes** com o baseline da Task 0. Esperado:
  nenhuma falha nova; 7 testes novos em `navigation-imports.test.ts`.
- [ ] **Step 2:** `npx tsc --noEmit` — sem erro.
- [ ] **Step 3:** `npm run build` — sem erro.

Falha nova vai para o `saneador`, com o dossiê do testador — nunca um implementador por erro.

---

## Task 4 — QA medido (`qa-runner`)

- [ ] **Step 1:** Briefing com a spec §9 **inteira**: §9.1 (ambiente: `.env.local`, Postgres
  acessível, admin pelo seed, portas livres), §9.2 (como medir) e §9.3 (itens). Os itens 13 e 14 só
  valem se a Task 0 marcou `VARIANTE_32` / `VARIANTE_34` como `sim` — diga no briefing quais valem.
- [ ] **Step 2:** Receber a tabela item · status · frase. Item `FALHOU` de comportamento vira pacote
  novo de correção; `PENDENTE` por ambiente volta ao usuário.

---

## Task 5 — Documentação (`documentador`)

- [ ] **Step 1:** `documentador` com a branch e a base `master`. Escopo: navegação passa por
  `@/lib/navigation`, o que esmaece e onde (`page-transition`), e a regra de empilhamento (Global
  Constraints). Ele confere se `CLAUDE.md` ou `docs/patterns/` precisam registrar isso para quem
  cria página nova; a frase de `CLAUDE.md:203` já foi feita na Task 2.

---

## Task 6 — Publicar (`gestor-pr`)

- [ ] **Step 1:** Com Tasks 3 e 4 verdes, `gestor-pr` sobe a branch e atualiza o corpo da PR #36
  (implementação entregue, resultado do gate e da tabela de QA). Tira do rascunho **só** com gate e
  QA sem `FALHOU`; com `PENDENTE`, mantém rascunho e diz o que falta.

---

## Execução

### Níveis

| Nível | O que roda aqui |
|---|---|
| **sessão** | Uma só, **aberta dentro de `/home/robertogabrieu/iasd-tucuruvi`**. Sessão presa a outro repositório não consegue escrever aqui, nem por subagente. Repo único: pode entrar no worktree existente com `EnterWorktree` pelo caminho. |
| **agente principal** | Task 0, as variantes, `git` (merge, commits), revisão dos relatórios com `git diff --stat` e um `git diff` dirigido em `src/App.tsx`. Não escreve código, não lê saída de suíte. |
| **subagente** | `implementador` nas Tasks 1 e 2; `testador` no baseline (Task 0) e na regressão (Task 3); `qa-runner` na Task 4; `documentador` na 5; `gestor-pr` na 6. |

Tudo **sequencial**: a Task 2 depende do ponto único da 1, e o QA precisa das duas.

### A conta do fatiamento

~33 arquivos alterados, mas só 6 carregam decisão; 25 são uma linha de importação trocada por
script.

| Arranjo | Pacotes de código | Avaliação |
|---|---:|---|
| Um pacote só | 1 (33 arquivos) | Mistura decisão com troca mecânica; o implementador relê o desenho enquanto roda o script, e um erro no roteador fica escondido entre 25 diffs de uma linha |
| **Dois pacotes** | **2 (A: 6 · B: 27)** | **A fica na faixa de menor custo por arquivo (6–10). B passa do teto de 15, mas por script: ~30 turnos, e o que encarece pacote grande é o número de passos, não de arquivos** |
| Um pacote por etapa da spec | 4 | O roteador sem o ponto único e o CSS sem marcação não fecham com verificação própria; paga dois pisos (~54k) sem ganho |

**Modelo por pacote:** A com modelo capaz (decisão de roteador e variantes). B com modelo barato —
é script, teste e `tsc`.

**Orçamento de turnos no briefing:** A ~80 · B ~40 · QA ~120.

Overhead estimado: ~36k de sessão + 7 subagentes × ~27k (2 implementadores, testador 2×, QA,
documentador, gestor-pr) = **~225k**. O que justifica é o contexto do principal: saída de suíte,
capturas de QA e leitura de código ficam fora dele.

### Contrato de retorno de cada implementador

1. pacote concluído ou não;
2. arquivos tocados — **caminhos, nunca conteúdo**;
3. resultado dos comandos do "Verificar" da task (`tsc`, jest do arquivo, build): passou / nomes que
   falharam;
4. decisões que teve de tomar sozinho, uma linha cada;
5. pendências.

Sem diff colado, sem trecho de arquivo, sem recapitular spec ou plano.

### Restrição de subida (a decisão de calendário não é deste plano)

Nenhuma migration, variável de ambiente ou passo pós-deploy. A única dependência é de código: se
#32 ou #34 entrarem no `master` **depois** desta branch, o merge dela precisa aplicar a §11 da spec
(onde vai o `ScrollToTop`, onde vai `page-transition`) — não é conflito que o git resolve sozinho de
forma correta.

---

## ONDE FICA

```
ONDE FICA
- roteador montado com BrowserRouter                 src/main.tsx:3 e :9-11
- árvore de rotas a migrar                           src/App.tsx:71-108
- inicialização do AOS                               src/App.tsx:65-67
- rotas com capa em tela cheia (bloco azul)          src/App.tsx:46 e :53-57
- moldura pública (Header, bloco, Outlet, Footer)    src/App.tsx:48-62
- páginas de acesso sem moldura                      src/App.tsx:84-87
- moldura do painel (main a marcar)                  src/painel/PainelLayout.tsx:8
- NavLink com end e className em função              src/painel/Sidebar.tsx:53, :88, :101
- menu flutuante da barra recolhida (z-20)           src/painel/Sidebar.tsx:97
- modal em portal no body (z-30)                     src/painel/components/Modal.tsx:12-13
- import de AuthProvider hoje                        src/App.tsx:40
- fim do CSS global (acrescentar depois)             src/globals.css:122
- CSS puro fora de @layer (precedente)               src/globals.css:29 (.boletim-prose)
- ambiente node do Jest                              jest.config.cjs:4
- frase do guia a completar                          CLAUDE.md:203
- catch-all do Express                               server/index.ts:185-187
- 25 arquivos que importam Link/NavLink/useNavigate  src/components/{Footer,GaleriaPreview,Header,SermoesPreview}.tsx
                                                     src/pages/{AceitarConvite,Desbravadores,Especialidades,EsqueciSenha,
                                                       EventoPublico,Eventos,Login,RedefinirSenha}.tsx
                                                     src/painel/Sidebar.tsx · src/painel/ui/{AuthCard,Button}.tsx
                                                     src/painel/pages/{BoletimEditor,Boletins,Dashboard,EventoEditor,
                                                       EventoPreview,EventosLista,Formularios,Templates,
                                                       UsuarioDetalhe,UsuariosLista}.tsx
- PRs abertas que mudam a Task 1                     #32 (ScrollToTop fora das rotas) · #34 (coluna do PublicLayout)
- conferido em                                       2593673
```
