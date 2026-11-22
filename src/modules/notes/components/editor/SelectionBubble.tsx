import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useEditorState } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Palette,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { NOTE_SHADES, shadeLabel } from '../../editor/colors'
import { useNoteEditor } from '../../editor/NoteEditorProvider'

interface BubbleAnchor {
  x: number
  y: number
}

const TEXT_STYLES = [
  { label: 'Text', glyph: 'Aa' },
  { label: 'Heading 1', glyph: 'H1' },
  { label: 'Heading 2', glyph: 'H2' },
  { label: 'Heading 3', glyph: 'H3' },
  { label: 'Heading 4', glyph: 'H4' },
  { label: 'Bullet list', glyph: '•' },
  { label: 'Numbered list', glyph: '1.' },
  { label: 'To-do list', glyph: '☑' },
  { label: 'Quote', glyph: '❝' },
] as const

export function SelectionBubble() {
  const editor = useNoteEditor()
  const [anchor, setAnchor] = useState<BubbleAnchor | null>(null)
  const [openPop, setOpenPop] = useState<'text' | 'link' | 'color' | 'align' | null>(null)
  const [linkValue, setLinkValue] = useState('')
  const [size, setSize] = useState({ w: 384, h: 34 })
  const rootRef = useRef<HTMLDivElement>(null)
  /* Mirror of `openPop` read inside the selection-tracking effect (which
     binds its listeners once): while ANY sub-palette is open the bubble
     must never hide — the link input takes focus from the editor, and the
     blur → hide → unmount used to kill the pop before a URL could be
     typed (the "toolbar link is broken" bug). */
  const openPopRef = useRef<'text' | 'link' | 'color' | 'align' | null>(null)
  openPopRef.current = openPop
  /* Mobile: the floating bubble is disabled — every control lives in the
     bottom accessory bar (user call: no overlapping floating chrome). */
  const [floatingOk, setFloatingOk] = useState(true)
  useEffect(() => {
    setFloatingOk(
      window.matchMedia('(pointer: fine)').matches && window.matchMedia('(hover: hover)').matches
    )
  }, [])

  const flags = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null
      let block = 'Text'
      if (current.isActive('heading', { level: 1 })) block = 'Heading 1'
      else if (current.isActive('heading', { level: 2 })) block = 'Heading 2'
      else if (current.isActive('heading', { level: 3 })) block = 'Heading 3'
      else if (current.isActive('heading', { level: 4 })) block = 'Heading 4'
      else if (current.isActive('bulletList')) block = 'Bullet list'
      else if (current.isActive('orderedList')) block = 'Numbered list'
      else if (current.isActive('taskList')) block = 'To-do list'
      else if (current.isActive('blockquote')) block = 'Quote'
      return {
        block,
        bold: current.isActive('bold'),
        italic: current.isActive('italic'),
        underline: current.isActive('underline'),
        strike: current.isActive('strike'),
        code: current.isActive('code'),
        link: current.isActive('link'),
        color: String(current.getAttributes('noteTextColor').shade ?? '') || null,
        bg: String(current.getAttributes('noteTextBg').shade ?? '') || null,
      }
    },
  })

  // Track the selection and keep the toolbar parked above it.
  useEffect(() => {
    if (!editor) return
    const update = () => {
      if (editor.isDestroyed) {
        setAnchor(null)
        return
      }
      // A sub-palette is open (link input, colors…): freeze the position
      // and never hide, even though the editor lost focus to the input.
      if (openPopRef.current) return
      if (document.body.classList.contains('note-dragging-active')) {
        setAnchor(null)
        return
      }
      const { state, view } = editor
      const { from, to, empty } = state.selection
      if (empty || !view.hasFocus() || editor.isActive('codeBlock')) {
        setAnchor(null)
        return
      }
      // Widgets own their controls: a node selection (image, divider, file,
      // embed…) shows its own Notion-style toolbar, never the text bubble.
      if (state.selection instanceof NodeSelection) {
        setAnchor(null)
        return
      }
      // A selection spanning several top-level blocks is the block-range
      // selection — the soft blue block overlay speaks for it.
      let first = -1
      let last = -1
      state.doc.forEach((node, offset, index) => {
        const end = offset + node.nodeSize
        if (from >= offset && from < end) first = index
        if (to > offset && to <= end) last = index
      })
      if (first !== -1 && last !== -1 && first !== last) {
        setAnchor(null)
        return
      }
      try {
        const start = view.coordsAtPos(from)
        const end = view.coordsAtPos(to, -1)
        const top = Math.min(start.top, end.top)
        const centerX = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2
        setAnchor({ x: centerX, y: top })
      } catch {
        setAnchor(null) // coords unavailable at this position (end of doc)
      }
    }
    const hide = () => {
      // Same freeze: editor blur while a palette is open is EXPECTED
      // (the palette input owns focus) — keep the toolbar up.
      if (openPopRef.current) return
      setAnchor(null)
    }
    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.on('blur', hide)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', hide)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.off('blur', hide)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', hide)
    }
  }, [editor])

  // Clicking anywhere outside closes the sub-palettes.
  useEffect(() => {
    if (!openPop) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenPop(null)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [openPop])

  useEffect(() => {
    if (!openPop) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPop(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPop])

  // Measure the real toolbar box (it can wrap on small screens) so it stays
  // centered above the selection instead of drifting on the first frame.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el || !anchor) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    if (w !== size.w || h !== size.h) setSize({ w, h })
  }, [anchor, size.w, size.h])

  if (!editor || !flags || !anchor || !floatingOk) return null

  // Keep the toolbar over the note page, not over the notes sidebar.
  let canvas: HTMLElement | null = null
  try {
    canvas = editor.isDestroyed
      ? null
      : (editor.view.dom.closest('.note-canvas') as HTMLElement | null)
  } catch {
    canvas = null // view not mounted (editor recreating on note switch)
  }
  const bounds = canvas?.getBoundingClientRect()
  const minLeft = bounds ? Math.max(8, bounds.left + 8) : 8
  const maxLeft = bounds
    ? Math.max(minLeft, bounds.right - size.w - 8)
    : Math.max(8, window.innerWidth - size.w - 8)
  const left = Math.min(Math.max(anchor.x - size.w / 2, minLeft), maxLeft)
  const top = Math.max(8, anchor.y - size.h - 6)

  const applyLink = () => {
    const href = linkValue.trim()
    if (!href) editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setOpenPop(null)
    editor.view.focus()
  }

  /* Code — Notion's split:
     · selection inside ONE text block → inline code mark;
     · selection spanning 2+ blocks/lines → ONE code block, the selected
       lines preserved as its content (never a broken inline-code span
       across a paragraph break). */
  const applyCode = () => {
    const { state } = editor
    const { from, to, empty } = state.selection
    if (empty) return
    const sameBlock = state.selection.$from.sameParent(state.selection.$to)
    if (sameBlock) {
      editor.chain().focus().toggleCode().run()
      return
    }
    const text = state.doc.textBetween(from, to, '\n')
    if (!text.trim()) return
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from, to },
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text }],
        }
      )
      .run()
  }

  const setBlock = (label: string) => {
    const chain = editor.chain().focus()
    if (label === 'Text') chain.setParagraph().run()
    else if (label === 'Heading 1') chain.toggleHeading({ level: 1 }).run()
    else if (label === 'Heading 2') chain.toggleHeading({ level: 2 }).run()
    else if (label === 'Heading 3') chain.toggleHeading({ level: 3 }).run()
    else if (label === 'Heading 4') chain.toggleHeading({ level: 4 }).run()
    else if (label === 'Bullet list') chain.toggleBulletList().run()
    else if (label === 'Numbered list') chain.toggleOrderedList().run()
    else if (label === 'To-do list') chain.toggleTaskList().run()
    else if (label === 'Quote') chain.toggleBlockquote().run()
    setOpenPop(null)
  }

  return (
    <div
      ref={rootRef}
      className="note-bubble"
      style={{ top, left }}
      role="toolbar"
      aria-label="Formatting"
    >
      {/* Block switcher: Text / headings / lists / quote */}
      <div className="relative">
        <BubbleButton
          label="Turn into"
          active={openPop === 'text'}
          className="note-bubble-text"
          onClick={() => setOpenPop((current) => (current === 'text' ? null : 'text'))}
        >
          <span className="tabular-nums">{flags.block}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </BubbleButton>
        {openPop === 'text' && (
          <div
            className="note-bubble-pop"
            style={{ top: 36, left: 0, width: 208 }}
            role="menu"
            aria-label="Turn into"
          >
            {TEXT_STYLES.map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn('note-pop-item', flags.block === item.label && 'is-active')}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setBlock(item.label)}
              >
                <span className="text-muted-foreground w-6 shrink-0 text-center font-mono text-[12px] font-semibold">
                  {item.glyph}
                </span>
                {item.label}
                {flags.block === item.label && <Check className="ml-auto h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="note-bubble-split" />

      <BubbleButton
        label="Bold"
        active={flags.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </BubbleButton>
      <BubbleButton
        label="Italic"
        active={flags.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </BubbleButton>
      <BubbleButton
        label="Underline"
        active={flags.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-3.5 w-3.5" />
      </BubbleButton>
      <BubbleButton
        label="Strikethrough"
        active={flags.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </BubbleButton>

      <span className="note-bubble-split" />

      <BubbleButton
        label="Link"
        active={flags.link}
        onClick={() => {
          setLinkValue(editor.getAttributes('link').href ?? '')
          setOpenPop((current) => (current === 'link' ? null : 'link'))
        }}
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </BubbleButton>
      <BubbleButton label="Code" active={flags.code} onClick={applyCode}>
        <Code className="h-3.5 w-3.5" />
      </BubbleButton>

      <span className="note-bubble-split" />

      <BubbleButton
        label="Text color & highlight"
        active={Boolean(flags.color) || Boolean(flags.bg)}
        onClick={() => setOpenPop((current) => (current === 'color' ? null : 'color'))}
      >
        <Palette className="h-3.5 w-3.5" />
      </BubbleButton>
      <BubbleButton
        label="Highlight"
        active={Boolean(flags.bg)}
        onClick={() => setOpenPop((current) => (current === 'color' ? null : 'color'))}
      >
        <Highlighter className="h-3.5 w-3.5" />
      </BubbleButton>
      <BubbleButton
        label="Align"
        active={openPop === 'align'}
        onClick={() => setOpenPop((current) => (current === 'align' ? null : 'align'))}
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </BubbleButton>
      <BubbleButton
        label="Clear formatting"
        onClick={() =>
          editor
            .chain()
            .focus()
            .clearNodes()
            .unsetAllMarks()
            .setNoteTextColor(null)
            .setNoteTextBg(null)
            .run()
        }
      >
        <RemoveFormatting className="h-3.5 w-3.5" />
      </BubbleButton>

      {openPop === 'link' && (
        <form
          className="note-bubble-pop"
          style={{ top: 36, left: 0, width: 288 }}
          onSubmit={(event) => {
            event.preventDefault()
            applyLink()
          }}
        >
          <input
            autoFocus
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            placeholder="https://"
            aria-label="Link URL"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 w-full rounded-md border px-2.5 py-1.5 text-[13px] transition-colors duration-150 outline-none"
          />
          <div className="text-muted-foreground mt-1.5 flex items-center justify-between px-1 text-[11px]">
            <span>Press Enter to apply</span>
            {flags.link && (
              <button
                type="button"
                className="hover:text-foreground transition-colors"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetLink().run()
                  setOpenPop(null)
                  editor.view.focus()
                }}
              >
                Remove link
              </button>
            )}
          </div>
        </form>
      )}

      {openPop === 'color' && (
        <div className="note-bubble-pop" style={{ top: 36, left: 0, width: 288 }}>
          <p className="text-muted-foreground px-1 pb-1.5 text-[11px] font-semibold">Text color</p>
          <div className="grid grid-cols-10 gap-1 px-1 pb-2">
            <Swatch
              title="Default"
              className="is-default"
              active={!flags.color}
              onClick={() => editor.chain().focus().setNoteTextColor(null).run()}
            />
            {NOTE_SHADES.map((shade) => (
              <Swatch
                key={shade.name}
                title={shade.label}
                style={{ background: `var(--note-fg-${shade.name})` }}
                active={flags.color === shade.name}
                onClick={() => editor.chain().focus().setNoteTextColor(shade.name).run()}
              />
            ))}
          </div>
          <p className="text-muted-foreground px-1 pb-1.5 text-[11px] font-semibold">Background</p>
          <div className="grid grid-cols-10 gap-1 px-1 pb-1">
            <Swatch
              title="No highlight"
              className="is-default"
              active={!flags.bg}
              onClick={() => editor.chain().focus().setNoteTextBg(null).run()}
            />
            {NOTE_SHADES.map((shade) => (
              <Swatch
                key={shade.name}
                title={shade.label}
                style={{ background: `var(--note-bg-${shade.name})` }}
                active={flags.bg === shade.name}
                onClick={() => editor.chain().focus().setNoteTextBg(shade.name).run()}
              />
            ))}
          </div>
          <p className="text-muted-foreground px-1 pt-1.5 text-[11px]">
            {shadeLabel(flags.color)} text · {shadeLabel(flags.bg)} background
          </p>
        </div>
      )}

      {openPop === 'align' && (
        <div className="note-bubble-pop" style={{ top: 36, left: 0, width: 168 }}>
          <button
            type="button"
            className="note-pop-item"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            <AlignLeft className="h-3.5 w-3.5" /> Align left
          </button>
          <button
            type="button"
            className="note-pop-item"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            <AlignCenter className="h-3.5 w-3.5" /> Align center
          </button>
          <button
            type="button"
            className="note-pop-item"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            <AlignRight className="h-3.5 w-3.5" /> Align right
          </button>
        </div>
      )}
    </div>
  )
}

function BubbleButton({
  label,
  active,
  onClick,
  className,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Keep the editor selection alive while clicking the toolbar.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(className ?? 'note-bubble-btn', active && 'is-active')}
    >
      {children}
    </button>
  )
}

function Swatch({
  title,
  className,
  style,
  active,
  onClick,
}: {
  title: string
  className?: string
  style?: CSSProperties
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      style={style}
      className={cn('note-swatch', className, active && 'is-active')}
    >
      {active && <Check className="h-3 w-3" strokeWidth={2.5} />}
    </button>
  )
}
