# US-13 — Menu lateral colapsável do painel

**Épico:** Interface do Painel · **Prioridade:** Must · **Estimativa:** 5 pts

> ✅ **Entregue** em `77a69cb`, `2509a18`, `f30cc4a`, `90307d5`, `a0547f3` — branch `feat/area-administrativa`. Ver [spec](../superpowers/specs/2026-06-15-painel-config-crypto-design.md) e [plano](../superpowers/plans/2026-06-15-painel-config-crypto.md).

## História

> **Como** Administrador,
> **eu quero** um menu lateral que eu possa colapsar e que lembre meu estado entre telas e recarregamentos,
> **para que** eu navegue pelo painel de forma rápida e do meu jeito, sem reconfigurar a cada acesso.

## Critérios de aceitação

### CA-01 — Logo fixo no topo
- **Given** que estou no painel administrativo
- **When** o menu lateral é exibido
- **Then** o logo do site aparece fixo no topo do menu
- **And** com o menu expandido, o logo vem acompanhado do nome do site; no modo trilho (colapsado), apenas o logo.

### CA-02 — Colapsar/expandir (trilho de ícones)
- **Given** o menu expandido
- **When** clico no botão de colapsar
- **Then** o menu encolhe para um **trilho estreito só com ícones**
- **And** ao expandir novamente, os rótulos de texto voltam a aparecer
- **And** a transição entre os dois estados é suave.

### CA-03 — Persistência do estado de colapso
- **Given** que colapsei (ou expandi) o menu
- **When** navego para outra tela do painel **ou** recarrego a página
- **Then** o menu reaparece no **mesmo estado** (colapsado/expandido) que eu deixei
- **And** esse estado é guardado no `localStorage`.

### CA-04 — Submenus colapsáveis
- **Given** um item de menu com subitens (ex.: "Conteúdo", "Usuários")
- **When** clico nesse item
- **Then** seus subitens expandem/recolhem (o indicador visual — chevron — reflete o estado)
- **And** o conjunto de submenus abertos também **persiste** entre telas e recarregamentos (`localStorage`).

### CA-05 — Submenu no modo trilho (flyout)
- **Given** que o menu está colapsado (trilho de ícones)
- **When** passo o mouse sobre um item que tem subitens
- **Then** os subitens aparecem num **flyout** ao lado do trilho, sem precisar expandir o menu inteiro.

### CA-06 — Item ativo destacado
- **Given** que estou numa rota do painel
- **When** o menu é renderizado
- **Then** o item correspondente à rota atual fica visualmente destacado (estado ativo).

### CA-07 — Botão de logout fixo no rodapé
- **Given** o menu lateral (colapsado ou expandido)
- **When** olho para o rodapé do menu
- **Then** há um botão **Sair** fixo, sempre visível, independentemente da rolagem da lista de itens
- **And** acioná-lo encerra a sessão (ver **US-02**) e me leva para a tela de login.

### CA-08 — Estrutura de navegação
- **Given** o menu expandido
- **When** vejo os itens
- **Then** a estrutura é: **Dashboard**; **Conteúdo** (Sermões, Galeria, Departamentos); **Usuários** (Lista, Convites, Papéis); **Configurações**; e **Sair** no rodapé.

## Notas técnicas (orientação para implementação)
- Componente **isolado** do site público (sem o `Header`/`Footer` institucional); destinado ao shell `/admin/*`.
- Sugestão de arquivos: hook reutilizável de persistência (state ↔ `localStorage`), config de itens separada da UI, e o componente `Sidebar`.
- Chaves de `localStorage` sugeridas: `admin.sidebar.collapsed` (boolean) e `admin.sidebar.openGroups` (lista de chaves).
- Navegação/estado ativo via `NavLink` do React Router (já no projeto). Paleta `iasd-dark`/`iasd-accent` do Tailwind. Logo em `/img/logo-iasd.svg`.
- Ícones como **SVG inline** (sem adicionar dependência).
- O botão Sair pode chamar `POST /api/auth/logout` (stub até o backend da auth existir) e redirecionar para `/admin/login`.

## Dependências
- Relaciona-se com **US-02** (Logout) para a ação do botão Sair.

## Definição de pronto
- [ ] Colapso/expansão em trilho de ícones com transição.
- [ ] Estado de colapso e submenus abertos persistem entre navegação e reload.
- [ ] Logo fixo no topo e botão Sair fixo no rodapé.
- [ ] Item ativo destacado; flyout de submenu no modo trilho.
- [ ] Validado manualmente no browser.
