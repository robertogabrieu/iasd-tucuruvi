import { PAGINAS_PUBLICAS, fichaDaIgreja, montarRobots, montarSitemap, paginaPublica, rotaExiste } from '../../server/lib/seo'
import { injectOgTags } from '../../server/lib/og'
import { TITULOS_DAS_PAGINAS, tituloDaPagina } from '../../src/lib/paginas'

const BASE = 'https://www.adventistastucuruvi.com.br'

const HTML = `<html><head>
    <title>Igreja</title>
    <meta name="description" content="Descrição geral." />
  </head><body></body></html>`

describe('títulos das páginas', () => {
  it('o navegador usa os mesmos títulos que o servidor manda ao buscador', () => {
    const doServidor = Object.fromEntries(PAGINAS_PUBLICAS.map((p) => [p.path, p.title]))
    expect(TITULOS_DAS_PAGINAS).toEqual(doServidor)
  })

  it('endereço sem título próprio fica com o da home', () => {
    expect(tituloDaPagina('/boletins/abc')).toBe(TITULOS_DAS_PAGINAS['/'])
    expect(tituloDaPagina('/sermoes/')).toBe(TITULOS_DAS_PAGINAS['/sermoes'])
  })
})

describe('rotaExiste', () => {
  it('reconhece página pública, tela de acesso e painel, com ou sem barra no fim', () => {
    expect(rotaExiste('/')).toBe(true)
    expect(rotaExiste('/desbravadores/especialidades/')).toBe(true)
    expect(rotaExiste('/login')).toBe(true)
    expect(rotaExiste('/painel')).toBe(true)
    expect(rotaExiste('/painel/boletins/123')).toBe(true)
  })

  it('endereço inventado, boletim e evento que chegam ao fallback dão 404', () => {
    expect(rotaExiste('/pagina-que-nao-existe')).toBe(false)
    expect(rotaExiste('/painelzinho')).toBe(false)
    expect(rotaExiste('/boletins/rascunho')).toBe(false)
    expect(rotaExiste('/eventos/nao-existe')).toBe(false)
  })

  it('paginaPublica acha a página com barra no fim', () => {
    expect(paginaPublica('/galeria/')?.path).toBe('/galeria')
  })
})

describe('montarSitemap', () => {
  it('lista as URLs absolutas, com a data quando há', () => {
    const xml = montarSitemap(BASE, [
      { path: '/' },
      { path: '/eventos/vigilia', lastmod: new Date('2026-09-26T22:00:00Z') },
    ])
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain(`<url><loc>${BASE}/</loc></url>`)
    expect(xml).toContain(`<url><loc>${BASE}/eventos/vigilia</loc><lastmod>2026-09-26</lastmod></url>`)
  })

  it('escapa o & do endereço', () => {
    expect(montarSitemap(BASE, [{ path: '/a&b' }])).toContain(`${BASE}/a&amp;b`)
  })
})

describe('montarRobots', () => {
  it('fecha painel, API e telas de acesso e aponta o mapa', () => {
    const robots = montarRobots(BASE)
    expect(robots).toContain('Disallow: /painel')
    expect(robots).toContain('Disallow: /api/')
    expect(robots).toContain('Disallow: /login')
    expect(robots).toContain(`Sitemap: ${BASE}/sitemap.xml`)
  })
})

describe('injectOgTags', () => {
  const meta = { title: 'Sermões', description: 'Cultos gravados.', image: `${BASE}/img/a.jpg`, url: `${BASE}/sermoes` }

  it('troca título e descrição e marca a URL canônica', () => {
    const html = injectOgTags(HTML, { ...meta, type: 'website' })
    expect(html).toContain('<title>Sermões</title>')
    expect(html).toContain('<meta name="description" content="Cultos gravados." />')
    expect(html).not.toContain('Descrição geral.')
    expect(html).toContain(`<link rel="canonical" href="${BASE}/sermoes" />`)
    expect(html).toContain('<meta property="og:type" content="website" />')
  })

  it('sem resumo, mantém a descrição geral', () => {
    expect(injectOgTags(HTML, { ...meta, description: '' })).toContain('content="Descrição geral."')
  })

  it('não interpreta "$" do título como referência da substituição', () => {
    expect(injectOgTags(HTML, { ...meta, title: 'Oferta de $& e $1' })).toContain('<title>Oferta de $&amp; e $1</title>')
  })
})

describe('fichaDaIgreja', () => {
  it('monta a ficha com endereço e URL absolutos', () => {
    const tag = fichaDaIgreja(BASE)
    const json = JSON.parse(tag.replace(/^<script[^>]*>|<\/script>$/g, ''))
    expect(json['@type']).toBe('Church')
    expect(json.url).toBe(`${BASE}/`)
    expect(json.address.postalCode).toBe('02248-001')
  })
})
