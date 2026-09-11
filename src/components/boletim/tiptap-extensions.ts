import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

/**
 * Conjunto ÚNICO de extensões do TipTap usado pelo editor (TextBlockEditor) E pelo renderer
 * (TextBlock via generateHTML). Importar daqui nos dois lados garante que o HTML gerado bata
 * exatamente com o que foi editado. Heading limitado a 1-3 (Título 1/2/3).
 */
export const boletimTextExtensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Link.configure({ HTMLAttributes: { rel: 'noopener nofollow', target: '_blank' } }),
]
