# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **Backend:** Express 5 (serve SPA + API)
- **Estilo:** Tailwind CSS
- **Animações:** AOS (Animate On Scroll) + CSS keyframes customizados
- **Formulário:** React Hook Form + Zod (validação) → Express API → Nodemailer (oculto até SMTP ser configurado)
- **Email (dev):** Mailpit via Docker
- **Infraestrutura:** Docker Compose (app + mailpit)
- **Deploy:** Contabo VPS + Docker
- **Scripts:** `deploy.sh` (setup interativo + Docker) e `update.sh` (git pull + rebuild)

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

### Seções da Página Principal

1. **Hero** — fundo azul escuro com foto da igreja (10% opacidade), título "Adventistas Tucuruvi", versículo (text-blue-300), countdown pro próximo culto (glass card), CTA "Assista ao Vivo"
2. **Sobre** — história (70+ anos), horários de culto, botão Waze (logo oficial + cor #33CCFF), endereço + Google Maps embed
3. **Ao Vivo / Últimos Vídeos** — título dinâmico: detecta se há live ativa via oEmbed do YouTube. Se ao vivo: título "Ao Vivo" com bolinha vermelha pulsante. Se não: "Últimos Vídeos"
4. **Estudos Bíblicos** — formulário de cadastro (temporariamente oculto até configurar SMTP)
5. **Sermões** — preview dos 4 últimos vídeos + link "Ver todos" → `/sermoes`
6. **Galeria** — preview de 6 fotos do Flickr (álbum 70 Anos) + link "Ver todas" → `/galeria`
7. **Footer** — endereço completo, telefone, redes sociais (YouTube, Instagram, Flickr, Linktree), links rápidos

> `EstudosBiblicos` está importado mas comentado em `src/pages/Home.tsx` até SMTP ser configurado. A rota `/api/contato` e o schema continuam ativos no backend.

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

## Dev

- **Setup:** `cp .env.example .env.local && npm install`
- **Dev frontend:** `npm run dev` (Vite :5173, proxy `/api` → Express :3001)
- **Dev backend:** `npm run dev:server` (Express :3001, `tsx watch`)
- **Mailpit local:** `docker compose up mailpit` — UI em `http://localhost:8025`
- **Build:** `npm run build` (Vite → `dist/`, tsc → `dist-server/`)
- **Prod:** `npm start` (Express serve tudo na porta 3001)
- **Docker:** `docker compose up --build` (porta 3001)

## Convenções de código

- **Path alias:** `@/*` → `src/*` (configurado em `vite.config.ts`). Usar em imports do frontend.
- **Dois tsconfigs:** `tsconfig.json` (frontend, bundler mode) e `tsconfig.server.json` (backend, emite ESM para `dist-server/`).
- **ESM no backend:** `package.json` tem `"type": "module"`, então imports internos em `server/` usam sufixo `.js` mesmo em arquivos `.ts` — ex.: `import { x } from './lib/schemas.js'`. Sem isso, o build quebra em runtime.
- **Schemas Zod são duplicados:** `src/schemas/contato.ts` (client) e `server/lib/schemas.ts` (server). Manter os dois em sincronia ao mudar validações.
- **Cache em memória:** `fetchFlickrFeed` usa cache singleton de 1h por URL em `server/lib/flickr.ts`. Restart do server limpa.
- **Sem suíte de testes ativa.** Projeto pequeno, estilo site institucional — validação manual no browser.
