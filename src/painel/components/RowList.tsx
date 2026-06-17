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
import { makeColumn, makeRow, type Column, type Row } from '@/schemas/boletim'
import ColumnEditor from './ColumnEditor'

interface Props {
  rows: Row[]
  onChange: (next: Row[]) => void
}

const COLUMN_COUNTS = [1, 2, 3, 4] as const

/** Editor do conteúdo: lista de linhas ordenáveis, cada uma com 1..4 colunas de blocos. */
export default function RowList({ rows, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = rows.findIndex(r => r.id === active.id)
    const newIndex = rows.findIndex(r => r.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(rows, oldIndex, newIndex))
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
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
    id: row.id,
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
        <ColumnEditor columns={row.columns} onChange={onColumns} />
      </div>
    </div>
  )
}
