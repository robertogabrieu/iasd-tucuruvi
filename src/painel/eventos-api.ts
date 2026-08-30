import { adminFetch } from '@/painel/admin-api'
import type { MediaItem } from '@/painel/media-api'
import type { PageInfo } from '@/painel/usePagination'
import type { EventoDTO } from '@/schemas/evento'

export type Evento = EventoDTO

export type EventoPatch = Partial<Omit<Evento, 'id' | 'status' | 'slug' | 'publicUrl' | 'publishedAt'>>

/** Erro lançado por publicarEvento quando faltam campos obrigatórios (HTTP 400). */
export class EventoIncompletoError extends Error {
  constructor(message: string, readonly missing: string[]) {
    super(message)
    this.name = 'EventoIncompletoError'
  }
}

const ROTULOS: Record<string, string> = {
  title: 'título',
  startsAt: 'data e hora de início',
  locationName: 'local',
  description: 'descrição',
  hostPhotoMediaId: 'foto do responsável',
  artMediaId: 'arte pronta',
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
    // Publicação incompleta: HTTP 400 com body.details.missing (campos faltantes).
    if (res.status === 400 && Array.isArray(body?.details?.missing)) {
      const missing: string[] = body.details.missing
      const rotulos = missing.map((campo) => ROTULOS[campo] ?? campo).join(', ')
      throw new EventoIncompletoError(
        `${body.error ?? 'Evento incompleto para publicação.'} Faltando: ${rotulos}.`,
        missing,
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
