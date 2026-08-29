import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import { usePagination, type PageInfo } from '@/painel/usePagination'
import { listTemplates, createTemplate, updateTemplate, deleteTemplate, type Boletim } from '@/painel/boletim-api'
import {
  PageHeader, Button, Field, Input, Alert, EmptyState, Spinner, Modal, Pager,
  Table, THead, th, td,
} from '@/painel/ui'

export default function Templates() {
  const navigate = useNavigate()
  const { page, limit, setPage } = usePagination()
  const [items, setItems] = useState<Boletim[]>([])
  const [info, setInfo] = useState<PageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [toRename, setToRename] = useState<Boletim | null>(null)
  const [toDelete, setToDelete] = useState<Boletim | null>(null)

  const load = useCallback(async () => {
    await ensureCsrf()
    try {
      const body = await listTemplates(page, limit)
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        actions={<Button onClick={() => setCreating(true)}>Novo template</Button>}
      />

      {error && <Alert kind="err">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : items.length === 0 ? (
        <EmptyState title="Nenhum template" description="Crie um template para reaproveitar a estrutura dos boletins." />
      ) : (
        <Table>
          <THead>
            <tr>
              <th className={th}>Nome</th>
              <th className={th}>Atualizado em</th>
              <th className={th}></th>
            </tr>
          </THead>
          <tbody>
            {items.map(t => (
              <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                <td className={td}>
                  <button onClick={() => navigate(`/painel/boletins/templates/${t.id}`)}
                    className="text-iasd-accent hover:underline font-medium text-left">
                    {t.title}
                  </button>
                </td>
                <td className={`${td} text-gray-500`}>{new Date(t.updatedAt).toLocaleString('pt-BR')}</td>
                <td className={td}>
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/painel/boletins/templates/${t.id}`)}>
                      Editar
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setToRename(t)}>
                      Renomear
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setToDelete(t)}>
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
          onCreated={created => navigate(`/painel/boletins/templates/${created.id}`)}
        />
      )}

      {toRename && (
        <RenameModal
          template={toRename}
          onClose={() => setToRename(null)}
          onRenamed={async () => {
            setToRename(null)
            await load()
          }}
        />
      )}

      {toDelete && (
        <Modal title="Excluir template" onClose={() => setToDelete(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Remover <strong>{toDelete.title}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={async () => {
              const target = toDelete
              setToDelete(null)
              try { await ensureCsrf(); await deleteTemplate(target.id); await load() }
              catch (e) { setError((e as Error).message) }
            }}>Excluir</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function RenameModal({
  template, onClose, onRenamed,
}: {
  template: Boletim
  onClose: () => void
  onRenamed: () => void
}) {
  const [name, setName] = useState(template.title)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) { setErr('Informe um nome.'); return }
    setErr(null); setBusy(true)
    try {
      await ensureCsrf()
      await updateTemplate(template.id, { title: trimmed })
      onRenamed()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Renomear template" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome do template">
          <Input autoFocus value={name} disabled={busy}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="Ex.: Template padrão" />
        </Field>
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
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) { setErr('Informe um nome.'); return }
    setErr(null); setBusy(true)
    try {
      await ensureCsrf()
      const created = await createTemplate(trimmed)
      onCreated(created)
    } catch (e) {
      setErr((e as Error).message); setBusy(false)
    }
  }

  return (
    <Modal title="Novo template" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome">
          <Input autoFocus value={name} disabled={busy}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="Ex.: Template padrão" />
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
