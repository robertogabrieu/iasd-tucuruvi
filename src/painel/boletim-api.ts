import { adminFetch } from '@/painel/admin-api'
import type { PageInfo } from '@/painel/usePagination'
import type { Row } from '@/schemas/boletim'

export interface Boletim {
  id: string
  title: string
  summary: string | null
  coverMediaId: string | null
  content: Row[]
  status: 'draft' | 'published'
  isTemplate: boolean
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
  status?: 'draft' | 'published',
): Promise<{ data: Boletim[]; pagination: PageInfo }> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status) qs.set('status', status)
  const res = await adminFetch(`/boletins?${qs.toString()}`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao listar boletins.'))
  return res.json()
}

export async function createBoletim(title: string, templateId?: string): Promise<Boletim> {
  const body = templateId ? { title, templateId } : { title }
  const res = await adminFetch('/boletins', { method: 'POST', body: JSON.stringify(body) })
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

export async function duplicateBoletim(id: string): Promise<Boletim> {
  const res = await adminFetch(`/boletins/${id}/duplicate`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao duplicar boletim.'))
  return (await res.json()).boletim
}

export async function saveAsTemplate(id: string, name: string, clearContent: boolean): Promise<Boletim> {
  const res = await adminFetch(`/boletins/${id}/save-as-template`, {
    method: 'POST',
    body: JSON.stringify({ name, clearContent }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao salvar como template.'))
  return (await res.json()).boletim
}

export async function listTemplateOptions(): Promise<{ id: string; title: string }[]> {
  const res = await adminFetch('/boletins/template-options')
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao listar templates.'))
  return (await res.json()).templates
}

export async function listTemplates(
  page: number,
  limit: number,
): Promise<{ data: Boletim[]; pagination: PageInfo }> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
  const res = await adminFetch(`/boletins/templates?${qs.toString()}`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao listar templates.'))
  return res.json()
}

export async function createTemplate(name: string): Promise<Boletim> {
  const res = await adminFetch('/boletins/templates', { method: 'POST', body: JSON.stringify({ name }) })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao criar template.'))
  return (await res.json()).boletim
}

export async function getTemplate(id: string): Promise<Boletim> {
  const res = await adminFetch(`/boletins/templates/${id}`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao carregar template.'))
  return (await res.json()).boletim
}

export async function updateTemplate(id: string, patch: UpdatePatch): Promise<Boletim> {
  const res = await adminFetch(`/boletins/templates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao salvar template.'))
  return (await res.json()).boletim
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await adminFetch(`/boletins/templates/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao excluir template.'))
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
    case 'media':
      return 'imagem/vídeo sem conteúdo'
    default:
      return key
  }
}
