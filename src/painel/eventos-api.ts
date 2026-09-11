import { adminFetch } from '@/painel/admin-api'
import type { MediaItem } from '@/painel/media-api'
import type { PageInfo } from '@/painel/usePagination'
import type { EventoDTO } from '@/schemas/evento'

export type Evento = EventoDTO

export type EventoPatch = Partial<Omit<Evento, 'id' | 'status' | 'slug' | 'publicUrl' | 'publishedAt'>>

/**
 * Erro lançado por publicarEvento quando falta algo para publicar (HTTP 400). `missing` traz
 * as frases prontas de `faltaParaPublicar` — uma por pendência, para a tela listar cada uma
 * com o caminho até o cartão que resolve.
 */
export class EventoIncompletoError extends Error {
  constructor(message: string, readonly missing: string[]) {
    super(message)
    this.name = 'EventoIncompletoError'
  }
}

async function mensagemDeErro(res: Response, padrao: string): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return body.error ?? padrao
}

export async function listEventos(
  page: number,
  limit: number,
  filtros: { status?: 'draft' | 'published'; periodo?: 'proximos' | 'passados' } = {},
): Promise<{ data: Evento[]; pagination: PageInfo }> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (filtros.status) qs.set('status', filtros.status)
  if (filtros.periodo) qs.set('periodo', filtros.periodo)
  const res = await adminFetch(`/eventos?${qs.toString()}`)
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao listar eventos.'))
  return res.json()
}

export async function createEvento(title: string): Promise<Evento> {
  const res = await adminFetch('/eventos', { method: 'POST', body: JSON.stringify({ title }) })
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao criar evento.'))
  return (await res.json()).evento
}

export async function getEvento(id: string): Promise<Evento> {
  const res = await adminFetch(`/eventos/${id}`)
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao carregar evento.'))
  return (await res.json()).evento
}

export async function updateEvento(id: string, patch: EventoPatch): Promise<Evento> {
  const res = await adminFetch(`/eventos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao salvar evento.'))
  return (await res.json()).evento
}

export async function deleteEvento(id: string): Promise<void> {
  const res = await adminFetch(`/eventos/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao excluir evento.'))
}

export async function publicarEvento(id: string): Promise<Evento> {
  const res = await adminFetch(`/eventos/${id}/publicar`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // Publicação incompleta: HTTP 400 com body.details.missing (uma frase por pendência).
    if (res.status === 400 && Array.isArray(body?.details?.missing)) {
      throw new EventoIncompletoError(
        body.error ?? 'Evento incompleto para publicação.',
        body.details.missing as string[],
      )
    }
    throw new Error(body.error ?? 'Falha ao publicar evento.')
  }
  return (await res.json()).evento
}

export async function despublicarEvento(id: string): Promise<Evento> {
  const res = await adminFetch(`/eventos/${id}/despublicar`, { method: 'POST' })
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao despublicar evento.'))
  return (await res.json()).evento
}

/**
 * Envia a imagem pela rota do próprio módulo de eventos, protegida por `evento:write`.
 * A rota da biblioteca de mídia não serve aqui: ela exige `media:manage`, que um líder
 * que só publica evento não tem (spec §4).
 */
export async function uploadImagemDeEvento(file: File | Blob, nome = 'foto.webp'): Promise<MediaItem> {
  const form = new FormData()
  form.append('file', file, nome)
  const res = await adminFetch('/eventos/imagens', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Falha ao enviar a imagem.'))
  return (await res.json()).media
}

/**
 * O evento acontece na igreja, em São Paulo: a data e a hora são as de lá, mesmo que quem
 * publica esteja com o computador em outro fuso.
 */
const FUSO = 'America/Sao_Paulo'

function formatador(opcoes: Intl.DateTimeFormatOptions, locale = 'pt-BR'): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { timeZone: FUSO, ...opcoes })
}

/** "26/09/2026, 19:30" — a coluna de data da lista. */
export function dataDoEvento(iso: string): string {
  return formatador({ dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

/** "sábado, 26 de setembro de 2026 às 19:30" — a data por extenso, para leitura corrida. */
export function dataLongaDoEvento(iso: string): string {
  return formatador({
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

/** O relógio da igreja naquele instante, lido como se fosse UTC. */
function relogioNaIgreja(instante: Date): number {
  const texto = formatador({
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }, 'sv-SE').format(instante)
  return Date.parse(`${texto.replace(' ', 'T')}Z`)
}

/** Quanto o fuso da igreja está à frente do UTC naquele instante, em milissegundos. */
function deslocamento(instante: Date): number {
  return relogioNaIgreja(instante) - instante.getTime()
}

/** Instante ISO para o valor de um `<input type="datetime-local">`. */
export function paraCampoDeDataHora(iso: string | null): string {
  if (!iso) return ''
  const texto = formatador({
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }, 'sv-SE').format(new Date(iso))
  return texto.replace(' ', 'T')
}

/**
 * Valor de um `<input type="datetime-local">` de volta para o instante ISO que a API espera.
 * O deslocamento é medido duas vezes porque ele pode mudar entre a hora digitada e o instante
 * de verdade — é o que acontece na virada de um horário de verão.
 */
export function deCampoDeDataHora(valor: string): string | null {
  if (!valor) return null
  const paredeComoUtc = new Date(`${valor.slice(0, 16)}:00.000Z`)
  if (Number.isNaN(paredeComoUtc.getTime())) return null
  const aproximado = new Date(paredeComoUtc.getTime() - deslocamento(paredeComoUtc))
  return new Date(paredeComoUtc.getTime() - deslocamento(aproximado)).toISOString()
}

/** Os cartões do formulário, na ordem em que aparecem na tela. */
export type CartaoDoEvento = 'sobre' | 'quando' | 'responsavel' | 'capa' | 'acao'

/**
 * A qual cartão pertence cada pendência devolvida pelo servidor. As chaves são trechos das
 * frases de `faltaParaPublicar` — o teste roda sobre as frases reais, então frase alterada
 * lá acusa aqui, em vez de mandar a pessoa para o cartão errado.
 */
const CARTAO_POR_TRECHO: [string, CartaoDoEvento][] = [
  ['nome ao evento', 'sobre'],
  ['descrição', 'sobre'],
  ['data e a hora', 'quando'],
  ['onde o evento acontece', 'quando'],
  ['término precisa ser', 'quando'],
  ['foto do responsável', 'responsavel'],
  ['nome de quem conduz', 'responsavel'],
  ['função de quem conduz', 'responsavel'],
  ['arte que vai virar a capa', 'capa'],
  ['botão de ação', 'acao'],
]

/** Cartão para onde a mensagem de pendência leva. Frase desconhecida cai no primeiro cartão. */
export function cartaoDaPendencia(mensagem: string): CartaoDoEvento {
  const texto = mensagem.toLowerCase()
  const achado = CARTAO_POR_TRECHO.find(([trecho]) => texto.includes(trecho))
  return achado ? achado[1] : 'sobre'
}

/** Título, data e link — o texto que vai no WhatsApp. */
export function mensagemDeCompartilhamento(
  evento: { title: string; startsAt: string; publicUrl: string | null },
): string {
  const partes = [evento.title, dataLongaDoEvento(evento.startsAt)]
  if (evento.publicUrl) partes.push(evento.publicUrl)
  return partes.join(' — ')
}
