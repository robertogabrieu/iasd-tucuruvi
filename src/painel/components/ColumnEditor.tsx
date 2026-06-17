import type { Block, Column } from '@/schemas/boletim'
import BlockList from './BlockList'

interface Props {
  columns: Column[]
  onChange: (next: Column[]) => void
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

/** Renderiza as colunas de uma linha lado a lado; cada coluna tem sua própria lista de blocos. */
export default function ColumnEditor({ columns, onChange }: Props) {
  const count = Math.min(4, Math.max(1, columns.length))

  function setColumnBlocks(colId: string, blocks: Block[]) {
    onChange(columns.map(c => (c.id === colId ? { ...c, blocks } : c)))
  }

  /** Move um bloco da coluna `fromIdx` para a adjacente (dir -1 anterior, +1 próxima). */
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
        <div key={col.id} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
          {columns.length > 1 && (
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Coluna {idx + 1}
            </div>
          )}
          <BlockList
            blocks={col.blocks}
            onChange={blocks => setColumnBlocks(col.id, blocks)}
            onMoveBlock={columns.length > 1 ? (bid, dir) => moveBlock(idx, bid, dir) : undefined}
            canMoveLeft={idx > 0}
            canMoveRight={idx < columns.length - 1}
          />
        </div>
      ))}
    </div>
  )
}
