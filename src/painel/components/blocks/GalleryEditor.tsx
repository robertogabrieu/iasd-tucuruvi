import { useState } from 'react'
import { Button } from '@/painel/ui'
import MediaPicker from '@/painel/components/MediaPicker'
import type { GalleryBlock } from '@/schemas/boletim'

interface Props {
  block: GalleryBlock
  onChange: (props: GalleryBlock['props']) => void
}

/** Editor de bloco de galeria: miniaturas selecionadas (removíveis) + escolher várias. */
export default function GalleryEditor({ block, onChange }: Props) {
  const [picking, setPicking] = useState(false)
  const { mediaIds } = block.props

  function remove(id: string) {
    onChange({ mediaIds: mediaIds.filter(x => x !== id) })
  }

  function addSelected(ids: string[]) {
    // mescla evitando duplicatas, preservando a ordem existente
    const merged = [...mediaIds]
    for (const id of ids) if (!merged.includes(id)) merged.push(id)
    onChange({ mediaIds: merged })
  }

  return (
    <div className="space-y-3">
      {mediaIds.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {mediaIds.map(id => (
            <div
              key={id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
            >
              <img src={`/media/${id}`} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label="Remover imagem"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Nenhuma imagem na galeria.</p>
      )}

      <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
        Escolher imagens
      </Button>

      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        multiple
        onSelect={addSelected}
      />
    </div>
  )
}
