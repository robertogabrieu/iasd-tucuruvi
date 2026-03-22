# IASD Tucuruvi — Site Institucional com Engajamento

## Links Oficiais

- **YouTube:** https://www.youtube.com/@IASDTucuruviOficial (4.82K inscritos, 3.2K vídeos)
- **Flickr:** https://www.flickr.com/photos/198977834@N03/ (8.166 fotos)
- **Instagram:** https://www.instagram.com/iasdtucuruvi/
- **Inspiração visual:** https://canta.ag/ (referência de transições e fluidez)

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Estilo:** Tailwind CSS v4
- **Animações:** AOS (Animate On Scroll) + CSS keyframes customizados
- **Formulário:** React Hook Form + Zod (validação) → API Route → Nodemailer
- **Email (dev):** Mailpit via Docker
- **Infraestrutura:** Docker Compose (app + mailpit)

## Identidade Visual

- Seguir identidade oficial da IASD
- Cores: azul escuro `#003366`, branco `#FFFFFF`, azul accent `#0055AA`, cinza claro `#F5F5F5`
- Tipografia: Inter (corpo) + Montserrat (títulos) — Google Fonts
- Logo oficial da IASD

## Arquitetura de Páginas

Modelo híbrido (single page + páginas dedicadas):

- `/` — página principal com seções em scroll contínuo
- `/sermoes` — página dedicada com listagem de vídeos do YouTube
- `/galeria` — página dedicada com fotos do Flickr

### Seções da Página Principal

1. **Hero** — fundo azul escuro, logo, nome, versículo, CTA "Assista ao vivo"
2. **Sobre** — história, horários de culto, endereço + mapa
3. **Ao Vivo** — embed do YouTube (stream mais recente/ao vivo)
4. **Estudos Bíblicos** — formulário de cadastro (nome, telefone/WhatsApp, email, melhor horário para contato)
5. **Sermões** — preview dos 4 últimos vídeos + link "Ver todos" → `/sermoes`
6. **Galeria** — preview de 6 fotos + link "Ver todas" → `/galeria`
7. **Footer** — endereço, redes sociais, links rápidos

## Transições e Animações (inspiradas no canta.ag)

| Efeito | Onde | Técnica |
|--------|------|---------|
| Cortina de entrada | Hero | CSS keyframes `downSlice` (top: -100% → 0) |
| Scroll reveal zoom-in | Textos, imagens | AOS `zoom-in` com delays escalonados |
| Scroll reveal fade-right | Títulos de seção | AOS `fade-right` |
| Divider diagonal | Entre seções preto/branco | CSS `clip-path: polygon()` |
| Smooth scroll | Global | `scroll-behavior: smooth` + navegação por âncoras |
| Reveal de texto | Subtítulos | CSS keyframes width 100% → 0 |
| Hover em cards | Sermões, galeria | `transform: scale(1.03)` com `transition: 0.3s ease` |

## Segurança (prioridade alta)

- CSP Headers no `next.config.js`
- Rate limiting na API de email
- Honeypot field no formulário (anti-bot)
- Zod validation server-side
- Sanitização de inputs
- CSRF protection via token
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

## Formulário de Estudos Bíblicos

Campos: nome, telefone/WhatsApp, email, melhor horário para contato.
Envio por email (Mailpit em dev, SMTP real em produção).
