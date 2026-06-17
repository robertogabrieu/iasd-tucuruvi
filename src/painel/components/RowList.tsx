import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
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
import { makeColumn, makeRow, type Block, type Column, type Row } from '@/schemas/boletim'
import ColumnEditor, { parseColumnDroppableId } from './ColumnEditor'
import { BLOCK_LABELS, BLOCK_ID_PREFIX, DragHandleIcon } from './BlockList'

interface Props {
  rows: Row[]
  onChange: (next: Row[]) => void
}

const COLUMN_COUNTS = [1, 2, 3, 4] as const
const ROW_ID_PREFIX = 'row:'

// ── Id helpers ────────────────────────────────────────────────────────────────
const isRowId = (id: string) => id.startsWith(ROW_ID_PREFIX)
const isBlockId = (id: string) => id.startsWith(BLOCK_ID_PREFIX)
const stripRow = (id: string) => id.slice(ROW_ID_PREFIX.length)
const stripBlock = (id: string) => id.slice(BLOCK_ID_PREFIX.length)

// ── Pure lookups / moves over Row[] ─────────────────────────────────────────────

type BlockLoc = { rowIdx: number; colIdx: number; blockIdx: number }

/** Localiza um bloco pelo seu id (sem prefixo) varrendo linhas→colunas→blocos. */
function findBlock(rows: Row[], blockId: string): BlockLoc | null {
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const cols = rows[rowIdx].columns
    for (let colIdx = 0; colIdx < cols.length; colIdx++) {
      const blockIdx = cols[colIdx].blocks.findIndex(b => b.id === blockId)
      if (blockIdx >= 0) return { rowIdx, colIdx, blockIdx }
    }
  }
  return null
}

/** Localiza uma coluna a partir do id de droppable `col:<rowId>::<colId>`. */
function findColumnByDroppableId(
  rows: Row[],
  droppableId: string,
): { rowIdx: number; colIdx: number } | null {
  const parsed = parseColumnDroppableId(droppableId)
  if (!parsed) return null
  const rowIdx = rows.findIndex(r => r.id === parsed.rowId)
  if (rowIdx < 0) return null
  const colIdx = rows[rowIdx].columns.findIndex(c => c.id === parsed.colId)
  if (colIdx < 0) return null
  return { rowIdx, colIdx }
}

/**
 * Move imutavelmente um bloco de uma posição (linha/coluna/índice) para outra coluna,
 * inserindo no índice indicado (`toBlockIdx`; use o tamanho da coluna destino p/ anexar).
 */
function moveBlock(
  rows: Row[],
  from: BlockLoc,
  to: { rowIdx: number; colIdx: number; blockIdx: number },
): Row[] {
  const block = rows[from.rowIdx]?.columns[from.colIdx]?.blocks[from.blockIdx]
  if (!block) return rows

  return rows.map((row, ri) => {
    const touchesFrom = ri === from.rowIdx
    const touchesTo = ri === to.rowIdx
    if (!touchesFrom && !touchesTo) return row

    const columns = row.columns.map((col, ci) => {
      let blocks = col.blocks
      // remover da origem
      if (touchesFrom && ci === from.colIdx) {
        blocks = blocks.filter(b => b.id !== block.id)
      }
      // inserir no destino (recalculando sobre a lista possivelmente já filtrada)
      if (touchesTo && ci === to.colIdx) {
        const idx = Math.max(0, Math.min(to.blockIdx, blocks.length))
        blocks = [...blocks.slice(0, idx), block, ...blocks.slice(idx)]
      }
      return blocks === col.blocks ? col : { ...col, blocks }
    })
    return { ...row, columns }
  })
}

/** Editor do conteúdo: lista de linhas ordenáveis, cada uma com 1..4 colunas de blocos. */
export default function RowList({ rows, onChange }: Props) {
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [activeBlock, setActiveBlock] = useState<Block | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /** Dado o id do alvo (over), descobre a coluna+índice de inserção destino p/ um bloco. */
  function resolveBlockTarget(
    current: Row[],
    overId: string,
  ): { rowIdx: number; colIdx: number; blockIdx: number } | null {
    if (isBlockId(overId)) {
      const loc = findBlock(current, stripBlock(overId))
      if (!loc) return null
      return { rowIdx: loc.rowIdx, colIdx: loc.colIdx, blockIdx: loc.blockIdx }
    }
    const col = findColumnByDroppableId(current, overId)
    if (!col) return null
    // soltar sobre a coluna (área vazia) → anexa ao fim
    return { rowIdx: col.rowIdx, colIdx: col.colIdx, blockIdx: current[col.rowIdx].columns[col.colIdx].blocks.length }
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    if (isRowId(id)) {
      setActiveRowId(stripRow(id))
      return
    }
    if (isBlockId(id)) {
      const loc = findBlock(rows, stripBlock(id))
      if (loc) setActiveBlock(rows[loc.rowIdx].columns[loc.colIdx].blocks[loc.blockIdx])
    }
  }

  /** Move blocos entre colunas/linhas ao vivo (padrão multi-container). Ignora drags de linha. */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (!isBlockId(activeId)) return // linhas: nada a fazer no over

    const from = findBlock(rows, stripBlock(activeId))
    if (!from) return
    const target = resolveBlockTarget(rows, overId)
    if (!target) return

    // mesma coluna → o SortableContext já cuida do preview; nada a mover aqui.
    if (from.rowIdx === target.rowIdx && from.colIdx === target.colIdx) return

    // move para a coluna destino (insere na posição do alvo, ou ao fim em coluna vazia)
    onChange(moveBlock(rows, from, target))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveRowId(null)
    setActiveBlock(null)
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    // ── Reordenar LINHAS ──
    if (isRowId(activeId)) {
      if (!isRowId(overId)) return
      const oldIndex = rows.findIndex(r => ROW_ID_PREFIX + r.id === activeId)
      const newIndex = rows.findIndex(r => ROW_ID_PREFIX + r.id === overId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      onChange(arrayMove(rows, oldIndex, newIndex))
      return
    }

    // ── Finalizar BLOCO (cross-column já aplicado no dragOver; aqui reordena dentro do destino) ──
    if (isBlockId(activeId)) {
      const from = findBlock(rows, stripBlock(activeId))
      if (!from) return
      const target = resolveBlockTarget(rows, overId)
      if (!target) return
      if (from.rowIdx === target.rowIdx && from.colIdx === target.colIdx) {
        if (from.blockIdx === target.blockIdx) return
        const next = rows.map((row, ri) => {
          if (ri !== from.rowIdx) return row
          const columns = row.columns.map((col, ci) => {
            if (ci !== from.colIdx) return col
            return { ...col, blocks: arrayMove(col.blocks, from.blockIdx, target.blockIdx) }
          })
          return { ...row, columns }
        })
        onChange(next)
      }
      // posições em coluna diferente já foram consolidadas no handleDragOver.
    }
  }

  function handleDragCancel() {
    setActiveRowId(null)
    setActiveBlock(null)
  }

  function setRowColumns(rowId: string, columns: Column[]) {
    onChange(rows.map(r => (r.id === rowId ? { ...r, columns } : r)))
  }

  /**
   * Ajusta o número de colunas de uma linha. Ao REDUZIR, os blocos das colunas removidas
   * são despejados na última coluna que permanece (nada se perde). Ao AUMENTAR, anexa
   * colunas vazias ao final.
   */
  function setColumnCount(rowId: string, target: number) {
    onChange(
      rows.map(r => {
        if (r.id !== rowId) return r
        const cur = r.columns.length
        if (target === cur) return r
        if (target > cur) {
          const extra = Array.from({ length: target - cur }, makeColumn)
          return { ...r, columns: [...r.columns, ...extra] }
        }
        // reduzir: mantém as `target` primeiras; move blocos das demais para a última mantida.
        const kept = r.columns.slice(0, target).map(c => ({ ...c, blocks: [...c.blocks] }))
        const dropped = r.columns.slice(target)
        const last = kept[kept.length - 1]
        for (const c of dropped) last.blocks.push(...c.blocks)
        return { ...r, columns: kept }
      }),
    )
  }

  function removeRow(rowId: string) {
    onChange(rows.filter(r => r.id !== rowId))
  }

  function addRow() {
    onChange([...rows, makeRow(1)])
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
          Nenhuma linha ainda. Adicione a primeira abaixo.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={rows.map(r => ROW_ID_PREFIX + r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {rows.map((row, idx) => (
                <SortableRow
                  key={row.id}
                  row={row}
                  index={idx}
                  onColumns={cols => setRowColumns(row.id, cols)}
                  onColumnCount={n => setColumnCount(row.id, n)}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeBlock ? (
              <div className="flex items-center gap-2 rounded-xl border border-iasd-accent bg-white px-3 py-2 shadow-lg">
                <DragHandleIcon />
                <span className="text-sm font-medium text-iasd-dark">
                  {BLOCK_LABELS[activeBlock.type]}
                </span>
              </div>
            ) : activeRowId ? (
              <div className="flex items-center gap-2 rounded-xl border border-iasd-accent bg-white px-3 py-2 shadow-lg">
                <DragHandleIcon />
                <span className="text-sm font-semibold text-iasd-dark">Linha</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <div className="border-t border-gray-200 pt-4">
        <Button variant="secondary" size="sm" onClick={addRow}>
          + Adicionar linha
        </Button>
      </div>
    </div>
  )
}

function SortableRow({
  row,
  index,
  onColumns,
  onColumnCount,
  onRemove,
}: {
  row: Row
  index: number
  onColumns: (cols: Column[]) => void
  onColumnCount: (n: number) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ROW_ID_PREFIX + row.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-gray-300 bg-white shadow-sm ${
        isDragging ? 'opacity-60 ring-2 ring-iasd-accent' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Arrastar para reordenar a linha"
            className="cursor-grab touch-none text-gray-400 hover:text-iasd-dark active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <DragHandleIcon />
          </button>
          <span className="text-sm font-semibold text-iasd-dark">Linha {index + 1}</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Colunas:
            <div className="flex overflow-hidden rounded-md border border-gray-300">
              {COLUMN_COUNTS.map(n => {
                const active = row.columns.length === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onColumnCount(n)}
                    aria-pressed={active}
                    className={`px-2.5 py-1 text-sm ${
                      active
                        ? 'bg-iasd-accent font-medium text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </label>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover linha"
            className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
          >
            Remover linha
          </button>
        </div>
      </div>
      <div className="p-3">
        <ColumnEditor rowId={row.id} columns={row.columns} onChange={onColumns} />
      </div>
    </div>
  )
}
