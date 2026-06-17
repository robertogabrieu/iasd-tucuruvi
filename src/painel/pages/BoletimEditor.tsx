import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ensureCsrf } from '@/auth/auth-api'
import {
  getBoletim,
  updateBoletim,
  publishBoletim,
  unpublishBoletim,
  type Boletim,
} from '@/painel/boletim-api'
import { contentIsEmpty, type Block, type Row } from '@/schemas/boletim'
import { BLOCK_LABELS } from '@/painel/components/BlockList'
import RowList from '@/painel/components/RowList'
import MediaPicker from '@/painel/components/MediaPicker'
import {
  PageHeader,
  Card,
  Button,
  Badge,
  StatusBadge,
  Chip,
  Alert,
  Field,
  Input,
  Textarea,
  Spinner,
  type Message,
} from '@/painel/ui'

function isIncompleteBlock(b: Block): boolean {
  return (
    (b.type === 'heading' && !b.props.text.trim()) ||
    (b.type === 'image' && !b.props.mediaId) ||
    (b.type === 'gallery' && b.props.mediaIds.length === 0) ||
    (b.type === 'video' && !b.props.youtubeId)
  )
}

/** Aponta o primeiro bloco incompleto em qualquer linha/coluna (backend rejeitaria com 422). */
function findIncompleteBlock(rows: Row[]): Block | undefined {
  for (const row of rows) {
    for (const col of row.columns) {
      const b = col.blocks.find(isIncompleteBlock)
      if (b) return b
    }
  }
  return undefined
}

export default function BoletimEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [boletim, setBoletim] = useState<Boletim | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // estado editável
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [coverMediaId, setCoverMediaId] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  const [coverPicking, setCoverPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Message | null>(null)
  const [copied, setCopied] = useState(false)

  const hydrate = useCallback((b: Boletim) => {
    setBoletim(b)
    setTitle(b.title)
    setSummary(b.summary ?? '')
    setCoverMediaId(b.coverMediaId)
    setRows(b.content)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    await ensureCsrf()
    try {
      const b = await getBoletim(id)
      hydrate(b)
      setLoadError(null)
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id, hydrate])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave() {
    setMsg(null)
    // Validação client-side (CA-07): título não-vazio E ao menos um bloco.
    if (!title.trim()) {
      setMsg({ kind: 'err', text: 'Informe um título para o boletim.' })
      return
    }
    if (contentIsEmpty(rows)) {
      setMsg({ kind: 'err', text: 'Adicione ao menos um bloco de conteúdo.' })
      return
    }
    const incomplete = findIncompleteBlock(rows)
    if (incomplete) {
      setMsg({ kind: 'err', text: `Há um bloco de ${BLOCK_LABELS[incomplete.type]} incompleto. Preencha-o ou remova-o.` })
      return
    }
    setSaving(true)
    try {
      const updated = await updateBoletim(id, {
        title: title.trim(),
        summary: summary.trim() || null,
        coverMediaId,
        content: rows,
      })
      hydrate(updated)
      setMsg({ kind: 'ok', text: 'Boletim salvo.' })
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    setMsg(null)
    setBusy(true)
    try {
      const updated = await publishBoletim(id)
      hydrate(updated)
      setMsg({ kind: 'ok', text: 'Boletim publicado.' })
    } catch (e) {
      // PublishIncompleteError.message já vem formatado ("…Faltando: título, …").
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function handleUnpublish() {
    setMsg(null)
    setBusy(true)
    try {
      const updated = await unpublishBoletim(id)
      hydrate(updated)
      setMsg({ kind: 'ok', text: 'Boletim despublicado.' })
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    if (!boletim?.publicUrl) return
    try {
      await navigator.clipboard.writeText(boletim.publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMsg({ kind: 'err', text: 'Não foi possível copiar o link.' })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (loadError || !boletim) {
    return (
      <div className="space-y-4">
        <PageHeader title="Boletim" />
        <Alert kind="err">{loadError ?? 'Boletim não encontrado.'}</Alert>
        <Button variant="secondary" onClick={() => navigate('/painel/boletins')}>
          Voltar para a lista
        </Button>
      </div>
    )
  }

  const published = boletim.status === 'published'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar boletim"
        subtitle={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={published ? 'active' : 'disabled'} />
            {published && boletim.slug && (
              <Badge color="blue">Link fixo: /boletins/{boletim.slug}</Badge>
            )}
          </span>
        }
        actions={
          <Button variant="ghost" onClick={() => navigate('/painel/boletins')}>
            Voltar
          </Button>
        }
      />

      {msg && <Alert message={msg} />}

      {published && boletim.publicUrl && (
        <Card title="Boletim publicado">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Link público:{' '}
              <a
                href={boletim.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-iasd-accent underline"
              >
                {boletim.publicUrl}
              </a>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? 'Link copiado!' : 'Copiar link'}
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `${boletim.title} — ${boletim.publicUrl}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-iasd-dark px-3 py-1.5 text-sm font-medium text-iasd-dark transition-colors hover:bg-gray-100"
              >
                Compartilhar no WhatsApp
              </a>
            </div>
            <Chip>O link não muda ao editar o título (slug travado após publicação).</Chip>
          </div>
        </Card>
      )}

      <div className="space-y-6">
          <Card title="Informações">
            <div className="space-y-4">
              <Field label="Título">
                <Input
                  value={title}
                  maxLength={200}
                  placeholder="Título do boletim"
                  onChange={e => setTitle(e.target.value)}
                />
              </Field>
              <Field label="Resumo (opcional)">
                <Textarea
                  value={summary}
                  maxLength={500}
                  rows={3}
                  placeholder="Breve resumo exibido na lista e no compartilhamento."
                  onChange={e => setSummary(e.target.value)}
                />
              </Field>
              <Field label="Imagem de capa (opcional)">
                <div className="flex items-start gap-3">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                    {coverMediaId ? (
                      <img
                        src={`/media/${coverMediaId}/thumb`}
                        alt="Capa"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                        Sem capa
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setCoverPicking(true)}>
                      {coverMediaId ? 'Trocar capa' : 'Escolher capa'}
                    </Button>
                    {coverMediaId && (
                      <Button variant="ghost" size="sm" onClick={() => setCoverMediaId(null)}>
                        Remover capa
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Se vazia, ao salvar o sistema sugere a primeira imagem do conteúdo.
                </p>
              </Field>
            </div>
          </Card>

          <Card title="Conteúdo">
            <RowList rows={rows} onChange={setRows} />
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.open(`/painel/boletins/${id}/preview`, '_blank')}
            >
              Pré-visualizar
            </Button>
            {published ? (
              <Button variant="secondary" onClick={handleUnpublish} disabled={busy}>
                Despublicar
              </Button>
            ) : (
              <Button variant="secondary" onClick={handlePublish} disabled={busy}>
                Publicar
              </Button>
            )}
          </div>
          <Chip>A pré-visualização abre em nova aba e mostra a última versão salva.</Chip>
      </div>

      <MediaPicker
        open={coverPicking}
        onClose={() => setCoverPicking(false)}
        onSelect={cid => setCoverMediaId(cid)}
      />
    </div>
  )
}
