# IASD Tucuruvi — Site Institucional com Engajamento

## Links Oficiais

- **YouTube:** https://www.youtube.com/@IASDTucuruviOficial (Channel ID: UCvtcRQ8TcPLZn5dP42bODFg)
- **Flickr:** https://www.flickr.com/photos/198977834@N03/ (8.166 fotos)
- **Flickr Álbum Galeria:** https://www.flickr.com/photos/198977834@N03/albums/72177720318202645 (70 Anos)
- **Instagram:** https://www.instagram.com/iasdtucuruvi/
- **Linktree:** https://linktr.ee/iasdtucuruvi
- **Inspiração visual:** https://canta.ag/ (referência de transições e fluidez)

## Endereço e Contato

- R. Cruz de Malta, 1201 — Parada Inglesa, São Paulo - SP, 02248-001
- Telefone: (11) 2981-6615

## Horários de Culto

- Sábado — Escola Sabatina: 9h30
- Sábado — Culto Divino: 11h00
- Domingo — Culto: 19h00
- Quarta-feira — Culto: 20h00

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Roteamento:** React Router DOM v7
- **Backend:** Express 5 (serve SPA + API)
- **Estilo:** Tailwind CSS
- **Animações:** AOS (Animate On Scroll) + CSS keyframes customizados
- **Formulário:** React Hook Form + Zod (validação) → Express API → Nodemailer
- **Email (dev):** Mailpit via Docker
- **Infraestrutura:** Docker Compose (app + mailpit)
- **Deploy:** Contabo VPS + Docker

## Identidade Visual

- Seguir identidade oficial da IASD
- Cores: azul escuro `#003366`, branco `#FFFFFF`, azul accent `#0055AA`, cinza claro `#F5F5F5`
- Tipografia: Inter (corpo) + Montserrat (títulos) — Google Fonts
- Logo temporário: `/public/img/logo-iasd.png` (bordas arredondadas)

## Arquitetura de Páginas

Modelo híbrido (single page + páginas dedicadas):

- `/` — página principal com seções em scroll contínuo
- `/sermoes` — página dedicada com 12 vídeos do YouTube
- `/galeria` — página dedicada com fotos do álbum "70 Anos" do Flickr

### Seções da Página Principal

1. **Hero** — fundo azul escuro com foto da igreja semi-transparente (10% opacidade), logo, nome, versículo, CTA "Assista ao Vivo"
2. **Sobre** — história (70+ anos), horários de culto, endereço + Google Maps embed
3. **Ao Vivo / Últimos Cultos** — título dinâmico: detecta se há live ativa via oEmbed do YouTube. Se ao vivo: título "Ao Vivo" com bolinha vermelha pulsante. Se não: "Últimos Cultos"
4. **Estudos Bíblicos** — formulário de cadastro (nome, telefone/WhatsApp, email, melhor horário)
5. **Sermões** — preview dos 4 últimos vídeos + link "Ver todos" → `/sermoes`
6. **Galeria** — preview de 6 fotos do Flickr (álbum 70 Anos) + link "Ver todas" → `/galeria`
7. **Footer** — endereço completo, telefone, redes sociais (YouTube, Instagram, Flickr, Linktree), links rápidos

## Integrações

- **Flickr API** — feed público (sem API key) via proxy Express (`/api/flickr/album`). Galeria puxa do álbum `72177720318202645`. Cache de 1h em memória no servidor
- **YouTube oEmbed** — detecção de live ativa. Re-checagem a cada 2 min no client
- **YouTube embed** — playlist de uploads (`UU` prefix) quando não há live
- **Google Maps embed** — localização da igreja na seção Sobre

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
