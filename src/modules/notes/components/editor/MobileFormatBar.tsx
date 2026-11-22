import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Palette,
  Plus,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from 'lucide-react'
import { useState } from 'react'
import { useNoteEditor } from '../../editor/NoteEditorProvider'
import { NOTE_SHADES } from '../../editor/colors'

export function MobileFormatBar() {
  const editor = useNoteEditor()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  if (!editor) return null

  const mark = (toggle: () => void) => () => {
    try {
      toggle()
    } catch {
      // Editor recreating on note switch.
    }
  }

  /* The + inserts ON THIS LINE: split the caret's block at the caret and
     drop the "/" opener in the new block — the slash menu opens exactly
     where the user was typing. */
  const addBlockOnLine = () => {
    try {
      const { from } = editor.state.selection
      editor
        .chain()
        .focus()
        .insertContentAt(from, { type: 'paragraph', content: [{ type: 'text', text: '/' }] })
        .run()
    } catch {
      // Editor recreating on note switch.
    }
  }

  const setShade = (kind: 'text' | 'bg', shade: string | null) => () => {
    setPaletteOpen(false)
    try {
      if (kind === 'text') editor.chain().focus().setNoteTextColor(shade).run()
      else editor.chain().focus().setNoteTextBg(shade).run()
    } catch {
      // Editor recreating on note switch.
    }
  }

  return (
    <div className="note-accessory" role="toolbar" aria-label="Formatting">
      <button
        type="button"
        className="note-accessory-add"
        aria-label="Insert block here"
        title="Insert block here"
        onClick={addBlockOnLine}
      >
        <Plus className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </button>
      <span className="note-accessory-split" aria-hidden="true" />
      <button
        type="button"
        aria-label="Bold"
        onClick={mark(() => editor.chain().focus().toggleBold().run())}
      >
        <Bold className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        aria-label="Italic"
        onClick={mark(() => editor.chain().focus().toggleItalic().run())}
      >
        <Italic className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        aria-label="Underline"
        onClick={mark(() => editor.chain().focus().toggleUnderline().run())}
      >
        <Underline className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Strikethrough"
        onClick={mark(() => editor.chain().focus().toggleStrike().run())}
      >
        <Strikethrough className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Code"
        onClick={mark(() => editor.chain().focus().toggleCode().run())}
      >
        <Code className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Link"
        onClick={() => {
          try {
            setLinkValue(String(editor.getAttributes('link').href ?? ''))
          } catch {
            setLinkValue('')
          }
          setPaletteOpen(false)
          setLinkOpen((open) => !open)
        }}
      >
        <Link2 className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <span className="note-accessory-split" aria-hidden="true" />
      <button
        type="button"
        aria-label="Heading 1"
        onClick={mark(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
      >
        <span className="text-[13px] font-bold">H1</span>
      </button>
      <button
        type="button"
        aria-label="Heading 2"
        onClick={mark(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      >
        <span className="text-[13px] font-bold">H2</span>
      </button>
      <button
        type="button"
        aria-label="Heading 3"
        onClick={mark(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
      >
        <span className="text-[13px] font-bold">H3</span>
      </button>
      <button
        type="button"
        aria-label="Bulleted list"
        onClick={mark(() => editor.chain().focus().toggleBulletList().run())}
      >
        <List className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Numbered list"
        onClick={mark(() => editor.chain().focus().toggleOrderedList().run())}
      >
        <ListOrdered className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Checklist"
        onClick={mark(() => editor.chain().focus().toggleTaskList().run())}
      >
        <ListTodo className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Quote"
        onClick={mark(() => editor.chain().focus().toggleBlockquote().run())}
      >
        <Quote className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <span className="note-accessory-split" aria-hidden="true" />
      <button
        type="button"
        aria-label="Text color and highlight"
        onClick={() => setPaletteOpen((open) => !open)}
      >
        <Palette className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button type="button" aria-label="Highlight" onClick={setShade('bg', 'yellow')}>
        <Highlighter className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Align left"
        onClick={mark(() => editor.chain().focus().setTextAlign('left').run())}
      >
        <AlignLeft className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Align center"
        onClick={mark(() => editor.chain().focus().setTextAlign('center').run())}
      >
        <AlignCenter className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Align right"
        onClick={mark(() => editor.chain().focus().setTextAlign('right').run())}
      >
        <AlignRight className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Clear formatting"
        onClick={mark(() =>
          editor
            .chain()
            .focus()
            .clearNodes()
            .unsetAllMarks()
            .setNoteTextColor(null)
            .setNoteTextBg(null)
            .run()
        )}
      >
        <RemoveFormatting className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>

      {linkOpen && (
        <form
          className="note-accessory-palette"
          role="menu"
          aria-label="Link"
          onSubmit={(event) => {
            event.preventDefault()
            setLinkOpen(false)
            try {
              const href = linkValue.trim()
              if (!href) editor.chain().focus().unsetLink().run()
              else editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
            } catch {
              // Editor recreating on note switch.
            }
          }}
        >
          <input
            autoFocus
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            placeholder="https://"
            aria-label="Link URL"
            inputMode="url"
            spellCheck={false}
          />
          <button type="submit">Apply</button>
        </form>
      )}

      {paletteOpen && (
        <div className="note-accessory-palette" role="menu" aria-label="Colors">
          <p className="text-muted-foreground px-1 pb-1 text-[11px] font-semibold">Text color</p>
          <div className="note-accessory-shades">
            <button
              type="button"
              className="note-accessory-shade"
              onClick={setShade('text', null)}
              title="Default"
            >
              <span className="note-accessory-shade-dot is-clear" aria-hidden="true" />
            </button>
            {NOTE_SHADES.map((shade) => (
              <button
                key={shade.name}
                type="button"
                className="note-accessory-shade"
                title={shade.label}
                onClick={setShade('text', shade.name)}
              >
                <span
                  className="note-accessory-shade-dot"
                  style={{ background: `var(--note-fg-${shade.name})` }}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
          <p className="text-muted-foreground px-1 pb-1 text-[11px] font-semibold">Highlight</p>
          <div className="note-accessory-shades">
            <button
              type="button"
              className="note-accessory-shade"
              onClick={setShade('bg', null)}
              title="No highlight"
            >
              <span className="note-accessory-shade-dot is-clear" aria-hidden="true" />
            </button>
            {NOTE_SHADES.map((shade) => (
              <button
                key={shade.name}
                type="button"
                className="note-accessory-shade"
                title={shade.label}
                onClick={setShade('bg', shade.name)}
              >
                <span
                  className="note-accessory-shade-dot"
                  style={{ background: `var(--note-bg-${shade.name})` }}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
