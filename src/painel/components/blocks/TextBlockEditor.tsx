import { useEffect, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { boletimTextExtensions as extensions } from '@/components/boletim/tiptap-extensions'
import type { TipTapDoc } from '@/schemas/boletim'

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

  // Re-hidrata se o doc vier diferente de fora (ex.: após salvar/normalizar no servidor).
  // Não reseta a cada tecla: só aplica quando o doc externo realmente diverge do atual.
  useEffect(() => {
    if (!editor) return
    const incoming = doc && Object.keys(doc).length > 0 ? doc : { type: 'doc', content: [] }
    if (JSON.stringify(incoming) !== JSON.stringify(editor.getJSON())) {
      editor.commands.setContent(incoming as Parameters<typeof editor.commands.setContent>[0], false)
    }
  }, [doc, editor])

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
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')

  /** Abre o popover de link: pré-preenche o texto com a seleção e a URL com o link atual. */
  function startLink() {
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, ' ')
    const currentHref = editor.getAttributes('link').href as string | undefined
    setLinkText(selectedText)
    setLinkUrl(currentHref ?? '')
    setLinkOpen(true)
  }

  function applyLink() {
    const raw = linkUrl.trim()
    if (!raw) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkOpen(false)
      return
    }
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const text = linkText.trim()
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, ' ')
    if (text && text !== selectedText) {
      // Texto digitado diferente da seleção: substitui a seleção (ou insere no cursor) com ele.
      editor.chain().focus().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }).run()
    } else if (selectedText) {
      // Mantém o texto selecionado e só aplica o link.
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    } else {
      // Sem seleção e sem texto: usa a própria URL como texto do link.
      editor.chain().focus().insertContent({ type: 'text', text: raw, marks: [{ type: 'link', attrs: { href } }] }).run()
    }
    setLinkOpen(false)
  }

  const blockStyle = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
      ? 'h2'
      : editor.isActive('heading', { level: 3 })
        ? 'h3'
        : 'p'

  function applyBlockStyle(value: string) {
    if (value === 'p') editor.chain().focus().setParagraph().run()
    else editor.chain().focus().setHeading({ level: Number(value[1]) as 1 | 2 | 3 }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
      <select
        aria-label="Estilo do texto"
        value={blockStyle}
        onChange={e => applyBlockStyle(e.target.value)}
        className="rounded border border-gray-300 bg-white px-1.5 py-1 text-sm text-iasd-dark focus:border-iasd-accent focus:outline-none"
      >
        <option value="p">Parágrafo</option>
        <option value="h1">Título 1</option>
        <option value="h2">Título 2</option>
        <option value="h3">Título 3</option>
      </select>
      <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden="true" />
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

      {linkOpen && (
        <div className="mt-1.5 w-full rounded-md border border-gray-200 bg-white p-2">
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
              Texto do link
              <input
                autoFocus
                type="text"
                value={linkText}
                placeholder="Ex.: clique aqui (vazio = usa a URL)"
                onChange={e => setLinkText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                  else if (e.key === 'Escape') setLinkOpen(false)
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm font-normal text-gray-800 focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
              URL do link
              <input
                type="url"
                value={linkUrl}
                placeholder="https://exemplo.com"
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                  else if (e.key === 'Escape') setLinkOpen(false)
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm font-normal text-gray-800 focus:border-iasd-accent focus:outline-none focus:ring-1 focus:ring-iasd-accent/40"
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkOpen(false)}
                className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyLink}
                className="rounded bg-iasd-dark px-3 py-1 text-sm font-medium text-white hover:bg-iasd-accent"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
