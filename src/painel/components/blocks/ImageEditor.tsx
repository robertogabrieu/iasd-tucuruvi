import { useState } from 'react'
import { Button, Field, Input } from '@/painel/ui'
import MediaPicker from '@/painel/components/MediaPicker'
import type { ImageBlock } from '@/schemas/boletim'

interface Props {
  block: ImageBlock
  onChange: (props: ImageBlock['props']) => void
}

/** Editor de bloco de imagem: miniatura + escolher da biblioteca + texto alternativo. */
export default function ImageEditor({ block, onChange }: Props) {
  const [picking, setPicking] = useState(false)
  const { mediaId, alt } = block.props

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
          {mediaId ? (
            <img
              src={`/media/${mediaId}`}
              alt={alt || 'Imagem selecionada'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              Sem imagem
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
            {mediaId ? 'Trocar imagem' : 'Escolher imagem'}
          </Button>
        </div>
      </div>

      <Field label="Texto alternativo (acessibilidade)">
        <Input
          value={alt}
          maxLength={200}
          placeholder="Descreva a imagem…"
          onChange={e => onChange({ mediaId, alt: e.target.value })}
        />
      </Field>

      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        onSelect={id => onChange({ mediaId: id, alt })}
      />
    </div>
  )
}
