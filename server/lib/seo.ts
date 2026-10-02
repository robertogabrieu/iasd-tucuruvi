/**
 * O que os buscadores leem do site: título e descrição de cada página pública, o mapa do
 * site e o robots.txt. O título e a descrição vão no HTML inicial porque é ele que o robô
 * indexa e que aparece no resultado da busca — sem isso, toda página sairia com o título
 * da home.
 *
 * ESPELHO: src/lib/paginas.ts repete os títulos para a aba do navegador (e para os
 * relatórios do Analytics); o teste de seo confere que os dois batem.
 */

export const NOME_DO_SITE = 'IASD Tucuruvi'

export interface PaginaPublica {
  path: string
  title: string
  description: string
  /** Caminho da imagem do cartão de compartilhamento; sem ela, vai o logo. */
  image?: string
}

export const PAGINAS_PUBLICAS: PaginaPublica[] = [
  {
    path: '/',
    title: 'Igreja Adventista do Sétimo Dia — Tucuruvi | Parada Inglesa, São Paulo',
    description:
      'Igreja Adventista do Sétimo Dia no Tucuruvi, zona norte de São Paulo. Cultos aos sábados às 9h30, domingos às 19h e quartas às 20h, estudos bíblicos e transmissões ao vivo.',
    image: '/img/hero-bg.jpg',
  },
  {
    path: '/sermoes',
    title: 'Sermões | IASD Tucuruvi',
    description: 'Assista aos cultos e sermões da Igreja Adventista do Tucuruvi, gravados e transmitidos pelo nosso canal no YouTube.',
  },
  {
    path: '/galeria',
    title: 'Galeria de fotos | IASD Tucuruvi',
    description: 'Fotos da Igreja Adventista do Tucuruvi: cultos, eventos, o Clube Vida e Saúde, os Desbravadores e os Aventureiros.',
  },
  {
    path: '/eventos',
    title: 'Eventos | IASD Tucuruvi',
    description: 'Próximos eventos e programações especiais da Igreja Adventista do Tucuruvi, com data, local e convite para salvar no calendário.',
  },
  {
    path: '/asa',
    title: 'Ação Solidária Adventista (ASA) | IASD Tucuruvi',
    description:
      'A ASA do Tucuruvi ajuda famílias que passam por necessidade. O atendimento é gratuito e reservado: conte pra gente pelo formulário.',
  },
  {
    path: '/vida-e-saude',
    title: 'Clube Vida e Saúde | IASD Tucuruvi',
    description:
      'Clube Vida e Saúde da Igreja Adventista do Tucuruvi: os oito remédios naturais, culinária saudável, horta em casa e a Feira Vida e Saúde.',
    image: '/img/vidasaude-hero.jpg',
  },
  {
    path: '/desbravadores',
    title: 'Clube de Desbravadores Antares | IASD Tucuruvi',
    description:
      'Clube de Desbravadores Antares, da Igreja Adventista do Tucuruvi, para adolescentes de 10 a 15 anos: classes, especialidades, acampamentos e reuniões.',
    image: '/img/antares-hero.jpg',
  },
  {
    path: '/desbravadores/especialidades',
    title: 'Especialidades dos Desbravadores | Clube Antares',
    description:
      'Catálogo das especialidades dos Desbravadores, de primeiros socorros a astronomia, com busca e filtro por área.',
    image: '/img/antares-hero.jpg',
  },
  {
    path: '/aventureiros',
    title: 'Clube de Aventureiros Antares Kids | IASD Tucuruvi',
    description:
      'Clube de Aventureiros Antares Kids, da Igreja Adventista do Tucuruvi, para crianças de 6 a 9 anos, com os pais participando junto.',
    image: '/img/antares-kids-hero.jpg',
  },
]

/** Telas de acesso ao painel: existem, mas não interessam à busca. */
const ROTAS_DE_ACESSO = ['/login', '/esqueci-senha', '/redefinir-senha', '/aceitar-convite']

export function semBarraFinal(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

export function paginaPublica(path: string): PaginaPublica | undefined {
  const alvo = semBarraFinal(path)
  return PAGINAS_PUBLICAS.find((p) => p.path === alvo)
}

/**
 * Se o endereço é uma tela do site. Boletim e evento não entram: quando chegam aqui, já
 * passaram pela rota que serve os publicados, então são rascunho ou não existem. O resto
 * recebe 404 de verdade — com 200, o Google indexaria endereço quebrado como página.
 */
export function rotaExiste(path: string): boolean {
  const alvo = semBarraFinal(path)
  return Boolean(paginaPublica(alvo)) || ROTAS_DE_ACESSO.includes(alvo) || alvo === '/painel' || alvo.startsWith('/painel/')
}

export interface EntradaDoMapa {
  path: string
  lastmod?: Date
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function montarSitemap(base: string, entradas: EntradaDoMapa[]): string {
  const urls = entradas.map(({ path, lastmod }) => {
    const data = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''
    return `  <url><loc>${escXml(base + path)}</loc>${data}</url>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

export function montarRobots(base: string): string {
  return [
    'User-agent: *',
    'Disallow: /painel',
    'Disallow: /api/',
    ...ROTAS_DE_ACESSO.map((r) => `Disallow: ${r}`),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n')
}

/**
 * Ficha da igreja no formato que o Google lê para o painel de resultado local (endereço,
 * telefone, redes). Vai só na home, que é a página que representa a igreja.
 */
export function fichaDaIgreja(base: string): string {
  const ficha = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: 'Igreja Adventista do Sétimo Dia — Tucuruvi',
    alternateName: NOME_DO_SITE,
    url: `${base}/`,
    logo: `${base}/img/logo-iasd.png`,
    image: `${base}/img/hero-bg.jpg`,
    telephone: '+55 11 2981-6615',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'R. Cruz de Malta, 1201',
      addressLocality: 'São Paulo',
      addressRegion: 'SP',
      postalCode: '02248-001',
      addressCountry: 'BR',
    },
    sameAs: [
      'https://www.youtube.com/@IASDTucuruviOficial',
      'https://www.instagram.com/iasdtucuruvi/',
      'https://www.flickr.com/photos/198977834@N03/',
    ],
  }
  // "<" escapado: um "</script>" dentro do JSON fecharia o bloco antes da hora.
  const json = JSON.stringify(ficha).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">${json}</script>`
}
