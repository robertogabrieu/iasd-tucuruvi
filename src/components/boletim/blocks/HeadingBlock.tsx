import type { HeadingBlock as HeadingBlockType } from '@/schemas/boletim'

/** Título de seção do boletim (h2/h3), tipografia Montserrat. */
export default function HeadingBlock({ block }: { block: HeadingBlockType }) {
  const { text, level } = block.props
  const Tag = level === 2 ? 'h2' : 'h3'
  const size = level === 2 ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
  return (
    <Tag className={`font-heading font-bold text-iasd-dark ${size}`}>{text}</Tag>
  )
}
