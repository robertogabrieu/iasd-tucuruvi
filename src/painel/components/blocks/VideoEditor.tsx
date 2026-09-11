import { useState } from 'react'
import { Field, Input } from '@/painel/ui'
import { extractYouTubeId, type VideoBlock } from '@/schemas/boletim'

interface Props {
  block: VideoBlock
  onChange: (props: VideoBlock['props']) => void
}

/**
 * Editor de bloco de vídeo: URL do YouTube → extractYouTubeId.
 * Link inválido mostra erro inline e não é armazenado (CA-09).
 */
export default function VideoEditor({ block, onChange }: Props) {
  const { youtubeId } = block.props
  // Mostra o link atual ao reabrir (para edição), em vez de campo vazio.
  const [draft, setDraft] = useState(youtubeId ? `https://youtu.be/${youtubeId}` : '')
  const [error, setError] = useState<string | null>(null)

  function commit(value: string) {
    const v = value.trim()
    if (!v) {
      setError(null)
      return
    }
    const id = extractYouTubeId(v)
    if (!id) {
      setError('Link do YouTube inválido')
      return
    }
    setError(null)
    onChange({ youtubeId: id })
  }

  return (
    <div className="space-y-3">
      <Field label="Link do YouTube" error={error ?? undefined}>
        <Input
          type="url"
          value={draft}
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={e => {
            setDraft(e.target.value)
            if (error) setError(null)
          }}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit((e.target as HTMLInputElement).value)
            }
          }}
        />
      </Field>

      {youtubeId && (
        <div className="space-y-2">
          <p className="text-xs text-green-700">Vídeo definido: {youtubeId}</p>
          <div className="aspect-video w-full max-w-md overflow-hidden rounded-lg bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title="Pré-visualização do vídeo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}
