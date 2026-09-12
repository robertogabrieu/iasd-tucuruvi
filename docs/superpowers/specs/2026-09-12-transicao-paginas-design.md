# Transição entre páginas — a página que sai esmaece e a que entra aparece

**Branch:** `spec/transicao-paginas` · **Base conferida:** `origin/master` em `2593673`

**Modelo:** o mesmo efeito já implementado no Desbravadores Finance
(`robertogabrieu/desbravadores-finance#139`), que usa a mesma versão do React Router (7.13.2).
É ele que o usuário viu e aprovou funcionando; esta spec adapta o desenho às diferenças do site.

**Sem mockup:** a mudança não altera layout nenhum — nada muda de lugar, de tamanho ou de cor.
O que ela muda é o **tempo** da troca, e isso se aprova olhando o efeito no navegador (§9), não num
desenho estático.

---

## 1. O que esta spec decide

| # | Decisão | Resolução |
|---|---|---|
| 1 | Como disparar a transição | Transição nativa do navegador (View Transitions), ligada pelo React Router com a opção `viewTransition` — sem biblioteca nova. |
| 2 | O roteador precisa mudar? | **Sim.** O site monta o roteador com `<BrowserRouter>`, e nesse modo a opção `viewTransition` é descartada (§3). Passa para `createBrowserRouter` + `<RouterProvider>`, com a **mesma árvore de rotas**. |
| 3 | Onde a transição é ligada | Num ponto único, `src/lib/navigation.tsx`, que reexporta `Link`, `NavLink` e `useNavigate` com a mesma assinatura e liga a transição só quando o destino é **outra página**. |
| 4 | O que esmaece | Só o conteúdo. O cabeçalho fixo do site e a barra lateral do painel trocam na hora (§4.3). |
| 5 | Tempos | A página que sai some em **0,1s**; a que entra aparece em **0,16s**, começando **0,06s** depois. Total ~0,22s. |
| 6 | Quem pediu menos movimento | Sem animação: a troca é imediata (`prefers-reduced-motion`). |
| 7 | Como impedir que página nova esqueça do efeito | Sem ESLint no repositório, a trava é um teste em `__tests__/` que falha se algum arquivo importar `Link`, `NavLink` ou `useNavigate` direto do roteador (§4.5). |

---

## 2. Escopo

**Entra:**

- migração de `<BrowserRouter>` para `createBrowserRouter` + `<RouterProvider>`, sem mudar caminho,
  proteção ou permissão de nenhuma rota;
- `src/lib/navigation.tsx` com `Link`, `NavLink` e `useNavigate`;
- troca das importações nos 25 arquivos que hoje importam navegação direto do roteador (lista no
  bloco ONDE FICA);
- a marcação do que esmaece nas três molduras (site público, painel, páginas soltas de acesso);
- o CSS da transição em `src/globals.css`;
- o teste-trava em `__tests__/`.

**Fica fora:**

- **voltar pelo botão ou gesto do navegador.** O React Router só aplica a transição em navegação
  para frente; voltar continua trocando seco. É o mesmo limite registrado no Desbravadores, e o
  conserto, se vier, vale para os dois projetos;
- **restauração de rolagem** (`<ScrollRestoration>`). O site hoje não restaura nem rola ao topo
  na troca de página (nenhum `scrollTo`/`ScrollRestoration` em `src/`); a migração de roteador não
  muda isso, e adotar é decisão à parte;
- **dados que chegam depois.** Nove páginas buscam dados em `useEffect` depois de montar
  (ex.: `src/pages/Home.tsx`, `Sermoes.tsx`, `Galeria.tsx`, `Eventos.tsx`). A transição cobre a troca
  de página; o conteúdo que chega depois continua aparecendo como aparece hoje;
- mexer no AOS (animação ao rolar), no menu mobile ou nas cores do cabeçalho por departamento.

---

## 3. Por que o roteador precisa mudar

A opção `viewTransition` existe em `Link` e `navigate` nos dois modos do React Router, mas só
**faz algo** no roteador de dados:

- no modo `<BrowserRouter>` (`src/main.tsx:9-11`), o `navigate` repassa as opções ao histórico do
  navegador — `navigator.push(path, options.state, options)`
  (`node_modules/react-router/dist/development/chunk-UVKPFVEO.mjs:5705-5709`) — e o `push` desse
  histórico só aceita destino e estado: `function push(to, state)` (mesmo arquivo, `:295`).
  A opção morre ali;
- `document.startViewTransition` só é chamado dentro de `RouterProvider`
  (mesmo arquivo, `:6391` e `:6430-6515`).

Chamar `document.startViewTransition` à mão em volta do `navigate`, mantendo `<BrowserRouter>`, foi
considerado e descartado: exigiria forçar a renderização síncrona da página nova (`flushSync`) no
tempo certo, código de sincronização que a biblioteca já tem pronto e testado no outro modo.

---

## 4. Desenho

### 4.1 Roteador de dados

- `src/App.tsx` passa a exportar o roteador: `createBrowserRouter(createRoutesFromElements(...))`
  com **a mesma árvore** de `src/App.tsx:71-108` — mesmos caminhos, mesmo `PublicLayout`, mesmo
  `ProtectedRoute` e `RequirePermission` em volta das mesmas páginas.
- A inicialização do AOS (`src/App.tsx:65-67`) vai para o elemento da rota raiz (um layout que só
  roda o efeito e renderiza `<Outlet />`), para continuar rodando uma vez só.
- `src/main.tsx` renderiza `<AuthProvider><RouterProvider router={router} /></AuthProvider>` dentro
  do mesmo `<StrictMode>`. O `AuthProvider` pode ficar **fora** do roteador: nada em `src/auth/`
  usa gancho de roteador — o único uso é o `<Navigate>` de `src/auth/ProtectedRoute.tsx:8`, que
  roda dentro das rotas e continua funcionando.
- As quatro páginas de acesso sem moldura (`src/App.tsx:84-87`) passam a ficar sob uma rota de
  layout sem caminho (§4.3). Os caminhos não mudam.

### 4.2 Ponto único de navegação — `src/lib/navigation.tsx`

Reexporta, com a assinatura do React Router:

- **`Link`** — liga `viewTransition` quando o caminho resolvido do destino (`useResolvedPath`) é
  diferente do caminho atual (`useLocation().pathname`). Quem passa `viewTransition` explicitamente
  vence.
- **`NavLink`** — a mesma regra. É necessário porque a barra lateral do painel usa `NavLink` com
  `end` para marcar o item ativo (`src/painel/Sidebar.tsx:53`, `:88`, `:101`).
- **`useNavigate`** — devolve uma função **estável**: lê o caminho atual na hora da chamada
  (`window.location.pathname`), e não por `useLocation`, para que efeito que dependa de `navigate`
  não rode de novo a cada troca de página. `navigate(número)` (voltar/avançar no histórico) passa
  direto, sem transição.

O que **não** anima, por construção:

- clicar no link da página em que já se está;
- rolar até uma seção **na mesma página** — o cabeçalho, já em `/`, chama `scrollIntoView` sem
  passar pelo roteador (`src/components/Header.tsx:97-99`);
- `<Navigate>` de redirecionamento (ex.: `src/auth/ProtectedRoute.tsx:8`) — ele não passa pelo
  ponto único.

O que **anima**, e está certo que anime: ir de uma subpágina para uma seção da Home
(`navigate('/#' + id)`, `src/components/Header.tsx:102`) — o caminho muda de `/sermoes` para `/`.

### 4.3 O que esmaece

A transição anima só o elemento com a classe `page-transition`. **Só pode haver um por página**:
dois elementos com o mesmo nome de transição fazem o navegador pular a animação.

| Moldura | Onde entra `page-transition` | O que fica parado |
|---|---|---|
| Site público — `PublicLayout` (`src/App.tsx:48-62`) | Um `div` novo envolvendo o bloco azul atrás do cabeçalho (`:57`), o `<Outlet />` (`:58`) e o `<Footer />` (`:59`) | `<Header />` (`:56`), que é `fixed` (`src/components/Header.tsx:110`) |
| Painel — `PainelLayout` (`src/painel/PainelLayout.tsx:4-13`) | O `<main>` (`:8`) | `<Sidebar />` (`:7`) |
| Páginas de acesso — `/login`, `/esqueci-senha`, `/redefinir-senha`, `/aceitar-convite` | Rota de layout nova, sem caminho, com um `div` `page-transition` em volta do `<Outlet />` | nada |

Por que o bloco azul e o rodapé entram no que esmaece: o bloco azul aparece ou some conforme a página
tenha capa em tela cheia (`ROTAS_COM_HERO`, `src/App.tsx:46` e `:53-57`). Deixado de fora, ele
trocaria na hora enquanto o conteúdo ainda esmaece, e apareceria um instante de faixa azul sobre a
página antiga. O rodapé muda de altura de página para página; fora do esmaecimento, ele saltaria
antes do conteúdo.

### 4.4 CSS — `src/globals.css`

Em **CSS puro, fora de `@layer`**: o Tailwind do projeto é o 3 (`package.json:66`), que não tem
`@utility`, e as regras de pseudo-elemento de transição não são classes que o Tailwind reconheça.

```css
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

@keyframes page-fade-out { to { opacity: 0; } }
@keyframes page-fade-in { from { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(page),
  ::view-transition-new(page) {
    animation: none;
  }
}
```

Por que desligar a animação padrão de `root`: sem isso, o navegador aplica a toda a página uma
animação de 0,25s que não se vê (a moldura não muda de tamanho), mas durante a qual o clique
seguinte não chega à página. Medido no Desbravadores.

Hoje não há `prefers-reduced-motion` em nenhum lugar do site. Esta regra cobre só a transição nova;
não se estende ao AOS nem ao `scroll-behavior: smooth` de `src/globals.css:5-7`.

### 4.5 Trava — `__tests__/lib/navigation-imports.test.ts`

Varre `src/**/*.{ts,tsx}` e falha nomeando o arquivo quando algum, fora de `src/lib/navigation.tsx`,
importar `Link`, `NavLink` ou `useNavigate` de `react-router` ou `react-router-dom`. A mensagem
aponta o ponto único.

É teste de leitura de arquivo, não de componente: roda no ambiente `node` que o Jest do projeto já
usa (`jest.config.cjs:4`) e entra em `npm test` sem configuração nova. Sem ele, uma página nova que
importe direto do roteador troca seco, e ninguém percebe até notar a diferença no uso.

---

## 5. Riscos do site e o que a spec faz com cada um

| Risco | Onde | Tratamento |
|---|---|---|
| AOS anima blocos ao entrarem na tela; esmaecimento de página junto pode parecer piscada dupla | `src/App.tsx:66` (`duration: 800`, `once: true`); ex. `src/components/AoVivo.tsx:43` e `:60` | Nada muda no AOS. Os tempos são curtos (0,16s contra 0,8s), então a página termina de aparecer antes de o AOS começar a pesar. **Conferir na Home no QA** (§9, item 6). |
| Home rola até a seção 60ms depois de montar | `src/pages/Home.tsx:15-22` | A página nova é uma imagem ao vivo durante a transição: a rolagem aparece normalmente enquanto ela surge. **Conferir no QA** (§9, item 5). |
| Vídeo do YouTube recarrega ao montar | `src/components/AoVivo.tsx:62` | Comportamento de hoje, não piora: a página antiga vira imagem estática ao sair, e o vídeo da nova carrega por trás do esmaecimento. |
| Menu mobile tem transição própria de 0,3s e fecha ao trocar de página | `src/components/Header.tsx:45-48` e `:216` | O cabeçalho está fora do que esmaece, então o menu fecha com a própria animação, como hoje. |
| Cor do cabeçalho muda por departamento | `src/components/Header.tsx:73-82` e `:110` (`transition-colors duration-300`) | Idem: cabeçalho fora do esmaecimento; a troca de cor segue igual. |
| Navegador sem suporte a View Transitions | — | O React Router só chama a transição quando `document.startViewTransition` existe (`chunk-UVKPFVEO.mjs:6430`); sem ele, a troca é seca, como hoje. |

---

## 6. Descobribilidade

As quatro perguntas de `~/.claude/rules-sob-demanda/ux-na-spec.md`:

**Pré-requisitos.** Nenhum: o efeito não depende de configuração nem de cadastro.

**Vazio.** Não se aplica — nenhuma tela nova, nenhum dado novo. Páginas que carregam dados depois
de montar continuam mostrando o que mostram hoje enquanto esperam (§2, "fica fora").

**Bloqueio.** Não se aplica — nenhuma ação nova é impedida.

**Perfil e escopo.** O efeito é igual para visitante, usuário do painel e qualquer permissão.
`ProtectedRoute` e `RequirePermission` continuam decidindo o acesso de cada rota exatamente como
em `src/App.tsx:88-105`.

---

## 7. O que NÃO quebra

- **Caminhos das rotas.** A árvore é copiada para `createRoutesFromElements` sem mudança; nenhum
  link externo, compartilhamento de evento ou boletim muda de endereço.
- **Servidor.** O Express não conhece as rotas de tela; a mudança é só no front.
- **`useLocation`, `useParams`, `Outlet`, `<Navigate>`** funcionam igual no roteador de dados — as
  páginas que só usam esses continuam intocadas.
- **Item ativo da barra lateral do painel.** `NavLink` com `end` mantém a mesma assinatura no
  ponto único (§4.2).
- **Rolagem até seção da Home** a partir do cabeçalho (`src/components/Header.tsx:92-104`, e
  `src/pages/Home.tsx:15-22`): continua acontecendo; só ganha o esmaecimento quando vem de outra
  página.
- **Testes existentes** (`__tests__/`, funções puras): nenhum importa componente de navegação; só
  ganham o teste-trava novo.

---

## 8. Verificação

Não há CI no repositório (nenhum `.github/workflows/`) nem lint configurado. O guia do projeto manda
validar telas no navegador (`CLAUDE.md:203`). O gate desta entrega é:

1. `npm test` verde, incluindo o teste-trava;
2. `npm run build` sem erro (Vite + `tsc` do servidor — `CLAUDE.md:190`);
3. o roteiro de §9 executado no navegador, com **medição**, não olho.

---

## 9. Roteiro de QA — medir, não olhar

Medir instrumentando `document.startViewTransition` e lendo `document.getAnimations()` durante a
transição (as animações de pseudo-elemento expõem nome, duração e atraso). Instrumentar **uma vez
por página carregada** — instalar duas vezes conta cada troca em dobro.

| # | Situação | Esperado |
|---|---|---|
| 1 | Cabeçalho: Home → Sermões (desktop, 1280px) | 1 transição; `page-fade-out 100ms` e `page-fade-in 160ms+60ms`; nenhuma animação em `root` |
| 2 | Clicar em Sermões estando em Sermões | 0 transições |
| 3 | Menu mobile (400px): abrir e ir para Eventos | 1 transição; menu fecha com a animação própria |
| 4 | Painel: barra lateral, Boletins → Eventos | 1 transição; `main` esmaece, barra lateral parada; item ativo muda |
| 5 | Estando em Sermões, clicar em "Sobre" | 1 transição (caminho muda para `/`) e a página rola até a seção |
| 6 | Home recém-aberta pelo cabeçalho | Blocos com AOS aparecem sem piscada dupla visível |
| 7 | Estando na Home, clicar em "Ao Vivo" | 0 transições; só rolagem suave |
| 8 | `/login` → "Esqueci a senha" | 1 transição |
| 9 | Acessar `/painel` sem sessão | Redireciona para `/login` sem transição |
| 10 | Com "menos movimento" emulado (`emulateMedia({ reducedMotion: 'reduce' })`) | Transição acontece sem nenhuma animação de `page` |
| 11 | Botão voltar do navegador | Volta sem transição (limite registrado em §2) |

---

## 10. Execução

**A conta.** A parte com decisão toca 6 arquivos (`src/main.tsx`, `src/App.tsx`,
`src/lib/navigation.tsx`, `src/painel/PainelLayout.tsx`, `src/globals.css` e o teste-trava). A troca
das importações toca 25 arquivos, mas é mecânica — uma substituição por script, conferida pelo
próprio teste-trava. Somando, fica abaixo do mínimo de um pacote delegado que valha o piso de um
subagente para a parte com decisão, e a troca mecânica não se beneficia de delegação.

**Níveis:**

- **sessão** — uma só, no worktree `.claude/worktrees/transicao-paginas`, branch
  `spec/transicao-paginas`;
- **agente principal** — implementa inline, na ordem: roteador de dados → ponto único → marcação
  e CSS → troca das importações → teste-trava. Roda git e commita por etapa;
- **subagente** — só o QA de §9 (`qa-runner`), para as capturas e medições não entrarem no contexto
  do principal.

**Commits sugeridos,** cada um deixando o projeto íntegro: (1) roteador de dados, sem nenhum efeito
visível; (2) ponto único + marcação + CSS; (3) troca mecânica das importações, sozinha; (4)
teste-trava. A trava vem por último porque, antes da troca, ela falharia nos 25 arquivos.

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
- painel protegido e permissões por rota             src/App.tsx:88-107
- moldura do painel                                  src/painel/PainelLayout.tsx:4-13
- NavLink com end na barra lateral                   src/painel/Sidebar.tsx:2, :53, :88, :101
- redirecionamento sem sessão                        src/auth/ProtectedRoute.tsx:8
- cabeçalho fixo e transição de cor                  src/components/Header.tsx:110
- fecha menu ao trocar de página                     src/components/Header.tsx:45-48
- rolagem até seção: mesma página x outra página     src/components/Header.tsx:92-104
- menu mobile com transição própria                  src/components/Header.tsx:216
- Home rola até o hash com atraso de 60ms            src/pages/Home.tsx:15-22
- AOS e vídeo embutido em Ao Vivo                    src/components/AoVivo.tsx:43, :60, :62
- rolagem suave global                               src/globals.css:5-7
- alcance do Tailwind 3                              tailwind.config.ts:4 · package.json:66
- versões de React, React Router e AOS               package.json:42, :45, :31
- ambiente do Jest (node)                            jest.config.cjs:4
- build e testes no guia                             CLAUDE.md:190, :203
- navigate declarativo repassa ao histórico          node_modules/react-router/dist/development/chunk-UVKPFVEO.mjs:5672-5709
- push do histórico só aceita destino e estado       chunk-UVKPFVEO.mjs:295
- startViewTransition só no RouterProvider           chunk-UVKPFVEO.mjs:6391, :6430-6515
- arquivos que importam Link/NavLink/useNavigate     src/components/{Footer,GaleriaPreview,Header,SermoesPreview}.tsx
                                                     src/pages/{AceitarConvite,Desbravadores,Especialidades,EsqueciSenha,
                                                       EventoPublico,Eventos,Login,RedefinirSenha}.tsx
                                                     src/painel/Sidebar.tsx · src/painel/ui/{AuthCard,Button}.tsx
                                                     src/painel/pages/{BoletimEditor,Boletins,Dashboard,EventoEditor,
                                                       EventoPreview,EventosLista,Formularios,Templates,
                                                       UsuarioDetalhe,UsuariosLista}.tsx
- conferido em                                       2593673 (código) · react-router 7.13.2 instalado no checkout principal
```
