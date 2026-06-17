import { adminFetch } from '@/painel/admin-api'
import type { PageInfo } from '@/painel/usePagination'
import type { Block } from '@/schemas/boletim'

export interface Boletim {
  id: string
  title: string
  summary: string | null
  coverMediaId: string | null
  content: Block[]
  status: 'draft' | 'published'
  slug: string | null
  publicUrl: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Erro lançado por publishBoletim quando o boletim está incompleto (HTTP 400). */
export class PublishIncompleteError extends Error {
  constructor(message: string, readonly missing: string[]) {
    super(message)
    this.name = 'PublishIncompleteError'
  }
}

type UpdatePatch = Partial<Pick<Boletim, 'title' | 'summary' | 'coverMediaId' | 'content'>>

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return body.error ?? fallback
}

export async function listBoletins(
  page: number,
  limit: number,
): Promise<{ data: Boletim[]; pagination: PageInfo }> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
  const res = await adminFetch(`/boletins?${qs.toString()}`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao listar boletins.'))
  return res.json()
}

export async function createBoletim(title: string): Promise<Boletim> {
  const res = await adminFetch('/boletins', { method: 'POST', body: JSON.stringify({ title }) })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao criar boletim.'))
  return (await res.json()).boletim
}

export async function getBoletim(id: string): Promise<Boletim> {
  const res = await adminFetch(`/boletins/${id}`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao carregar boletim.'))
  return (await res.json()).boletim
}

export async function updateBoletim(id: string, patch: UpdatePatch): Promise<Boletim> {
  const res = await adminFetch(`/boletins/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao salvar boletim.'))
  return (await res.json()).boletim
}

export async function publishBoletim(id: string): Promise<Boletim> {
  const res = await adminFetch(`/boletins/${id}/publish`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // Publicação incompleta: HTTP 400 com body.details.missing (campos faltantes).
    if (res.status === 400 && Array.isArray(body?.details?.missing)) {
      const missing: string[] = body.details.missing
      const labels = missing.map(labelForMissing).join(', ')
      throw new PublishIncompleteError(
        `${body.error ?? 'Boletim incompleto para publicação.'} Faltando: ${labels}.`,
        missing,
      )
    }
    throw new Error(body.error ?? 'Falha ao publicar boletim.')
  }
  return (await res.json()).boletim
}

export async function unpublishBoletim(id: string): Promise<Boletim> {
  const res = await adminFetch(`/boletins/${id}/unpublish`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao despublicar boletim.'))
  return (await res.json()).boletim
}

export async function deleteBoletim(id: string): Promise<void> {
  const res = await adminFetch(`/boletins/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao excluir boletim.'))
}

/** Rótulo amigável para cada chave de campo faltante retornada pelo backend. */
function labelForMissing(key: string): string {
  switch (key) {
    case 'title':
      return 'título'
    case 'content':
      return 'conteúdo (ao menos um bloco)'
    case 'summary/cover':
      return 'resumo ou imagem de capa'
    default:
      return key
  }
}
