import { useCallback, useEffect, useState } from 'react'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import { listMedia, uploadMedia, type MediaItem } from '@/painel/media-api'
import { Field, Input, Alert, type Message, EmptyState, Spinner, Modal, Pager, Button } from '@/painel/ui'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

interface BaseProps {
  open: boolean
  onClose: () => void
}

interface SingleProps extends BaseProps {
  multiple?: false
  onSelect: (id: string) => void
}

interface MultipleProps extends BaseProps {
  multiple: true
  onSelect: (ids: string[]) => void
}

type MediaPickerProps = SingleProps | MultipleProps

type Tab = 'library' | 'upload'

/**
 * Modal de seleção de imagens com duas abas:
 * - **Biblioteca**: grade paginada + busca por nome (clicar seleciona; em multi, checkbox + Adicionar).
 * - **Enviar**: upload de nova imagem (mesmas regras da Biblioteca de mídia: JPEG/PNG/WebP, máx. 5 MB).
 *
 * Contrato (igual à versão anterior):
 * - `multiple` false (padrão): clicar numa miniatura — ou enviar uma nova — chama onSelect(id) e fecha.
 * - `multiple` true: multi-seleção com botão de confirmação chamando onSelect(ids); upload adiciona à seleção.
 * Fecha CA-04 da US-17.
 */
export default function MediaPicker(props: MediaPickerProps) {
  const { open } = props
  if (!open) return null
  return <MediaPickerInner {...props} />
}

function MediaPickerInner(props: MediaPickerProps) {
  const { onClose } = props
  const multiple = props.multiple === true

  const [tab, setTab] = useState<Tab>('library')

  const { page, limit, setPage } = usePagination()
  const [items, setItems] = useState<MediaItem[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
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

  function handlePick(item: MediaItem) {
    if (multiple) {
      setSelected(prev =>
        prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id],
      )
    } else {
      ;(props as SingleProps).onSelect(item.id)
      onClose()
    }
  }

  function confirm() {
    if (!multiple || selected.length === 0) return
    ;(props as MultipleProps).onSelect(selected)
    onClose()
  }

  // Após upload: recarrega a lista para o novo item aparecer e decide o destino conforme o modo.
  const handleUploaded = useCallback(
    async (uploaded: MediaItem) => {
      setPage(1)
      await load()
      if (multiple) {
        setSelected(prev => (prev.includes(uploaded.id) ? prev : [...prev, uploaded.id]))
        setTab('library')
      } else {
        ;(props as SingleProps).onSelect(uploaded.id)
        onClose()
      }
    },
    [load, multiple, onClose, props, setPage],
  )

  return (
    <Modal title="Selecionar imagem" onClose={onClose} size="xl">
      <div className="space-y-4">
        <Tabs tab={tab} onTab={setTab} />

        {tab === 'library' ? (
          <div className="space-y-4">
            <Field label="Buscar por nome">
              <Input
                value={q}
                onChange={e => { setPage(1); setQ(e.target.value) }}
                placeholder="Nome do arquivo…"
              />
            </Field>

            {error && <Alert kind="err">{error}</Alert>}

            {loading ? (
              <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
            ) : items.length === 0 ? (
              <EmptyState title="Nenhuma imagem" description="Envie uma imagem pela aba “Enviar”." />
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {items.map(m => {
                  const isSel = selected.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handlePick(m)}
                      aria-pressed={multiple ? isSel : undefined}
                      className={`group relative block overflow-hidden rounded-lg border bg-gray-100 transition
                        ${isSel ? 'border-iasd-accent ring-2 ring-iasd-accent' : 'border-gray-200 hover:border-iasd-accent'}`}
                      title={m.originalName}
                    >
                      <div className="aspect-square">
                        <img
                          src={m.thumbnailUrl}
                          alt={m.originalName}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {multiple && isSel && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-iasd-accent text-xs font-bold text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {!loading && info && <Pager info={info} onPage={setPage} />}

            <div className="flex items-center justify-end gap-2 pt-2">
              {multiple && (
                <span className="mr-auto text-sm text-gray-500">
                  {selected.length} selecionada{selected.length === 1 ? '' : 's'}
                </span>
              )}
              <Button variant="secondary" onClick={onClose}>Cancelar</Button>
              {multiple && (
                <Button onClick={confirm} disabled={selected.length === 0}>Adicionar</Button>
              )}
            </div>
          </div>
        ) : (
          <UploadTab onUploaded={handleUploaded} onCancel={onClose} />
        )}
      </div>
    </Modal>
  )
}

function Tabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      tab === t
        ? 'border-iasd-accent text-iasd-dark'
        : 'border-transparent text-gray-500 hover:text-iasd-dark'
    }`
  return (
    <div className="flex gap-2 border-b border-gray-200" role="tablist">
      <button type="button" role="tab" aria-selected={tab === 'library'} className={tabClass('library')} onClick={() => onTab('library')}>
        Biblioteca
      </button>
      <button type="button" role="tab" aria-selected={tab === 'upload'} className={tabClass('upload')} onClick={() => onTab('upload')}>
        Enviar
      </button>
    </div>
  )
}

function UploadTab({ onUploaded, onCancel }: { onUploaded: (m: MediaItem) => void | Promise<void>; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Message | null>(null)

  // Object URL da pré-visualização; revoga ao trocar de arquivo ou desmontar.
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function pick(f: File | undefined) {
    setMsg(null)
    if (!f) { setFile(null); return }
    if (!ACCEPT.includes(f.type)) { setFile(null); setMsg({ kind: 'err', text: 'Tipo não suportado. Use JPEG, PNG ou WebP.' }); return }
    if (f.size > MAX_BYTES) { setFile(null); setMsg({ kind: 'err', text: 'Arquivo muito grande (máx. 5 MB).' }); return }
    setFile(f)
  }

  async function send() {
    if (!file || busy) return
    setMsg(null); setBusy(true)
    try {
      const uploaded = await uploadMedia(file)
      setMsg({ kind: 'ok', text: 'Imagem enviada com sucesso.' })
      await onUploaded(uploaded)
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept={ACCEPT.join(',')}
        disabled={busy}
        onChange={e => pick(e.target.files?.[0])}
        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0
          file:bg-iasd-accent file:px-4 file:py-2 file:text-white file:font-medium"
      />
      <p className="text-xs text-gray-500">JPEG, PNG ou WebP · máximo 5 MB.</p>

      {preview && (
        <div className="space-y-1">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
            <img src={preview} alt={file?.name ?? 'Pré-visualização'} className="mx-auto max-h-64 w-auto object-contain" />
          </div>
          {file && <p className="truncate text-xs text-gray-500" title={file.name}>{file.name}</p>}
        </div>
      )}

      <Alert message={msg} />

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button onClick={send} disabled={!file || busy}>
          {busy ? (<><Spinner className="h-4 w-4" /> Enviando…</>) : 'Enviar'}
        </Button>
      </div>
    </div>
  )
}
