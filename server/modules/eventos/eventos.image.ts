import sharp from 'sharp'
import { ESTILOS, type Caixa, type DadosDaCapa, type Tamanho } from './eventos.image.styles.js'
import { lerMidiaOriginal } from './eventos.image.storage.js'
import type { EventoDTO } from './dto/evento.dto.js'

export type ImageKind = 'card' | 'story'

/** Preview do link (WhatsApp e redes) e arte de Stories. Spec §6.2. */
export const TAMANHOS: Record<ImageKind, Tamanho> = {
  card: { largura: 1200, altura: 630 },
  story: { largura: 1080, altura: 1920 },
}

const FUSO = 'America/Sao_Paulo'

/** Quanto a cópia desfocada da arte é escurecida para o texto sobreviver por cima dela. */
const OPACIDADE_DO_VEU = 0.55

/**
 * Encaixa a origem inteira dentro da caixa, centralizada e sem distorcer.
 * É a garantia de que a arte pronta nunca é cortada (spec §6.2): o que não couber vira
 * margem, nunca recorte.
 */
export function encaixarInteiro(origem: Tamanho, caixa: Caixa): Caixa {
  const escala = Math.min(caixa.largura / origem.largura, caixa.altura / origem.altura)
  const largura = Math.max(1, Math.round(origem.largura * escala))
  const altura = Math.max(1, Math.round(origem.altura * escala))
  return {
    x: Math.round(caixa.x + (caixa.largura - largura) / 2),
    y: Math.round(caixa.y + (caixa.altura - altura) / 2),
    largura,
    altura,
  }
}

function comMaiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "Sábado, 26 de setembro · 19h30", no fuso de São Paulo. */
function quandoPorExtenso(startsAt: string): string {
  const quando = new Date(startsAt)
  const dia = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: FUSO,
  }).format(quando)
  const hora = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: FUSO,
  }).format(quando).replace(':', 'h')
  return `${comMaiuscula(dia)} · ${hora}`
}

function dadosDaCapa(e: EventoDTO): DadosDaCapa {
  return {
    categoria: e.category ?? 'IASD Tucuruvi',
    titulo: e.title,
    quando: quandoPorExtenso(e.startsAt),
    onde: e.locationName,
    cta: e.ctaLabel,
    destaque: e.accentColor,
    secundaria: e.secondaryColor,
    modo: e.coverMode,
  }
}

/** Cópia da própria arte, ampliada e desfocada, para preencher o quadro sem barra preta. */
async function fundoDesfocado(arte: Buffer, tamanho: Tamanho, veu: string): Promise<Buffer> {
  const cobertura = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho.largura}" height="${tamanho.altura}">` +
    `<rect width="${tamanho.largura}" height="${tamanho.altura}" fill="${veu}" fill-opacity="${OPACIDADE_DO_VEU}" /></svg>`,
  )
  return sharp(arte)
    .resize(tamanho.largura, tamanho.altura, { fit: 'cover' })
    .blur(40)
    .composite([{ input: cobertura, top: 0, left: 0 }])
    .png()
    .toBuffer()
}

/** Retrato em círculo do estilo sóbrio. Só vale para foto: a arte pronta nunca é recortada. */
async function retratoRedondo(foto: Buffer, caixa: Caixa): Promise<sharp.OverlayOptions> {
  const diametro = Math.round(Math.min(caixa.largura, caixa.altura))
  const mascara = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${diametro}" height="${diametro}">` +
    `<circle cx="${diametro / 2}" cy="${diametro / 2}" r="${diametro / 2}" fill="#FFFFFF" /></svg>`,
  )
  const recorte = await sharp(foto)
    .resize(diametro, diametro, { fit: 'cover' })
    .composite([{ input: mascara, blend: 'dest-in' }])
    .png()
    .toBuffer()
  return {
    input: recorte,
    left: Math.round(caixa.x + (caixa.largura - diametro) / 2),
    top: Math.round(caixa.y + (caixa.altura - diametro) / 2),
  }
}

async function camadaDaImagem(midia: Buffer, caixa: Caixa): Promise<sharp.OverlayOptions> {
  const meta = await sharp(midia).metadata()
  const origem = { largura: meta.width ?? caixa.largura, altura: meta.height ?? caixa.altura }
  const alvo = encaixarInteiro(origem, caixa)
  const redimensionada = await sharp(midia)
    .resize(alvo.largura, alvo.altura, { fit: 'fill' })
    .png()
    .toBuffer()
  return { input: redimensionada, left: alvo.x, top: alvo.y }
}

/**
 * Monta a imagem de compartilhamento: o SVG do estilo escolhido no fundo, a foto recortada ou a
 * arte pronta por cima, e o texto por último. Capa sem mídia ainda rende uma imagem válida —
 * é o que o preview do link mostra enquanto a foto não subiu.
 */
export async function renderEventoImage(e: EventoDTO, kind: ImageKind): Promise<Buffer> {
  const tamanho = TAMANHOS[kind]
  const capa = ESTILOS[e.coverStyle](dadosDaCapa(e), tamanho)
  const camadas: sharp.OverlayOptions[] = []

  const midiaId = e.coverMode === 'arte' ? e.artMediaId : e.hostPhotoMediaId
  const midia = midiaId ? await lerMidiaOriginal(midiaId) : null

  if (midia) {
    if (e.coverMode === 'arte') {
      camadas.push({ input: await fundoDesfocado(midia, tamanho, e.secondaryColor), top: 0, left: 0 })
      camadas.push(await camadaDaImagem(midia, capa.imagem))
    } else if (capa.imagemRedonda) {
      camadas.push(await retratoRedondo(midia, capa.imagem))
    } else {
      camadas.push(await camadaDaImagem(midia, capa.imagem))
    }
  }

  camadas.push({ input: Buffer.from(capa.texto), top: 0, left: 0 })

  return sharp(Buffer.from(capa.fundo)).composite(camadas).png().toBuffer()
}
