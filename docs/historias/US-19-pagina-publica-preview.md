# US-19 — Página pública do boletim + preview no WhatsApp

**Épico:** Boletim Informativo · **Prioridade:** Must · **Estimativa:** 8 pts

## História

> **Como** membro da igreja que recebe o link no WhatsApp,
> **eu quero** abrir o boletim numa página bonita e ver um cartão de preview no app,
> **para que** eu reconheça e leia o conteúdo da semana com facilidade.
>
> **E como** Administrador, **eu quero** copiar o link com um clique, **para que** eu o cole no grupo rapidamente.

## Contexto
Esta história entrega o que o link da **US-18** abre: a página pública do boletim renderizada a partir dos blocos (US-16) **e** o cartão de preview (Open Graph) que o WhatsApp exibe ao colar o link.

## Critérios de aceitação

### CA-01 — Renderização do conteúdo
- **Given** um boletim publicado
- **When** acesso `/boletins/:slug`
- **Then** vejo o conteúdo renderizado a partir de todos os tipos de bloco (Título, Texto, Imagem, Galeria, Vídeo), responsivo e na identidade visual do site.

### CA-02 — Cartão de preview no WhatsApp (Open Graph)
- **Given** que colo o link do boletim no WhatsApp
- **When** o app gera o preview
- **Then** aparece um cartão com **título**, **resumo** e **imagem de capa** do boletim
- **And** o HTML da página entrega as meta tags Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type=article`) preenchidas com os dados do boletim.

### CA-03 — Meta tags servidas no HTML inicial
- **Given** que o robô do WhatsApp (e de outras redes) **não executa JavaScript**
- **When** ele busca a página
- **Then** as meta tags já vêm preenchidas no HTML entregue pelo servidor (não dependem do React renderizar no cliente).

### CA-04 — Apenas publicados são públicos
- **Given** um boletim em rascunho ou despublicado
- **When** alguém acessa seu slug
- **Then** a página retorna "não encontrado/indisponível" (não vaza conteúdo não publicado).

### CA-05 — Copiar link
- **Given** um boletim publicado, no painel
- **When** clico em **"Copiar link"**
- **Then** a URL pública é copiada para a área de transferência
- **And** recebo confirmação visual ("Link copiado!").

### CA-06 — Compartilhamento direto (opcional — Could)
- **Given** a página pública ou o painel
- **When** clico em "Compartilhar no WhatsApp"
- **Then** abre o WhatsApp com o link pronto para enviar (`https://wa.me/?text=`).

## Notas técnicas (orientação para implementação)
- O Express intercepta `GET /boletins/:slug`, busca o boletim pelo slug e **injeta as meta tags Open Graph** no `index.html` antes de servir (SSR apenas do `<head>`); o corpo continua sendo hidratado pelo React.
- `og:image` aponta para a imagem de capa (US-16/US-17) com URL absoluta.
- *Renderer* de blocos compartilhado com a pré-visualização do editor (US-16) para garantir fidelidade.
- Rota pública não exige autenticação; rascunhos retornam 404.
- Considerar `og:image` com dimensões adequadas para um bom corte no WhatsApp.

## Dependências
- **US-18** (slug/estado publicado) e **US-16** (conteúdo/metadados).

## Definição de pronto
- [x] Página pública renderizando os blocos, responsiva e on-brand.
- [x] Meta tags Open Graph servidas no HTML inicial (validadas no preview do WhatsApp).
- [x] Rascunhos/despublicados não acessíveis publicamente.
- [x] Botão "Copiar link" com confirmação.

> **Nota de implementação:** a injeção de Open Graph server-side roda **apenas em produção** (Express serve o `dist/index.html`; em dev sob o Vite não injeta) e compõe `og:url`/`og:image` a partir da env **`PUBLIC_BASE_URL`**. A página pública é **full width**, com **fundo padronizado** (padrão de pontos `.boletim-bg`). Há ainda "Compartilhar no WhatsApp" e **pré-visualização** em nova aba (`/painel/boletins/:id/preview`).

> **Entregue** na branch `feat/boletim`. Spec: `docs/superpowers/specs/2026-06-16-boletim-editor-publicacao-design.md` · Plano: `docs/superpowers/plans/2026-06-16-boletim.md`.
