import { adminFetch } from '@/painel/admin-api'
import type { PageInfo } from '@/painel/usePagination'

export interface MediaItem {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  url: string
  thumbnailUrl: string
  createdAt: string
}

export async function listMedia(page: number, limit: number, q: string): Promise<{ data: MediaItem[]; pagination: PageInfo }> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) qs.set('q', q)
  const res = await adminFetch(`/media?${qs.toString()}`)
  if (!res.ok) throw new Error('Falha ao listar mídia.')
  return res.json()
}

export async function uploadMedia(file: File): Promise<MediaItem> {
  const form = new FormData()
  form.append('file', file)
  const res = await adminFetch('/media', { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Falha no upload.')
  }
  return (await res.json()).media
}

export async function deleteMedia(id: string): Promise<void> {
  const res = await adminFetch(`/media/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Falha ao excluir.')
  }
}
