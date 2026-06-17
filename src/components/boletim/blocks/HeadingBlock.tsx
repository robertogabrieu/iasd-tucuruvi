import type { HeadingBlock as HeadingBlockType } from '@/schemas/boletim'

/**
 * Título de seção do boletim com faixa de fundo (Montserrat).
 * H2: faixa sólida azul-escura com texto branco. H3: faixa clara com borda de destaque.
 */
export default function HeadingBlock({ block }: { block: HeadingBlockType }) {
  const { text, level } = block.props
  if (level === 2) {
    // Faixa azul institucional grande e destacada, com detalhe vermelho à esquerda.
    return (
      <h2 className="font-heading text-2xl md:text-3xl font-bold text-white bg-iasd-dark rounded-md border-l-[6px] border-red-600 px-5 py-3 shadow-sm">
        {text}
      </h2>
    )
  }
  return (
    <h3 className="font-heading text-lg md:text-xl font-semibold text-iasd-dark bg-iasd-accent/10 border-l-4 border-iasd-accent rounded-r-md px-4 py-2">
      {text}
    </h3>
  )
}
