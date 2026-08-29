import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import {
  listBoletins, createBoletim, deleteBoletim, publishBoletim, unpublishBoletim,
  duplicateBoletim, saveAsTemplate, listTemplateOptions,
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
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<Boletim | null>(null)
  const [toTemplate, setToTemplate] = useState<Boletim | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [status, setStatus] = useState<'all' | 'draft' | 'published'>('all')

  const load = useCallback(async () => {
    await ensureCsrf()
    try {
      const body = await listBoletins(page, limit, status === 'all' ? undefined : status)
      setError(null)
      setItems(body.data)
      setInfo(body.pagination)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, limit, status])

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

  async function duplicate(b: Boletim) {
    setBusyId(b.id)
    setError(null)
    try {
      await ensureCsrf()
      const novo = await duplicateBoletim(b.id)
      navigate(`/painel/boletins/${novo.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  function selectStatus(next: 'all' | 'draft' | 'published') {
    setStatus(next)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boletins"
        actions={<Button onClick={() => setCreating(true)}>Novo boletim</Button>}
      />

      {error && <Alert kind="err">{error}</Alert>}
      {notice && <Alert kind="ok">{notice}</Alert>}

      <div className="flex gap-2">
        <Button variant={status === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => selectStatus('all')}>
          Todos
        </Button>
        <Button variant={status === 'draft' ? 'primary' : 'secondary'} size="sm" onClick={() => selectStatus('draft')}>
          Rascunhos
        </Button>
        <Button variant={status === 'published' ? 'primary' : 'secondary'} size="sm" onClick={() => selectStatus('published')}>
          Publicados
        </Button>
      </div>

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
                    <Button variant="secondary" size="sm" disabled={busyId === b.id} onClick={() => duplicate(b)}>
                      Duplicar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setToTemplate(b)}>
                      Salvar como template
                    </Button>
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

      {toTemplate && (
        <SaveAsTemplateModal
          boletim={toTemplate}
          onClose={() => setToTemplate(null)}
          onSaved={() => {
            setToTemplate(null)
            setNotice('Template criado.')
          }}
        />
      )}
    </div>
  )
}

function SaveAsTemplateModal({
  boletim, onClose, onSaved,
}: {
  boletim: Boletim
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(boletim.title)
  const [clear, setClear] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) { setErr('Informe um nome.'); return }
    setErr(null); setBusy(true)
    try {
      await ensureCsrf()
      await saveAsTemplate(boletim.id, trimmed, clear)
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Salvar como template" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome do template">
          <Input autoFocus value={name} disabled={busy}
            onChange={e => setName(e.target.value)}
            placeholder="Ex.: Template padrão" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={clear} disabled={busy}
            onChange={e => setClear(e.target.checked)}
            className="rounded border-gray-300 text-iasd-accent focus:ring-iasd-accent" />
          Limpar conteúdo (manter só a estrutura e os títulos)
        </label>
        {err && <Alert kind="err">{err}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (b: Boletim) => void }) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [templates, setTemplates] = useState<{ id: string; title: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined)

  useEffect(() => {
    listTemplateOptions()
      .then(setTemplates)
      .catch(e => console.error('Falha ao carregar templates:', e))
  }, [])

  async function submit() {
    const trimmed = title.trim()
    if (!trimmed) { setErr('Informe um título.'); return }
    setErr(null); setBusy(true)
    try {
      await ensureCsrf()
      const created = await createBoletim(trimmed, selectedTemplateId)
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
        {templates.length > 0 && (
          <Field label="Modelo inicial">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" name="template" disabled={busy}
                  checked={selectedTemplateId === undefined}
                  onChange={() => setSelectedTemplateId(undefined)}
                  className="text-iasd-accent focus:ring-iasd-accent" />
                Em branco
              </label>
              {templates.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" name="template" disabled={busy}
                    checked={selectedTemplateId === t.id}
                    onChange={() => setSelectedTemplateId(t.id)}
                    className="text-iasd-accent focus:ring-iasd-accent" />
                  {t.title}
                </label>
              ))}
            </div>
          </Field>
        )}
        {err && <Alert kind="err">{err}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Criando…' : 'Criar'}</Button>
        </div>
      </div>
    </Modal>
  )
}
