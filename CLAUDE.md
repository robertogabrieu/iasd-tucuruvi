# IASD Tucuruvi — Site Institucional com Engajamento

## Links Oficiais

- **YouTube:** https://www.youtube.com/@IASDTucuruviOficial (Channel ID: UCvtcRQ8TcPLZn5dP42bODFg)
- **Flickr:** https://www.flickr.com/photos/198977834@N03/ (8.166 fotos)
- **Flickr Álbum Galeria:** https://www.flickr.com/photos/198977834@N03/albums/72177720318202645 (70 Anos)
- **Instagram:** https://www.instagram.com/iasdtucuruvi/
- **Linktree:** https://linktr.ee/iasdtucuruvi

## Endereço e Contato

- R. Cruz de Malta, 1201 — Parada Inglesa, São Paulo - SP, 02248-001
- Telefone: (11) 2981-6615

## Horários de Culto

- Sábado — Culto: 9h30
- Domingo — Culto: 19h00
- Quarta-feira — Culto: 20h00

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Roteamento:** React Router DOM v7
- **Backend:** Express 5 (serve SPA + API pública + API administrativa)
- **Banco de dados:** PostgreSQL 16 (área administrativa — auth + RBAC)
- **Autenticação:** JWT (access + refresh) em cookies `httpOnly`, hash de senha com argon2id
- **Estilo:** Tailwind CSS
- **Animações:** AOS (Animate On Scroll) + CSS keyframes customizados
- **Formulário:** React Hook Form + Zod (validação) → Express API → Nodemailer (oculto até SMTP ser configurado)
- **Email (dev):** Mailpit via Docker
- **Infraestrutura:** Docker Compose (app + db + mailpit)
- **Deploy:** Contabo VPS + Docker
- **Scripts:** `deploy.sh` (setup interativo + geração de segredos + Docker) e `update.sh` (git pull + rebuild)

## Identidade Visual

- Seguir identidade oficial da IASD
- Cores: azul escuro `#003366`, branco `#FFFFFF`, azul accent `#0055AA`, cinza claro `#F5F5F5`
- Tipografia: Inter (corpo) + Montserrat (títulos) — Google Fonts CDN
- Logo temporário: `/public/img/logo-iasd.png` (bordas arredondadas)
- Header com glassmorphism: `bg-iasd-dark/70 backdrop-blur-lg border-b border-white/10`

## Arquitetura de Páginas

Modelo híbrido (SPA com React Router + páginas dedicadas):

- `/` — página principal com seções em scroll contínuo
- `/sermoes` — página dedicada com 12 vídeos do YouTube
- `/galeria` — página dedicada com fotos do álbum "70 Anos" do Flickr
- `/desbravadores` — página dedicada do Clube Antares (primeira página de departamento, usa o padrão descrito em `docs/patterns/pagina-departamento.md`)

### Páginas de departamento

Cada clube/departamento com página própria (Desbravadores, futuros Aventureiros etc.) segue uma receita padronizada: estrutura fixa de 5 seções (Hero, Sobre, Quem pode participar, Galeria em carrossel, Fale conosco), paleta própria no Tailwind, header trocando de cor via `useLocation`. Receita completa em `docs/patterns/pagina-departamento.md` — consultar antes de criar nova página de departamento.

### Boletim Informativo (US-16/17/18/19)

Artigo semanal compartilhado no WhatsApp. Editado no painel (`/painel/boletins` + editor `/painel/boletins/:id`, perm `boletim:write`), publicado por slug (perm `boletim:publish`) e servido na rota pública `/boletins/:slug` (full width, fundo padronizado; 404 para rascunho). Conteúdo é **JSONB em linhas → colunas → blocos** (Título, Texto rico/TipTap, Imagem, Galeria, Vídeo do YouTube), com drag-and-drop (dnd-kit) entre colunas/linhas; imagens vêm da biblioteca de mídia (US-17). O **renderer compartilhado** `src/components/boletim/BulletinRenderer` é usado tanto pela página pública quanto pela pré-visualização do editor (`/painel/boletins/:id/preview`). **Open Graph injetado server-side só em produção** (Express edita o `dist/index.html`; em dev sob o Vite não injeta), compondo `og:url`/`og:image` a partir da env **`PUBLIC_BASE_URL`** (URL pública absoluta do site).

### Seções da Página Principal

1. **Hero** — fundo azul escuro com foto da igreja (10% opacidade), título "Adventistas Tucuruvi", versículo (text-blue-300), countdown pro próximo culto (glass card), CTA "Assista ao Vivo"
2. **Sobre** — história (70+ anos), horários de culto, botão Waze (logo oficial + cor #33CCFF), endereço + Google Maps embed
3. **Ao Vivo / Últimos Vídeos** — título dinâmico: detecta se há live ativa via oEmbed do YouTube. Se ao vivo: título "Ao Vivo" com bolinha vermelha pulsante. Se não: "Últimos Vídeos"
4. **Estudos Bíblicos** — formulário de cadastro (temporariamente oculto até configurar SMTP)
5. **Sermões** — preview dos 4 últimos vídeos + link "Ver todos" → `/sermoes`
6. **Galeria** — preview de 6 fotos do Flickr (álbum 70 Anos) + link "Ver todas" → `/galeria`
7. **Footer** — endereço completo, telefone, redes sociais (YouTube, Instagram, Flickr, Linktree), links rápidos

## Integrações

- **Flickr API** — feed público (sem API key) via proxy Express (`/api/flickr/album`). Galeria puxa do álbum `72177720318202645`. Cache de 1h em memória no servidor
- **YouTube oEmbed** — detecção de live ativa. Re-checagem a cada 2 min no client
- **YouTube embed** — playlist de uploads (`UU` prefix) quando não há live
- **Google Maps embed** — localização da igreja na seção Sobre
- **Waze deep link** — botão na seção Sobre abre navegação direta

## Segurança

- Rate limiting na API de email (5 req/min por IP)
- Honeypot field no formulário (anti-bot)
- Zod validation server-side + client-side
- Sanitização de inputs (strip HTML tags)
- Security headers via reverse proxy (nginx) em produção

## Layout

- Todas as seções limitadas a `max-w-5xl` centralizado
- Títulos centralizados (`text-center`) com animação `fade-up`
- Dividers diagonais entre seções via `clip-path: polygon()`
- Cards de vídeo com título `line-clamp-2` + `min-h-[2.5rem]` para altura uniforme

## Backend — Área Administrativa, Autenticação e RBAC

A área administrativa (login, recuperação de senha, gestão de usuários) vive no **mesmo servidor Express**, sob o prefixo `/api/auth/*` e `/api/admin/*`. As APIs públicas existentes (`/api/flickr`, `/api/youtube`, `/api/contato`) permanecem intactas. As histórias de usuário desta área estão em `docs/historias/`.

### Arquitetura em camadas (padrão obrigatório do backend)

Todo código novo do backend segue uma arquitetura em camadas com responsabilidade única. Organização por **módulo** (feature), não por tipo técnico:

```
server/
├── modules/<feature>/
│   ├── <feature>.controller.ts   # HTTP fino: valida DTO, chama service, monta resposta. SEM regra de negócio.
│   ├── <feature>.service.ts      # Regra de negócio. Não conhece req/res nem SQL.
│   ├── <feature>.repository.ts   # Único ponto que fala com o Postgres (SQL isolado aqui).
│   ├── <feature>.routes.ts       # Liga rotas → controller + middlewares.
│   └── dto/                      # Schemas Zod de entrada/saída.
├── core/
│   ├── errors.ts                 # Hierarquia AppError → UnauthorizedError, NotFoundError, etc.
│   ├── error-handler.ts          # Middleware central: traduz AppError → resposta HTTP.
│   ├── security/
│   │   ├── password.ts           # Value object: hash/verify argon2id.
│   │   └── token.service.ts      # Emite/valida JWT, rotação de refresh token.
│   └── db.ts                     # Pool pg + runner de migrations.
└── container.ts                  # Composition root: instancia e injeta as dependências.
```

**Regra de fluxo:** `routes → controller → service → repository → db`. Uma camada só conhece a camada imediatamente abaixo. O controller nunca executa SQL; o service nunca toca `req`/`res`; o repository nunca contém regra de negócio.

### Design patterns adotados (4 — todos com propósito)

1. **Repository** — isola todo o SQL. Serviços dependem da abstração do repositório, nunca do `pg` diretamente. Torna a regra de negócio testável e o banco substituível.
2. **Service Layer** — concentra a regra de negócio fora do HTTP, reutilizável por rotas, seed e CLI.
3. **Injeção de dependência por construtor**, montada num **composition root** único (`container.ts`). Sem container "mágico" nem decorators — mantém o Express idiomático e as dependências explícitas.
4. **Hierarquia de erros + handler central** — qualquer camada faz `throw new UnauthorizedError(...)`; um único middleware traduz para HTTP. Elimina `try/catch` repetido e respostas inconsistentes.

### Regra anti-complexidade (classes com propósito)

Uma **classe** só nasce quando carrega **estado + comportamento coeso** e tem (ou terá) **mais de um consumidor**. Caso contrário, use uma **função pura** em `*.utils.ts`. Proibido criar classe minúscula e ultra-específica que só adiciona indireção (ex.: uma classe para formatar uma string). Prefira poucas classes bem definidas a muitas triviais.

### RBAC (Role-Based Access Control)

Usuários são **genéricos** (tabela `users`, sem `admin_users`). A autorização é **granular por permissão**, não por nome de role:

- `users` ⟶ `user_roles` ⟶ `roles` ⟶ `role_permissions` ⟶ `permissions`.
- Acesso ao painel = ter ≥1 role com a permissão exigida.
- Middleware `requirePermission('users:invite')` autoriza por **permissão** (mais flexível que checar o nome da role).
- Hoje existe **1 role** (`admin`, com todas as permissões), mas o schema já suporta múltiplas roles — adicionar `editor`, `viewer` etc. é só inserir linhas, **sem migration**.
- **O papel `admin` sempre detém TODAS as permissões.** O seed (`runSeed`) religa todas as permissões do catálogo ao `admin` **a cada boot** do servidor (`linkAllPermissions`), então uma permissão nova no catálogo é concedida ao admin no próximo start. Para reaplicar sob demanda (sem reiniciar, ou após inserir permissão direto no banco): **dev** `npm run grant:admin-permissions` (fonte+`tsx`; carregue o env, ex.: `tsx --env-file=.env.dev.local server/scripts/grant-admin-permissions.ts`); **deploy/prod** `npm run grant:admin-permissions:prod` (= `node dist-server/scripts/grant-admin-permissions.js`, após `npm run build`; lê `DATABASE_URL` do ambiente). A imagem de produção **não** contém o fonte `server/`, só o `dist-server/` — por isso o pipeline usa a variante `:prod` compilada.
- **Reset de senha do admin (CLI).** Para redefinir a senha de um usuário pelo e-mail e desbloquear a conta (sem mexer no banco): **dev** `npm run reset:admin-password -- <email> <novaSenha>` (carregue o env, ex.: `tsx --env-file=.env.dev.local server/scripts/reset-admin-password.ts <email> <novaSenha>`); **deploy/prod** `docker compose exec app node dist-server/scripts/reset-admin-password.js <email> <novaSenha>`. Sem argumentos usa `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` do ambiente. A nova senha precisa atender à política (8+ caracteres, 1 maiúscula, 1 número, 1 símbolo) — o `deploy.sh` gera a senha inicial já com sufixo que satisfaz a política.
- **E-mail OAuth2 (Gmail).** Além do SMTP por senha (Mailpit/dev, App Password), o painel (`/painel/configuracoes`) suporta envio via **Gmail API** (`gmail.send`): seletor `authType` (`smtp`/`gmail_oauth2`); fluxo "Conectar conta Google" → consentimento → callback `/api/admin/settings/email/oauth/callback` (autenticado por `state` assinado, **sem** `requireAuth`, pois os cookies são `SameSite=Strict`). `client_id`/`client_secret` vêm do **env** (`GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`); o **refresh token** fica cifrado no banco (US-15). Envio monta o MIME com `MailComposer` (nodemailer) e renova o access token sozinho. Requer `PUBLIC_BASE_URL` absoluto (redirect URI) e o app OAuth **publicado** no Google Cloud (senão o refresh token expira em 7 dias).
- **Sem multi-tenant.**

### Modelo de dados (Postgres)

`users` · `roles` · `permissions` · `user_roles` (N:N) · `role_permissions` (N:N) · `refresh_tokens` · `password_reset_tokens` · `invitations`. Tokens (refresh, reset, convite) são guardados **hashados**; senhas com **argon2id**.

### Segurança da área administrativa

- **JWT em cookie `httpOnly` + `Secure` + `SameSite=Strict`** — access curto (~15 min) + refresh longo (~7 dias).
- **Refresh rotation** com detecção de reuso (revoga a família de tokens).
- **Anti força-bruta**: rate-limit por IP + lockout progressivo por conta (`failed_login_count` → `locked_until`).
- **Recuperação de senha não vaza existência de conta** (resposta sempre genérica) e usa token de **uso único** com expiração curta.
- **Bootstrap** do primeiro usuário/role via seed (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`), executado uma vez no boot.
- Migrations e seed rodam no startup do servidor; `deploy.sh` gera todos os segredos com `openssl`.

## Dev

- **Dev frontend:** `npm run dev` (Vite :5173, proxy `/api` → Express :3001)
- **Dev backend:** `npm run dev:server` (Express :3001)
- **Build:** `npm run build` (Vite → `dist/`, tsc → `dist-server/`)
- **Prod:** `npm start` (Express serve tudo na porta 3001)
- **Docker:** `docker compose up --build` (porta 3001)

## Convenções de código

- **Path alias:** `@/*` → `src/*` (configurado em `vite.config.ts`). Usar em imports do frontend.
- **Dois tsconfigs:** `tsconfig.json` (frontend, bundler mode) e `tsconfig.server.json` (backend, emite ESM para `dist-server/`).
- **ESM no backend:** `package.json` tem `"type": "module"`, então imports internos em `server/` usam sufixo `.js` mesmo em arquivos `.ts` — ex.: `import { x } from './lib/schemas.js'`. Sem isso, o build quebra em runtime.
- **Schemas Zod são duplicados:** `src/schemas/contato.ts` (client) e `server/lib/schemas.ts` (server). Manter os dois em sincronia ao mudar validações.
- **Cache em memória:** `fetchFlickrFeed` usa cache singleton de 1h por URL em `server/lib/flickr.ts`. Restart do server limpa.
- **Listagens paginadas no backend:** todo `GET` de coleção que cresce (usuários, convites, futuros boletins) é paginado no servidor pelo contrato padrão `?page=&limit=` (`page` ≥ 1, default 1; `limit` 1–100, default 20) com envelope de resposta `{ data, pagination: { page, limit, total, totalPages } }`. Utilitário compartilhado em `server/core/pagination.ts` (`paginationQuery`, `toOffset`, `paginate`). Catálogos de referência fixos (papéis, permissões) são **isentos** — alimentam `<select>` e vêm inteiros.
- **Padrão visual da área administrativa:** toda tela do painel (`/painel/*`) e de autenticação compõe o **kit de UI** em `src/painel/ui/` (`PageHeader`, `Card`, `Button`, `Badge`/`StatusBadge`, `Chip`, `Alert`, `Field`/`Input`, `Table`, `Avatar`, `EmptyState`, `Modal`, `Pager`) — não criar cartões/botões/badges com classes Tailwind soltas. Anatomia de página, tokens e quando usar cada componente em **`docs/patterns/area-administrativa-visual.md`** (consultar antes de criar nova tela administrativa).
- **Arquitetura do backend administrativo:** todo código novo de `/api/auth` e `/api/admin` segue a arquitetura em camadas + 4 design patterns descritos em **Backend — Área Administrativa, Autenticação e RBAC**. Não adicionar lógica solta em `server/lib/` para essas features.
- **Sem suíte de testes ativa.** Projeto pequeno, estilo site institucional — validação manual no browser.
