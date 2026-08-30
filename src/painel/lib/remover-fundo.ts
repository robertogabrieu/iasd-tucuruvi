import type { PreTrainedModel, Processor } from '@huggingface/transformers'

/**
 * A biblioteca só chega ao navegador quando alguém escolhe uma foto: ela pesa alguns megabytes
 * de JavaScript e nenhuma outra tela do painel precisa dela.
 */
const transformers = () => import('@huggingface/transformers')

/**
 * Modelo de segmentação escolhido pela medição do pacote 2 (spec §11 item 1). O BiRefNet-lite,
 * primeira escolha da spec, foi reprovado no portão: o menor ONNX publicado tem 109 MB, contra
 * os ~80 MB do limite. Este pesa 42 MB na versão quantizada.
 *
 * ATENÇÃO À LICENÇA: o RMBG-1.4 é Creative Commons apenas para uso NÃO comercial; uso comercial
 * exige contrato com a BRIA. O BiRefNet-lite, que é MIT, volta a ser preferível no dia em que
 * alguém publicar pesos quantizados dele.
 */
const MODELO = 'briaai/RMBG-1.4'

/** Fatia da barra de progresso reservada ao download do modelo; o resto é o recorte em si. */
const PESO_DO_DOWNLOAD = 0.8

let carregamento: Promise<[PreTrainedModel, Processor]> | null = null

interface EventoDeProgresso {
  status: string
  progress?: number
}

function carregarModelo(onProgress?: (pct: number) => void): Promise<[PreTrainedModel, Processor]> {
  if (carregamento) return carregamento
  const progress_callback = (evento: EventoDeProgresso) => {
    if (evento.status === 'progress' && typeof evento.progress === 'number') {
      onProgress?.(Math.round(evento.progress * PESO_DO_DOWNLOAD))
    }
  }
  carregamento = transformers().then(async ({ AutoModel, AutoProcessor, PretrainedConfig, env }) => {
    env.allowLocalModels = false
    // O config.json do RMBG-1.4 não descreve nenhuma arquitetura conhecida da biblioteca;
    // 'custom' manda carregar o ONNX direto, sem procurar uma classe de modelo.
    const config = new PretrainedConfig({ model_type: 'custom' })
    return Promise.all([
      AutoModel.from_pretrained(MODELO, { dtype: 'q8', config, progress_callback }),
      AutoProcessor.from_pretrained(MODELO, { progress_callback }),
    ])
  }).catch((erro) => {
    // Sem isto, uma falha de rede deixaria a promessa rejeitada em cache e nenhuma nova
    // tentativa voltaria a baixar o modelo enquanto a página não fosse recarregada.
    carregamento = null
    throw erro
  })
  return carregamento
}

/** true quando o navegador tem o necessário para rodar o modelo. */
export function recorteSuportado(): boolean {
  if (typeof window === 'undefined' || typeof WebAssembly !== 'object') return false
  if (typeof createImageBitmap !== 'function') return false
  const canvas = document.createElement('canvas')
  if (typeof canvas.toBlob !== 'function') return false
  return canvas.toDataURL('image/webp').startsWith('data:image/webp')
}

/** Recorta e devolve WebP com transparência. Lança se o modelo não carregar. */
export async function removerFundo(file: File, onProgress?: (pct: number) => void): Promise<Blob> {
  onProgress?.(0)
  const [modelo, processador] = await carregarModelo(onProgress)
  onProgress?.(Math.round(PESO_DO_DOWNLOAD * 100))

  const { RawImage } = await transformers()
  const imagem = await RawImage.fromBlob(file)
  const { pixel_values } = await processador(imagem)
  const saida = await modelo({ input: pixel_values })
  const mascara = await RawImage.fromTensor(saida.output[0].mul(255).to('uint8'))
    .resize(imagem.width, imagem.height)

  const canvas = document.createElement('canvas')
  canvas.width = imagem.width
  canvas.height = imagem.height
  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('O navegador não conseguiu abrir a área de desenho.')
  contexto.drawImage(imagem.toCanvas(), 0, 0)

  const pixels = contexto.getImageData(0, 0, imagem.width, imagem.height)
  for (let i = 0; i < mascara.data.length; i++) pixels.data[4 * i + 3] = mascara.data[i]
  contexto.putImageData(pixels, 0, 0)
  onProgress?.(100)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('Não foi possível gerar a imagem recortada.')
  return blob
}
