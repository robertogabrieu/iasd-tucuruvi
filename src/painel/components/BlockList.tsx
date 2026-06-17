import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/painel/ui'
import { makeBlock, type Block, type BlockType } from '@/schemas/boletim'
import HeadingEditor from './blocks/HeadingEditor'
import TextBlockEditor from './blocks/TextBlockEditor'
import ImageEditor from './blocks/ImageEditor'
import GalleryEditor from './blocks/GalleryEditor'
import VideoEditor from './blocks/VideoEditor'

interface Props {
  blocks: Block[]
  onChange: (next: Block[]) => void
  /** Habilita o controle "mover ◀ ▶" para deslocar um bloco às colunas adjacentes. */
  onMoveBlock?: (blockId: string, dir: -1 | 1) => void
  canMoveLeft?: boolean
  canMoveRight?: boolean
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Título',
  text: 'Texto',
  image: 'Imagem',
  gallery: 'Galeria',
  video: 'Vídeo',
}

const ADD_OPTIONS: { type: BlockType; label: string }[] = [
  { type: 'heading', label: 'Título' },
  { type: 'text', label: 'Texto' },
  { type: 'image', label: 'Imagem' },
  { type: 'gallery', label: 'Galeria' },
  { type: 'video', label: 'Vídeo' },
]

/**
 * Lista ordenável de blocos DE UMA COLUNA (arraste para reordenar dentro da coluna).
 * Para mover blocos entre colunas use os botões "◀ ▶" (via onMoveBlock).
 */
export default function BlockList({
  blocks,
  onChange,
  onMoveBlock,
  canMoveLeft,
  canMoveRight,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(blocks, oldIndex, newIndex))
  }

  function updateBlock(id: string, props: Block['props']) {
    onChange(blocks.map(b => (b.id === id ? ({ ...b, props } as Block) : b)))
  }

  function removeBlock(id: string) {
    onChange(blocks.filter(b => b.id !== id))
  }

  function addBlock(type: BlockType) {
    onChange([...blocks, makeBlock(type)])
  }

  return (
    <div className="space-y-3">
      {blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-500">
          Coluna vazia. Adicione um bloco abaixo.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blocks.map(block => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  onChange={props => updateBlock(block.id, props)}
                  onRemove={() => removeBlock(block.id)}
                  onMove={onMoveBlock ? dir => onMoveBlock(block.id, dir) : undefined}
                  canMoveLeft={canMoveLeft}
                  canMoveRight={canMoveRight}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-200 pt-3">
        <span className="text-xs text-gray-500">Adicionar bloco:</span>
        {ADD_OPTIONS.map(opt => (
          <Button key={opt.type} variant="secondary" size="sm" onClick={() => addBlock(opt.type)}>
            + {opt.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  )
}

function SortableBlock({
  block,
  onChange,
  onRemove,
  onMove,
  canMoveLeft,
  canMoveRight,
}: {
  block: Block
  onChange: (props: Block['props']) => void
  onRemove: () => void
  onMove?: (dir: -1 | 1) => void
  canMoveLeft?: boolean
  canMoveRight?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${
        isDragging ? 'opacity-60 ring-2 ring-iasd-accent' : ''
      }`}
    >
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Arrastar para reordenar"
            className="cursor-grab touch-none text-gray-400 hover:text-iasd-dark active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <DragHandleIcon />
          </button>
          <span className="text-sm font-medium text-iasd-dark">{BLOCK_LABELS[block.type]}</span>
        </div>
        <div className="flex items-center gap-1">
          {onMove && (
            <>
              <button
                type="button"
                onClick={() => onMove(-1)}
                disabled={!canMoveLeft}
                aria-label="Mover bloco para a coluna anterior"
                title="Mover para a coluna anterior"
                className="rounded px-1.5 py-1 text-sm text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                disabled={!canMoveRight}
                aria-label="Mover bloco para a próxima coluna"
                title="Mover para a próxima coluna"
                className="rounded px-1.5 py-1 text-sm text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ▶
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover bloco"
            className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
          >
            Remover
          </button>
        </div>
      </div>
      <div className="p-4">
        <BlockEditor block={block} onChange={onChange} />
      </div>
    </div>
  )
}

function BlockEditor({
  block,
  onChange,
}: {
  block: Block
  onChange: (props: Block['props']) => void
}) {
  switch (block.type) {
    case 'heading':
      return <HeadingEditor block={block} onChange={onChange} />
    case 'text':
      return (
        <TextBlockEditor doc={block.props.doc} onChange={doc => onChange({ doc })} />
      )
    case 'image':
      return <ImageEditor block={block} onChange={onChange} />
    case 'gallery':
      return <GalleryEditor block={block} onChange={onChange} />
    case 'video':
      return <VideoEditor block={block} onChange={onChange} />
    default: {
      const _exhaustive: never = block
      return _exhaustive
    }
  }
}
