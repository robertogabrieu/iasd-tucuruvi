import { useCallback, useEffect, useState } from 'react'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import { listMedia, type MediaItem } from '@/painel/media-api'
import { Field, Input, Alert, EmptyState, Spinner, Modal, Pager, Button } from '@/painel/ui'

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

/**
 * Modal de seleção de imagens da biblioteca de mídia (grade paginada + busca por nome).
 * - `multiple` false (padrão): clicar numa miniatura seleciona e chama onSelect(id).
 * - `multiple` true: multi-seleção com botão de confirmação chamando onSelect(ids).
 * Fecha CA-04 da US-17.
 */
export default function MediaPicker(props: MediaPickerProps) {
  const { open, onClose } = props
  if (!open) return null
  return <MediaPickerInner {...props} />
}

function MediaPickerInner(props: MediaPickerProps) {
  const { onClose } = props
  const multiple = props.multiple === true

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

  return (
    <Modal title="Selecionar da biblioteca" onClose={onClose} size="xl">
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
          <EmptyState title="Nenhuma imagem" description="Envie imagens na biblioteca de mídia primeiro." />
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
    </Modal>
  )
}
