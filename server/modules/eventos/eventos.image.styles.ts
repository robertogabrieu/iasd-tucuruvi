import { contraste, textoSobre } from '../../core/cores.js'

/** Fundo claro do estilo sóbrio: fixo por definição (spec §3.1), não sai das cores do evento. */
const FUNDO_CLARO = '#F7F8FA'
const QUASE_PRETO = '#0A0A0A'
const BRANCO = '#FFFFFF'

/** Abaixo disto um texto colorido deixa de ser lido; é o mínimo do WCAG AA para texto normal. */
const CONTRASTE_MINIMO_DE_TEXTO = 4.5

const TITULO = 'Montserrat'
const CORPO = 'Inter'

export interface Tamanho {
  largura: number
  altura: number
}

export interface Caixa {
  x: number
  y: number
  largura: number
  altura: number
}

export interface DadosDaCapa {
  categoria: string
  titulo: string
  quando: string
  onde: string
  cta: string | null
  destaque: string
  secundaria: string
  modo: 'foto' | 'arte'
}

export interface Capa {
  /** SVG do tamanho inteiro, pintado antes de tudo. */
  fundo: string
  /** SVG do tamanho inteiro, sobreposto à foto ou à arte. */
  texto: string
  /** Onde a foto recortada ou a arte pronta é composta. */
  imagem: Caixa
  /** Retrato em círculo (estilo sóbrio) em vez de recorte solto. */
  imagemRedonda: boolean
}

/**
 * Regra 1 da trava de contraste (spec §3.1): a cor do texto nunca é escolhida por quem publica.
 * A cor pedida só vale se for legível sobre o fundo; senão cai para branco ou quase-preto.
 */
function corLegivel(desejada: string, fundo: string): string {
  return contraste(desejada, fundo) >= CONTRASTE_MINIMO_DE_TEXTO ? desejada : textoSobre(fundo)
}

/** Cor de texto que sobrevive às duas pontas de um gradiente, e não só à média entre elas. */
function textoSobreDuasCores(a: string, b: string): string {
  const claro = Math.min(contraste(a, BRANCO), contraste(b, BRANCO))
  const escuro = Math.min(contraste(a, QUASE_PRETO), contraste(b, QUASE_PRETO))
  return claro >= escuro ? BRANCO : QUASE_PRETO
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Quebra por largura estimada: o SVG do `sharp` não quebra linha sozinho e medir a fonte de
 * verdade exigiria abrir o arquivo TTF. 0,56em é a largura média de um caractere nas duas
 * famílias usadas — sobra folga porque o título ainda tem a margem da coluna.
 */
function quebrarEmLinhas(texto: string, larguraDisponivel: number, corpo: number, maxLinhas: number): string[] {
  const maxChars = Math.max(8, Math.floor(larguraDisponivel / (corpo * 0.56)))
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const candidata = atual ? `${atual} ${palavra}` : palavra
    if (candidata.length <= maxChars) {
      atual = candidata
      continue
    }
    if (atual) linhas.push(atual)
    atual = palavra
    if (linhas.length === maxLinhas) break
  }
  if (atual && linhas.length < maxLinhas) linhas.push(atual)
  if (linhas.length === maxLinhas && atual && linhas[maxLinhas - 1] !== atual) {
    linhas[maxLinhas - 1] = `${linhas[maxLinhas - 1].slice(0, maxChars - 1)}…`
  }
  return linhas.slice(0, maxLinhas)
}

interface Metricas {
  padding: number
  olho: number
  titulo: number
  entrelinha: number
  quando: number
  onde: number
  botao: number
  maxLinhasDoTitulo: number
}

const METRICAS_DEITADA: Metricas = {
  padding: 72, olho: 24, titulo: 58, entrelinha: 68, quando: 30, onde: 26, botao: 27, maxLinhasDoTitulo: 3,
}

const METRICAS_EM_PE: Metricas = {
  padding: 76, olho: 34, titulo: 84, entrelinha: 98, quando: 44, onde: 38, botao: 38, maxLinhasDoTitulo: 4,
}

function metricas(t: Tamanho): Metricas {
  return t.altura > t.largura ? METRICAS_EM_PE : METRICAS_DEITADA
}

interface Aparencia {
  /** Conteúdo do `<defs>`, quando o fundo é gradiente. */
  defs: string
  /** O que pinta a área inteira: uma cor ou a referência a um gradiente. */
  preenchimento: string
  /** Enfeites desenhados sobre o fundo, antes da foto. */
  enfeites: string
  corDoTexto: string
  corDoOlho: string
  corDoTitulo: string
  botao: { fundo: string | null; borda: string | null; rotulo: string }
  alinhamentoEmPe: 'esquerda' | 'centro'
  imagemRedonda: boolean
}

/**
 * O arranjo é o mesmo nos três estilos — o que muda é a paleta e o alinhamento. Deitada
 * (1200×630) o texto fica à esquerda e a imagem à direita; em pé (1080×1920) a imagem fica em
 * cima e o texto embaixo, que é a única leitura que funciona num Stories.
 */
function montarCapa(d: DadosDaCapa, t: Tamanho, a: Aparencia): Capa {
  const m = metricas(t)
  const emPe = t.altura > t.largura
  const centralizado = emPe && a.alinhamentoEmPe === 'centro'

  // A arte pronta ganha uma caixa maior: ela entra inteira e menor do que caberia cortada,
  // então precisa de área para o cartaz continuar legível.
  const arte = d.modo === 'arte'
  const imagem: Caixa = emPe
    ? {
        x: m.padding,
        y: t.altura * (arte ? 0.07 : 0.10),
        largura: t.largura - m.padding * 2,
        altura: t.altura * (arte ? 0.52 : 0.42),
      }
    : {
        x: t.largura * (arte ? 0.605 : 0.635),
        y: m.padding * 0.5,
        largura: t.largura * (arte ? 0.335 : 0.30),
        altura: t.altura - m.padding,
      }

  const colunaX = emPe ? m.padding : m.padding
  const colunaLargura = emPe ? t.largura - m.padding * 2 : imagem.x - m.padding * 1.6

  const linhasDoTitulo = quebrarEmLinhas(d.titulo, colunaLargura, m.titulo, m.maxLinhasDoTitulo)
  const linhasDeLocal = quebrarEmLinhas(d.onde, colunaLargura, m.onde, 1)

  const alturaDoTexto =
    m.olho * 1.6 +
    linhasDoTitulo.length * m.entrelinha +
    m.quando * 2.0 +
    linhasDeLocal.length * m.onde * 1.5 +
    (d.cta ? m.botao * 3.2 : 0)

  const topo = emPe
    ? imagem.y + imagem.altura + (t.altura - imagem.y - imagem.altura - alturaDoTexto) / 2
    : (t.altura - alturaDoTexto) / 2

  const ancora = centralizado ? 'middle' : 'start'
  const x = centralizado ? t.largura / 2 : colunaX

  let y = topo + m.olho
  const partes: string[] = []

  partes.push(
    `<text x="${x}" y="${y.toFixed(1)}" text-anchor="${ancora}" font-family="${TITULO}" font-weight="700"` +
    ` font-size="${m.olho}" letter-spacing="${(m.olho * 0.16).toFixed(1)}" fill="${a.corDoOlho}">` +
    `${esc(d.categoria.toUpperCase())}</text>`,
  )

  y += m.olho * 0.6 + m.entrelinha
  for (const linha of linhasDoTitulo) {
    partes.push(
      `<text x="${x}" y="${y.toFixed(1)}" text-anchor="${ancora}" font-family="${TITULO}" font-weight="800"` +
      ` font-size="${m.titulo}" fill="${a.corDoTitulo}">${esc(linha)}</text>`,
    )
    y += m.entrelinha
  }

  y += m.quando * 0.5
  partes.push(
    `<text x="${x}" y="${y.toFixed(1)}" text-anchor="${ancora}" font-family="${CORPO}" font-weight="500"` +
    ` font-size="${m.quando}" fill="${a.corDoTexto}">${esc(d.quando)}</text>`,
  )

  y += m.onde * 1.5
  for (const linha of linhasDeLocal) {
    partes.push(
      `<text x="${x}" y="${y.toFixed(1)}" text-anchor="${ancora}" font-family="${CORPO}" font-weight="400"` +
      ` font-size="${m.onde}" fill-opacity="0.8" fill="${a.corDoTexto}">${esc(linha)}</text>`,
    )
    y += m.onde * 1.4
  }

  if (d.cta) {
    const alturaDoBotao = m.botao * 2.4
    const larguraDoBotao = Math.min(colunaLargura, d.cta.length * m.botao * 0.62 + m.botao * 2.6)
    const botaoX = centralizado ? (t.largura - larguraDoBotao) / 2 : colunaX
    y += m.botao * 0.4
    const fundo = a.botao.fundo ? ` fill="${a.botao.fundo}"` : ' fill="none"'
    const borda = a.botao.borda ? ` stroke="${a.botao.borda}" stroke-width="3"` : ''
    partes.push(
      `<rect x="${botaoX.toFixed(1)}" y="${y.toFixed(1)}" width="${larguraDoBotao.toFixed(1)}"` +
      ` height="${alturaDoBotao.toFixed(1)}" rx="${(alturaDoBotao / 2).toFixed(1)}"${fundo}${borda} />`,
      `<text x="${(botaoX + larguraDoBotao / 2).toFixed(1)}" y="${(y + alturaDoBotao * 0.66).toFixed(1)}"` +
      ` text-anchor="middle" font-family="${TITULO}" font-weight="700" font-size="${m.botao}"` +
      ` fill="${a.botao.rotulo}">${esc(d.cta)}</text>`,
    )
  }

  const cabecalho = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.largura}" height="${t.altura}">`

  return {
    fundo:
      `${cabecalho}${a.defs ? `<defs>${a.defs}</defs>` : ''}` +
      `<rect width="${t.largura}" height="${t.altura}" fill="${a.preenchimento}" />${a.enfeites}</svg>`,
    texto: `${cabecalho}${partes.join('')}</svg>`,
    imagem,
    imagemRedonda: a.imagemRedonda,
  }
}

/** Secundária chapada, texto à esquerda e foto à direita. O mais neutro dos três. */
export function estiloClassico(d: DadosDaCapa, t: Tamanho): Capa {
  const texto = textoSobre(d.secundaria)
  return montarCapa(d, t, {
    defs:
      `<radialGradient id="brilho" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0%" stop-color="${d.destaque}" stop-opacity="0.35" />` +
      `<stop offset="100%" stop-color="${d.destaque}" stop-opacity="0" /></radialGradient>`,
    preenchimento: d.secundaria,
    enfeites:
      `<ellipse cx="${t.largura * (t.altura > t.largura ? 0.5 : 0.78)}"` +
      ` cy="${t.altura * (t.altura > t.largura ? 0.3 : 0.5)}"` +
      ` rx="${t.largura * 0.34}" ry="${t.altura * 0.4}" fill="url(#brilho)" />`,
    corDoTexto: texto,
    corDoOlho: corLegivel(d.destaque, d.secundaria),
    corDoTitulo: texto,
    botao: { fundo: d.destaque, borda: null, rotulo: textoSobre(d.destaque) },
    alinhamentoEmPe: 'esquerda',
    imagemRedonda: false,
  })
}

/** Gradiente do destaque para a secundária, com o botão em branco. */
export function estiloVibrante(d: DadosDaCapa, t: Tamanho): Capa {
  const texto = textoSobreDuasCores(d.destaque, d.secundaria)
  return montarCapa(d, t, {
    defs:
      `<linearGradient id="fundo" x1="0" y1="0" x2="0.85" y2="1">` +
      `<stop offset="0%" stop-color="${d.destaque}" />` +
      `<stop offset="100%" stop-color="${d.secundaria}" /></linearGradient>`,
    preenchimento: 'url(#fundo)',
    enfeites:
      `<circle cx="${t.largura * 0.95}" cy="${t.altura * 0.06}" r="${t.largura * 0.13}" fill="${texto}" fill-opacity="0.10" />` +
      `<circle cx="${t.largura * 0.04}" cy="${t.altura * 0.94}" r="${t.largura * 0.11}" fill="${texto}" fill-opacity="0.07" />`,
    corDoTexto: texto,
    corDoOlho: texto,
    corDoTitulo: texto,
    botao: { fundo: texto, borda: null, rotulo: textoSobre(texto) },
    alinhamentoEmPe: 'centro',
    imagemRedonda: false,
  })
}

/** Fundo claro fixo, faixa do destaque no topo, retrato em círculo e botão contornado. */
export function estiloSobrio(d: DadosDaCapa, t: Tamanho): Capa {
  const texto = textoSobre(FUNDO_CLARO)
  return montarCapa(d, t, {
    defs: '',
    preenchimento: FUNDO_CLARO,
    enfeites: `<rect width="${t.largura}" height="${Math.round(t.altura * 0.022)}" fill="${d.destaque}" />`,
    corDoTexto: texto,
    corDoOlho: corLegivel(d.destaque, FUNDO_CLARO),
    corDoTitulo: corLegivel(d.secundaria, FUNDO_CLARO),
    botao: { fundo: null, borda: corLegivel(d.destaque, FUNDO_CLARO), rotulo: corLegivel(d.destaque, FUNDO_CLARO) },
    alinhamentoEmPe: 'centro',
    imagemRedonda: true,
  })
}

export const ESTILOS = {
  classico: estiloClassico,
  vibrante: estiloVibrante,
  sobrio: estiloSobrio,
} as const
