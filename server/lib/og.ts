/** Escapa valores para inserção segura em atributos HTML (evita quebra de markup). */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface OgMeta {
  title: string
  description: string
  image: string
  url: string
}

/**
 * Injeta as meta tags Open Graph (+ Twitter) no <head> do HTML servido, para que o robô do
 * WhatsApp/redes (que não executa JS) leia o cartão de preview já no HTML inicial (US-19).
 * Valores são escapados. Também substitui o <title> pelo título do boletim.
 */
export function injectOgTags(html: string, meta: OgMeta): string {
  const t = esc(meta.title)
  const d = esc(meta.description)
  const img = esc(meta.image)
  const url = esc(meta.url)
  const tags = [
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${img}" />`,
  ].join('\n    ')

  return html
    .replace(/<title>.*?<\/title>/i, `<title>${t}</title>`)
    .replace('</head>', `    ${tags}\n  </head>`)
}
