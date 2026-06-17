import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import {
  listBoletins, createBoletim, deleteBoletim, publishBoletim, unpublishBoletim,
  type Boletim,
} from '@/painel/boletim-api'
import {
  PageHeader, Button, Badge, Field, Input, Alert, EmptyState, Spinner, Modal, Pager,
  Table, THead, th, td,
} from '@/painel/ui'

function formatDate(b: Boletim): string {
  const iso = b.status === 'published' && b.publishedAt ? b.publishedAt : b.updatedAt
  return new Date(iso).toLocaleString('pt-BR')
}

function StatusBadge({ status }: { status: Boletim['status'] }) {
  const published = status === 'published'
  return (
    <Badge color={published ? 'green' : 'gray'}>
      <span className={`w-1.5 h-1.5 rounded-full ${published ? 'bg-green-500' : 'bg-gray-400'}`} />
      {published ? 'Publicado' : 'Rascunho'}
    </Badge>
  )
}

export default function Boletins() {
  const navigate = useNavigate()
  const { page, limit, setPage } = usePagination()
  const [items, setItems] = useState<Boletim[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<Boletim | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    await ensureCsrf()
    try {
      const body = await listBoletins(page, limit)
      setError(null)
      setItems(body.data)
      setInfo(body.pagination)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  // debounce: recarrega 300ms após a última mudança de página
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  async function togglePublish(b: Boletim) {
    setBusyId(b.id)
    setError(null)
    try {
      await ensureCsrf()
      if (b.status === 'published') await unpublishBoletim(b.id)
      else await publishBoletim(b.id)
      await load()
    } catch (e) {
      // PublishIncompleteError.message já vem formatado ("…Faltando: título, …").
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function copyLink(b: Boletim) {
    if (!b.publicUrl) return
    try {
      await navigator.clipboard.writeText(b.publicUrl)
      setCopiedId(b.id)
      setTimeout(() => setCopiedId(c => (c === b.id ? null : c)), 2000)
    } catch {
      setError('Não foi possível copiar o link.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boletins"
        actions={<Button onClick={() => setCreating(true)}>Novo boletim</Button>}
      />

      {error && <Alert kind="err">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : items.length === 0 ? (
        <EmptyState title="Nenhum boletim" description="Crie o primeiro boletim para começar." />
      ) : (
        <Table>
          <THead>
            <tr>
              <th className={th}>Título</th>
              <th className={th}>Status</th>
              <th className={th}>Atualizado</th>
              <th className={th}></th>
            </tr>
          </THead>
          <tbody>
            {items.map(b => (
              <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                <td className={td}>
                  <button onClick={() => navigate(`/painel/boletins/${b.id}`)}
                    className="text-iasd-accent hover:underline font-medium text-left">
                    {b.title}
                  </button>
                </td>
                <td className={td}><StatusBadge status={b.status} /></td>
                <td className={`${td} text-gray-500`}>{formatDate(b)}</td>
                <td className={td}>
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/painel/boletins/${b.id}`)}>
                      Editar
                    </Button>
                    <Button variant="secondary" size="sm" disabled={busyId === b.id}
                      onClick={() => togglePublish(b)}>
                      {b.status === 'published' ? 'Despublicar' : 'Publicar'}
                    </Button>
                    {b.status === 'published' && b.publicUrl && (
                      <Button variant="ghost" size="sm" onClick={() => copyLink(b)}>
                        {copiedId === b.id ? 'Link copiado!' : 'Copiar link'}
                      </Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => setToDelete(b)}>
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {!loading && info && <Pager info={info} onPage={setPage} />}

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={created => navigate(`/painel/boletins/${created.id}`)}
        />
      )}

      {toDelete && (
        <Modal title="Excluir boletim" onClose={() => setToDelete(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Remover <strong>{toDelete.title}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={async () => {
              const target = toDelete
              setToDelete(null)
              try { await ensureCsrf(); await deleteBoletim(target.id); await load() }
              catch (e) { setError((e as Error).message) }
            }}>Excluir</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (b: Boletim) => void }) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const trimmed = title.trim()
    if (!trimmed) { setErr('Informe um título.'); return }
    setErr(null); setBusy(true)
    try {
      await ensureCsrf()
      const created = await createBoletim(trimmed)
      onCreated(created)
    } catch (e) {
      setErr((e as Error).message); setBusy(false)
    }
  }

  return (
    <Modal title="Novo boletim" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Título">
          <Input autoFocus value={title} disabled={busy}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="Ex.: Boletim de Sábado" />
        </Field>
        {err && <Alert kind="err">{err}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Criando…' : 'Criar'}</Button>
        </div>
      </div>
    </Modal>
  )
}
