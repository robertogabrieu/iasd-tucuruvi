import { useMemo } from 'react'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import type { TextBlock as TextBlockType } from '@/schemas/boletim'

// Mesmo conjunto de extensões do editor (TextBlockEditor) para que a serialização bata.
const extensions = [
  StarterKit,
  Link.configure({ HTMLAttributes: { rel: 'noopener nofollow', target: '_blank' } }),
]

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
