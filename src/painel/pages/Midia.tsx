import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureCsrf } from '@/auth/auth-api'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import { listMedia, uploadMedia, deleteMedia, type MediaItem } from '@/painel/media-api'
import { PageHeader, Button, Field, Input, EmptyState, Modal, Pager } from '@/painel/ui'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

export default function Midia() {
  const { page, limit, setPage } = usePagination()
  const [items, setItems] = useState<MediaItem[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [q, setQ] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [toDelete, setToDelete] = useState<MediaItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    await ensureCsrf()
    try {
      const body = await listMedia(page, limit, q)
      setItems(body.data)
      setInfo(body.pagination)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [page, limit, q])

  // debounce: recarrega 300ms após a última mudança de página/busca
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biblioteca de mídia"
        actions={<Button onClick={() => setUploadOpen(true)}>Enviar imagem</Button>}
      />

      <Field label="Buscar por nome">
        <Input value={q} onChange={e => { setPage(1); setQ(e.target.value) }} placeholder="Nome do arquivo…" />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <EmptyState title="Nenhuma imagem" description="Envie a primeira imagem para começar." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map(m => (
            <div key={m.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-2 space-y-2">
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                <img src={m.thumbnailUrl} alt={m.originalName} loading="lazy" className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-gray-600 truncate" title={m.originalName}>{m.originalName}</p>
              <button onClick={() => setToDelete(m)} className="text-xs text-red-600 hover:underline">Excluir</button>
            </div>
          ))}
        </div>
      )}

      {info && <Pager info={info} onPage={setPage} />}

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onDone={() => { setUploadOpen(false); setPage(1); load() }}
        />
      )}

      {toDelete && (
        <Modal title="Excluir imagem" onClose={() => setToDelete(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Remover <strong>{toDelete.originalName}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={async () => {
              try { await deleteMedia(toDelete.id); setToDelete(null); load() }
              catch (e) { setError((e as Error).message); setToDelete(null) }
            }}>Excluir</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handle(file: File | undefined) {
    if (!file) return
    if (!ACCEPT.includes(file.type)) { setErr('Tipo não suportado. Use JPEG, PNG ou WebP.'); return }
    if (file.size > MAX_BYTES) { setErr('Arquivo muito grande (máx. 5 MB).'); return }
    setErr(null); setBusy(true)
    try { await uploadMedia(file); onDone() }
    catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <Modal title="Enviar imagem" onClose={onClose}>
      <div className="space-y-4">
        <input ref={inputRef} type="file" accept={ACCEPT.join(',')} disabled={busy}
          onChange={e => handle(e.target.files?.[0])}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0
            file:bg-iasd-accent file:px-4 file:py-2 file:text-white file:font-medium" />
        <p className="text-xs text-gray-500">JPEG, PNG ou WebP · máximo 5 MB.</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {busy && <p className="text-sm text-gray-500">Enviando…</p>}
      </div>
    </Modal>
  )
}
