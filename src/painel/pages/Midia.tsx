import { useCallback, useEffect, useState } from 'react'
import { ensureCsrf } from '@/auth/auth-api'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import { listMedia, uploadMedia, deleteMedia, type MediaItem } from '@/painel/media-api'
import { PageHeader, Button, buttonClass, Field, Input, Alert, EmptyState, Spinner, Modal, Pager } from '@/painel/ui'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

const EXT_LABEL: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' }
const extLabel = (mime: string) => EXT_LABEL[mime] ?? mime

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const ExpandIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
)

export default function Midia() {
  const { page, limit, setPage } = usePagination()
  const [items, setItems] = useState<MediaItem[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [q, setQ] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [toDelete, setToDelete] = useState<MediaItem | null>(null)
  const [detail, setDetail] = useState<MediaItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    await ensureCsrf()
    try {
      const body = await listMedia(page, limit, q)
      setError(null)
      setItems(body.data)
      setInfo(body.pagination)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, limit, q])

  // debounce: recarrega 300ms após a última mudança de página/busca
  useEffect(() => {
    setLoading(true)
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

      {error && <Alert kind="err">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : items.length === 0 ? (
        <EmptyState title="Nenhuma imagem" description="Envie a primeira imagem para começar." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map(m => (
            <div key={m.id} className="group bg-white border border-gray-200 rounded-xl shadow-sm p-2 space-y-2">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                {/* Miniatura clicável apenas em telas touch (sem hover); no desktop o acesso é o botão expandir. */}
                <button type="button" tabIndex={-1} onClick={() => setDetail(m)} aria-hidden="true"
                  className="block w-full h-full [@media(hover:hover)]:pointer-events-none">
                  <img src={m.thumbnailUrl} alt={m.originalName} loading="lazy" className="w-full h-full object-cover" />
                </button>
                {/* Botão expandir flutuante, aparece no hover (desktop); escondido em telas touch. */}
                <button type="button" onClick={() => setDetail(m)} aria-label={`Ver detalhes de ${m.originalName}`}
                  className="absolute top-2 right-2 rounded-lg p-1.5 text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm
                    opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:hidden">
                  <ExpandIcon />
                </button>
              </div>
              <p className="text-xs text-gray-600 truncate" title={m.originalName}>{m.originalName}</p>
              <Button variant="danger" size="sm" full onClick={() => setToDelete(m)}>Excluir</Button>
            </div>
          ))}
        </div>
      )}

      {!loading && info && <Pager info={info} onPage={setPage} />}

      {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onDone={async () => { setUploadOpen(false); setPage(1); await load() }}
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
              try { await deleteMedia(toDelete.id); setToDelete(null); await load() }
              catch (e) { setError((e as Error).message); setToDelete(null) }
            }}>Excluir</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DetailRow({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{term}</dt>
      <dd className="text-gray-800 font-medium">{value}</dd>
    </div>
  )
}

function DetailModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  return (
    <Modal title={item.originalName} onClose={onClose} size="xl">
      <div className="flex flex-col sm:flex-row gap-5">
        {/* Imagem: ocupa o espaço principal e ganha altura (infos foram pra coluna ao lado) */}
        <div className="relative flex-1 flex items-center justify-center rounded-lg bg-gray-100 overflow-hidden min-h-[18rem]">
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center"><Spinner className="w-8 h-8" /></div>
          )}
          <img src={item.url} alt={item.originalName} onLoad={() => setImgLoaded(true)}
            className={`max-h-[70vh] w-auto object-contain transition-opacity ${imgLoaded ? 'opacity-100' : 'opacity-0'}`} />
        </div>
        {/* Coluna direita: detalhes + ações */}
        <div className="sm:w-52 shrink-0 flex flex-col gap-4">
          <dl className="space-y-3 text-sm">
            <DetailRow term="Dimensões" value={`${item.width} × ${item.height} px`} />
            <DetailRow term="Tipo" value={extLabel(item.mimeType)} />
            <DetailRow term="Tamanho" value={formatBytes(item.sizeBytes)} />
            <DetailRow term="Enviado em" value={new Date(item.createdAt).toLocaleString('pt-BR')} />
          </dl>
          <div className="flex flex-col gap-2 sm:mt-auto">
            <a href={item.url} download={item.originalName} className={buttonClass('primary', 'md', 'w-full')}>Baixar</a>
            <Button variant="secondary" full onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
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
        <input type="file" accept={ACCEPT.join(',')} disabled={busy}
          onChange={e => handle(e.target.files?.[0])}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0
            file:bg-iasd-accent file:px-4 file:py-2 file:text-white file:font-medium" />
        <p className="text-xs text-gray-500">JPEG, PNG ou WebP · máximo 5 MB.</p>
        {err && <Alert kind="err">{err}</Alert>}
        {busy && <p className="text-sm text-gray-500">Enviando…</p>}
      </div>
    </Modal>
  )
}
