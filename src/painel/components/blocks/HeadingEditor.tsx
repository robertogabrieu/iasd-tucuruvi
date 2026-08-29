import { Field, Input, Select } from '@/painel/ui'
import type { HeadingBlock } from '@/schemas/boletim'

interface Props {
  block: HeadingBlock
  onChange: (props: HeadingBlock['props']) => void
}

/** Editor de bloco de título: texto + nível (2/3). */
export default function HeadingEditor({ block, onChange }: Props) {
  const { text, level } = block.props
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
      <Field label="Título">
        <Input
          value={text}
          maxLength={200}
          placeholder="Texto do título…"
          onChange={e => onChange({ text: e.target.value, level })}
        />
      </Field>
      <Field label="Nível">
        <Select
          value={String(level)}
          onChange={e => onChange({ text, level: Number(e.target.value) as 2 | 3 })}
        >
          <option value="2">Maior (H2)</option>
          <option value="3">Menor (H3)</option>
        </Select>
      </Field>
    </div>
  )
}
