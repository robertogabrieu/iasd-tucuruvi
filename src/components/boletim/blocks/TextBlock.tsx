import { useMemo } from 'react'
import { generateHTML } from '@tiptap/html'
import { boletimTextExtensions as extensions } from '../tiptap-extensions'
import type { TextBlock as TextBlockType } from '@/schemas/boletim'

/**
 * Renderiza o doc TipTap como HTML. `dangerouslySetInnerHTML` é seguro aqui porque o HTML
 * é gerado por `generateHTML` a partir de um schema conhecido (não é HTML cru do usuário).
 */
export default function TextBlock({ block }: { block: TextBlockType }) {
  const html = useMemo(() => {
    try {
      return generateHTML(block.props.doc as Parameters<typeof generateHTML>[0], extensions)
    } catch {
      return ''
    }
  }, [block.props.doc])

  if (!html) return null

  return (
    <div
      className="boletim-prose font-sans text-base leading-relaxed text-gray-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
