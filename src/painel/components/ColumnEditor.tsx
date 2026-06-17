import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Block, Column } from '@/schemas/boletim'
import BlockList, { BLOCK_ID_PREFIX } from './BlockList'

interface Props {
  /** Id da linha dona destas colunas — compõe o id do droppable de cada coluna. */
  rowId: string
  columns: Column[]
  onChange: (next: Column[]) => void
}

/** Prefixo do id de droppable de uma coluna: `col:<rowId>::<colId>`. */
export const COLUMN_DROPPABLE_PREFIX = 'col:'

export function columnDroppableId(rowId: string, colId: string): string {
  return `${COLUMN_DROPPABLE_PREFIX}${rowId}::${colId}`
}

/** Decodifica `col:<rowId>::<colId>` → { rowId, colId } ou null. */
export function parseColumnDroppableId(id: string): { rowId: string; colId: string } | null {
  if (!id.startsWith(COLUMN_DROPPABLE_PREFIX)) return null
  const rest = id.slice(COLUMN_DROPPABLE_PREFIX.length)
  const sep = rest.indexOf('::')
  if (sep < 0) return null
  return { rowId: rest.slice(0, sep), colId: rest.slice(sep + 2) }
}

// Grade da PRÉ-VISUALIZAÇÃO DO EDITOR (lado a lado). Classes literais para o purge do
// Tailwind. No editor mantemos no máx. 2 colunas por linha em telas médias para caber os
// editores de bloco; em telas grandes abrimos até 4.
const EDITOR_GRID_BY_COUNT: Record<number, string> = {
  1: 'grid grid-cols-1',
  2: 'grid grid-cols-1 md:grid-cols-2',
  3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
}

/**
 * Renderiza as colunas de uma linha lado a lado. O DndContext é único e vive em RowList;
 * aqui cada coluna recebe seu próprio SortableContext (blocos da coluna) e é um droppable
 * (para aceitar blocos arrastados de outras colunas, inclusive quando vazia).
 */
export default function ColumnEditor({ rowId, columns, onChange }: Props) {
  const count = Math.min(4, Math.max(1, columns.length))

  function setColumnBlocks(colId: string, blocks: Block[]) {
    onChange(columns.map(c => (c.id === colId ? { ...c, blocks } : c)))
  }

  /** Move um bloco da coluna `fromIdx` para a adjacente (dir -1 anterior, +1 próxima). Fallback acessível. */
  function moveBlock(fromIdx: number, blockId: string, dir: -1 | 1) {
    const toIdx = fromIdx + dir
    if (toIdx < 0 || toIdx >= columns.length) return
    const from = columns[fromIdx]
    const block = from.blocks.find(b => b.id === blockId)
    if (!block) return
    const next = columns.map((c, i) => {
      if (i === fromIdx) return { ...c, blocks: c.blocks.filter(b => b.id !== blockId) }
      if (i === toIdx) return { ...c, blocks: [...c.blocks, block] }
      return c
    })
    onChange(next)
  }

  return (
    <div className={`${EDITOR_GRID_BY_COUNT[count]} gap-3`}>
      {columns.map((col, idx) => (
        <DroppableColumn key={col.id} rowId={rowId} col={col} index={idx} showLabel={columns.length > 1}>
          <SortableContext
            items={col.blocks.map(b => BLOCK_ID_PREFIX + b.id)}
            strategy={verticalListSortingStrategy}
          >
            <BlockList
              blocks={col.blocks}
              onChange={blocks => setColumnBlocks(col.id, blocks)}
              onMoveBlock={columns.length > 1 ? (bid, dir) => moveBlock(idx, bid, dir) : undefined}
              canMoveLeft={idx > 0}
              canMoveRight={idx < columns.length - 1}
            />
          </SortableContext>
        </DroppableColumn>
      ))}
    </div>
  )
}

function DroppableColumn({
  rowId,
  col,
  index,
  showLabel,
  children,
}: {
  rowId: string
  col: Column
  index: number
  showLabel: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(rowId, col.id) })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-gray-50/60 p-3 transition-colors ${
        isOver ? 'border-iasd-accent bg-iasd-accent/5' : 'border-gray-200'
      }`}
    >
      {showLabel && (
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          Coluna {index + 1}
        </div>
      )}
      {children}
    </div>
  )
}
