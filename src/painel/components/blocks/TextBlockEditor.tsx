import { useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import type { TipTapDoc } from '@/schemas/boletim'

// IMPORTANTE: este conjunto de extensões deve bater EXATAMENTE com o do renderer
// (src/components/boletim/blocks/TextBlock.tsx). Caso contrário, o texto salvo
// pode renderizar diferente do que foi editado.
const extensions = [
  StarterKit,
  Link.configure({ HTMLAttributes: { rel: 'noopener nofollow', target: '_blank' } }),
]

interface Props {
  /** doc TipTap inicial (props.doc do bloco). */
  doc: TipTapDoc
  onChange: (doc: TipTapDoc) => void
}

/** Editor de texto rico (TipTap) com barra de formatação on-brand. */
export default function TextBlockEditor({ doc, onChange }: Props) {
  const editor = useEditor({
    extensions,
    content: doc && Object.keys(doc).length > 0 ? doc : undefined,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as TipTapDoc),
    editorProps: {
      attributes: {
        class:
          'boletim-prose font-sans text-base leading-relaxed text-gray-800 min-h-[7rem] focus:outline-none',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="rounded-lg border border-gray-300 focus-within:border-iasd-accent focus-within:ring-2 focus-within:ring-iasd-accent/40">
      <Toolbar editor={editor} />
      <div className="px-3 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`min-w-[2rem] rounded px-2 py-1 text-sm font-medium transition-colors ${
        active ? 'bg-iasd-dark text-white' : 'text-iasd-dark hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linkInput, setLinkInput] = useState<string | null>(null)

  function applyLink() {
    const href = (linkInput ?? '').trim()
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      const normalized = /^https?:\/\//i.test(href) ? href : `https://${href}`
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
    }
    setLinkInput(null)
  }

  function startLink() {
    const current = editor.getAttributes('link').href as string | undefined
    setLinkInput(current ?? '')
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
      <ToolbarButton
        label="Negrito"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        label="Itálico"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden="true" />
      <ToolbarButton
        label="Lista com marcadores"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • Lista
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. Lista
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden="true" />
      <ToolbarButton label="Inserir/editar link" active={editor.isActive('link')} onClick={startLink}>
        🔗 Link
      </ToolbarButton>
      {editor.isActive('link') && (
        <ToolbarButton
          label="Remover link"
          onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
        >
          ⊘ Tirar link
        </ToolbarButton>
      )}

      {linkInput !== null && (
        <div className="flex w-full items-center gap-2 pt-1.5">
          <input
            autoFocus
            type="url"
            value={linkInput}
            placeholder="https://exemplo.com"
            onChange={e => setLinkInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              } else if (e.key === 'Escape') {
                setLinkInput(null)
              }
            }}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent/40"
          />
          <button
            type="button"
            onClick={applyLink}
            className="rounded bg-iasd-dark px-3 py-1 text-sm font-medium text-white hover:bg-iasd-accent"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => setLinkInput(null)}
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-200"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
