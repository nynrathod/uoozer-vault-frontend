import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { NodeSelection, Selection, TextSelection, AllSelection } from '@tiptap/pm/state'
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  Eraser,
  GripVertical,
  Plus,
  Trash2,
  Type,
} from 'lucide-react'
import { NOTE_SHADES } from '../../editor/colors'
import { useNoteEditor } from '../../editor/NoteEditorProvider'

/** How far left of the text column the controls keep responding. */
const GUTTER = 96
/** Keeps the controls inside the viewport on narrow screens. */
const EDGE = 8
/** Vertical forgiveness around a block's box. */
const SLOP = 14
/** How far below the last block still counts as "drop at the end". */
const TAIL = 160
/** Pointer travel (px) before a press on the grip turns into a drag. */
const DRAG_THRESHOLD = 4
/** Distance (px) from the viewport edges where auto-scroll kicks in. */
const EDGE_SCROLL = 72
/** Offset of the floating preview card from the cursor. */
const GHOST_OFFSET_X = 14
const GHOST_OFFSET_Y = 18

interface HandleBox {
  top: number
  left: number
  index: number
}

interface DropLine {
  top: number
  left: number
  width: number
}

interface OverlayRect {
  top: number
  left: number
  width: number
  height: number
}

export interface BlockHit {
  index: number
  upper: boolean
  rect: DOMRect
}

interface PendingDrag {
  index: number
  pointerId: number
  startX: number
  startY: number
}

interface GhostCard {
  x: number
  y: number
  kind: string
  text: string
}

export function blockElements(prose: HTMLElement): HTMLElement[] {
  return Array.from(prose.children) as HTMLElement[]
}

/** The editor's DOM, or null while the view is not mounted yet. */
export function proseDom(editor: Editor): HTMLElement | null {
  if (editor.isDestroyed) return null
  try {
    return editor.view.dom
  } catch {
    return null // EditorContent has not mounted the view yet
  }
}

/** Block under `y`; the tail below the last block maps to "insert at end". */
export function hitBlock(blocks: HTMLElement[], y: number): BlockHit | null {
  for (let index = 0; index < blocks.length; index += 1) {
    const rect = blocks[index].getBoundingClientRect()
    if (y >= rect.top - SLOP && y <= rect.bottom + SLOP) {
      return { index, upper: y < rect.top + rect.height / 2, rect }
    }
  }
  const last = blocks.length > 0 ? blocks[blocks.length - 1].getBoundingClientRect() : null
  if (last && y > last.bottom && y <= last.bottom + TAIL) {
    return { index: blocks.length, upper: false, rect: last }
  }
  return null
}

function withinRegion(rect: DOMRect, x: number, y: number): boolean {
  return (
    x >= rect.left - GUTTER &&
    x <= rect.right + 16 &&
    y >= rect.top - SLOP &&
    y <= rect.bottom + TAIL
  )
}

/**
 * Vertical anchor for the gutter controls: the exact center of the block's
 * first text line, measured from the browser's own line boxes with a DOM
 * Range — headings, list rows, task checkboxes and wrapped paragraphs all
 * line up with the text the user actually sees; no line-height guessing.
 */
function firstLineCenterY(el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  try {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node && !String(node.textContent ?? '').trim()) node = walker.nextNode()
    if (node) {
      const range = document.createRange()
      range.selectNodeContents(node)
      const rects = range.getClientRects()
      if (rects.length > 0) {
        const line = rects[0]
        return line.top + line.height / 2
      }
    }
  } catch {
    // Range measurement is a nicety; fall through to the block box.
  }
  return rect.top + rect.height / 2
}

/** Nearest ancestor that actually scrolls, used to auto-scroll while dragging. */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el.parentElement
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY
    if (/(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight) {
      return current
    }
    current = current.parentElement
  }
  return null
}

/** Label + snippet shown on the preview card while a block is dragged. */
function describeBlock(editor: Editor, index: number): { kind: string; text: string } {
  try {
    if (editor.isDestroyed) return { kind: 'block', text: '' }
    if (index < 0 || index >= editor.state.doc.childCount) return { kind: 'block', text: '' }
    const node = editor.state.doc.child(index)
    const kind = node.type.name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
    const raw = node.textContent.replace(/\s+/g, ' ').trim()
    const text = raw.length === 0 ? 'Empty block' : raw.length > 64 ? `${raw.slice(0, 64)}…` : raw
    return { kind, text }
  } catch {
    return { kind: 'block', text: '' } // view/state not available (note switched)
  }
}

/** Moves the top-level block `from` so it lands before block `to`. */
function moveBlock(editor: Editor, from: number, to: number): boolean {
  try {
    return editor.commands.command(({ tr, state }) => {
      const slots: { offset: number; size: number }[] = []
      state.doc.forEach((node, offset) => slots.push({ offset, size: node.nodeSize }))
      if (from < 0 || from >= slots.length || to < 0 || to > slots.length) return false
      if (to === from || to === from + 1) return true // already in that slot
      const source = slots[from]
      const target = to === slots.length ? state.doc.content.size : slots[to].offset
      const insertAt = target > source.offset ? target - source.size : target
      tr.delete(source.offset, source.offset + source.size)
      tr.insert(insertAt, state.doc.child(from))
      const caret =
        to === slots.length
          ? state.doc.content.size - source.size + 1
          : (to > from ? slots[to].offset - source.size : slots[to].offset) + 1
      try {
        const pos = Math.max(0, Math.min(caret, tr.doc.content.size))
        tr.setSelection(Selection.near(tr.doc.resolve(pos), 1))
      } catch {
        // Atom blocks (images, dividers) keep the current selection.
      }
      return true
    })
  } catch {
    return false // editor recreated mid-drag (note switched)
  }
}

/**
 * Adds a "/" on the SAME line as the block at `index` — a plain text
 * block gets it appended after its text (the slash menu opens on that
 * line, exactly like typing " /"); blocks that cannot hold inline text
 * (widgets, lists, tables) fall back to a fresh paragraph below. The
 * caret lands right after the slash so the menu tracks the query.
 */
function insertSlashInline(editor: Editor, index: number): boolean {
  try {
    const doc = editor.state.doc
    if (index < 0 || index >= doc.childCount) return false
    const block = doc.child(index)
    const inline = block.type.name === 'paragraph' || block.type.name === 'heading'
    const chain = editor.chain().focus()
    if (inline) {
      const at = index === 0 ? 1 : doc.content.size
      let pos = at
      doc.forEach((node, offset, i) => {
        if (i === index) pos = offset + node.nodeSize - 1 // inside the block, after its content
      })
      const empty = block.childCount === 0
      const payload = empty ? '/' : ' /'
      return chain
        .insertContentAt(pos, { type: 'text', text: payload })
        .setTextSelection(pos + payload.length)
        .run()
    }
    let below = doc.content.size
    doc.forEach((node, offset, i) => {
      if (i === index) below = offset + node.nodeSize
    })
    return chain
      .insertContentAt(below, { type: 'paragraph', content: [{ type: 'text', text: '/' }] })
      .setTextSelection(below + 2)
      .run()
  } catch {
    return false // view not mounted yet
  }
}

/* ── Block menu actions (the ⠿ grip's click menu) ───────────────────────── */

export interface BlockSpan {
  from: number
  to: number
}

/** Resolves the top-level block at `index` to {from,to} doc offsets. */
export function blockSpanAt(editor: Editor, index: number): BlockSpan | null {
  try {
    let span: BlockSpan | null = null
    editor.state.doc.forEach((node, offset, i) => {
      if (i === index) span = { from: offset, to: offset + node.nodeSize }
    })
    return span
  } catch {
    return null
  }
}

function deleteBlockAt(editor: Editor, index: number): boolean {
  const span = blockSpanAt(editor, index)
  if (!span) return false
  try {
    return editor.chain().focus().deleteRange(span).run()
  } catch {
    return false
  }
}

function duplicateBlockAt(editor: Editor, index: number): boolean {
  try {
    const child = editor.state.doc.child(index)
    if (!child) return false
    const span = blockSpanAt(editor, index)
    if (!span) return false
    const json = child.toJSON() as Record<string, unknown>
    return editor.chain().focus().insertContentAt(span.to, json).run()
  } catch {
    return false
  }
}

/** Blocks whose contents the menu's "Clear contents" can wipe. */
const CLEARABLE = new Set(['paragraph', 'heading', 'blockquote', 'codeBlock', 'callout'])

function clearBlockAt(editor: Editor, index: number): boolean {
  try {
    const child = editor.state.doc.child(index)
    const span = blockSpanAt(editor, index)
    if (!child || !span) return false
    const schema = editor.state.schema
    const innerFrom = span.from + 1
    const innerTo = span.to - 1
    const tr = editor.state.tr
    if (child.type.name === 'codeBlock') {
      /* A code block's content is `text*` — "empty" means NO children, not
         an empty text node (ProseMirror throws on schema.text('')). */
      tr.delete(innerFrom, innerTo)
    } else {
      const empty =
        child.type.name === 'heading'
          ? child.type.create({ ...child.attrs })
          : schema.nodes.paragraph.create()
      tr.replaceWith(innerFrom, innerTo, empty)
    }
    tr.setMeta('addToHistory', true)
    editor.view.dispatch(tr)
    return true
  } catch {
    return false
  }
}

export type TurnIntoKind = 'text' | 'h1' | 'h2' | 'h3' | 'bullet' | 'ordered' | 'todo' | 'quote'

/** Blocks the Turn-into menu makes sense on. */
const TURN_INTO_TARGETS = new Set(['paragraph', 'heading', 'blockquote', 'codeBlock'])

function turnBlockInto(editor: Editor, index: number, kind: TurnIntoKind): boolean {
  const span = blockSpanAt(editor, index)
  if (!span) return false
  try {
    return editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.setSelection(TextSelection.near(tr.doc.resolve(span.from + 1), 1))
        return true
      })
      .command(({ commands }) => {
        switch (kind) {
          case 'text':
            return commands.setParagraph()
          case 'h1':
            return commands.toggleHeading({ level: 1 })
          case 'h2':
            return commands.toggleHeading({ level: 2 })
          case 'h3':
            return commands.toggleHeading({ level: 3 })
          case 'bullet':
            return commands.toggleBulletList()
          case 'ordered':
            return commands.toggleOrderedList()
          case 'todo':
            return commands.toggleTaskList()
          case 'quote':
            return commands.toggleBlockquote()
          default:
            return false
        }
      })
      .run()
  } catch {
    return false
  }
}

/** Colors the whole block's text (Notion's block color). */
function colorBlockText(
  editor: Editor,
  index: number,
  shade: string | null,
  background: boolean
): boolean {
  const span = blockSpanAt(editor, index)
  if (!span) return false
  try {
    return editor
      .chain()
      .command(({ tr }) => {
        tr.setSelection(TextSelection.create(tr.doc, span.from + 1, span.to - 1))
        return true
      })
      .command(({ commands }) =>
        background ? commands.setNoteTextBg(shade) : commands.setNoteTextColor(shade)
      )
      .run()
  } catch {
    return false
  }
}

/**
 * Top-level nodes Ctrl+A treats as a MODULE (selecting the whole block
 * instead of the whole page). Everything except plain text blocks —
 * widgets, nested structures and code all count.
 */
export const MODULE_NODE_TYPES = new Set([
  'bulletList',
  'orderedList',
  'taskList',
  'toggleBlock',
  'blockquote',
  'callout',
  'codeBlock',
  'columns',
  'table',
  'tableOfContents',
  'stickyBoard',
  'sticky',
  'secret',
  'equation',
  'mediaImage',
  'mediaVideo',
  'audioBlock',
  'fileBlock',
  'bookmark',
  'embed',
  'noteLink',
  'childPage',
  'divider',
  'askAi',
])

export function BlockHandle() {
  const editor = useNoteEditor()
  const [hover, setHover] = useState<HandleBox | null>(null)
  const [dragging, setDragging] = useState(false)
  const [drop, setDrop] = useState<DropLine | null>(null)
  const [ghost, setGhost] = useState<GhostCard | null>(null)
  const [sourceRect, setSourceRect] = useState<OverlayRect | null>(null)
  /** The ⠿ grip's click menu (Notion's block menu) + its open submenu. */
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  const [subMenu, setSubMenu] = useState<'turnInto' | 'color' | null>(null)
  const [colorMode, setColorMode] = useState<'text' | 'bg'>('text')
  /** Pinned while the pointer is ON the controls — they can never vanish
      under the cursor on its way from the block to the left gutter. The
      box snapshot keeps the last position so the controls stay put even
      if the hover hit-test lags one frame behind. */
  const [pinned, setPinned] = useState(false)
  const pinnedBoxRef = useRef<HandleBox | null>(null)
  /** Timestamp of the last drag end — a drag release must not open the menu. */
  const dragEndedAtRef = useRef(0)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [subMenuPos, setSubMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  /* Close the ⠿ menu on outside interaction (kept above the early return so
     the hook order never changes). */
  useEffect(() => {
    if (!menu) return
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenu(null)
        setSubMenu(null)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null)
        setSubMenu(null)
      }
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])
  const pendingRef = useRef<PendingDrag | null>(null)
  const dragRef = useRef<PendingDrag | null>(null)
  const toRef = useRef<number | null>(null)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!editor) return
    // Gutter controls are a mouse affordance: they need a fine pointer AND
    // hover. Touch/laptops-with-touch-screens that fail either check skip
    // them (the + / ⠿ used to overlap the module body on mobile) — settings
    // move to a long-press menu below.
    const fineHover =
      window.matchMedia('(pointer: fine)').matches && window.matchMedia('(hover: hover)').matches
    if (!fineHover) {
      // ── touch: long-press any block for its settings menu ──
      let detach: (() => void) | null = null
      const attach = (prose: HTMLElement) => {
        if (detach) return
        let timer: number | null = null
        let startX = 0
        let startY = 0
        let active = false
        const clear = () => {
          if (timer !== null) window.clearTimeout(timer)
          timer = null
          active = false
        }
        const onPointerDown = (event: PointerEvent) => {
          if (event.pointerType === 'mouse') return
          const target = event.target as Element
          // Fields and widget controls own their touches.
          if (target.closest('input, textarea, select, [contenteditable="false"]')) return
          const blocks = blockElements(prose)
          const hit = hitBlock(blocks, event.clientY)
          if (!hit || hit.index >= blocks.length) return
          clear()
          active = true
          startX = event.clientX
          startY = event.clientY
          timer = window.setTimeout(() => {
            timer = null
            active = false
            try {
              if (editor.isDestroyed) return
              const state = editor.state
              const span = blockSpanAt(editor, hit.index)
              if (span) {
                editor.view.dispatch(
                  state.tr.setSelection(NodeSelection.create(state.doc, span.from))
                )
                editor.view.focus()
              }
            } catch {
              // Document moved under us; the menu still opens.
            }
            setMenu({ index: hit.index, x: event.clientX, y: event.clientY })
          }, 480)
        }
        const onPointerMove = (event: PointerEvent) => {
          if (!active) return
          if (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10)
            clear()
        }
        const onPointerUp = () => clear()
        const onScroll = () => clear()
        prose.addEventListener('pointerdown', onPointerDown, true)
        prose.addEventListener('pointermove', onPointerMove, true)
        prose.addEventListener('pointerup', onPointerUp, true)
        prose.addEventListener('pointercancel', onPointerUp, true)
        prose.addEventListener('scroll', onScroll, true)
        detach = () => {
          clear()
          prose.removeEventListener('pointerdown', onPointerDown, true)
          prose.removeEventListener('pointermove', onPointerMove, true)
          prose.removeEventListener('pointerup', onPointerUp, true)
          prose.removeEventListener('pointercancel', onPointerUp, true)
          prose.removeEventListener('scroll', onScroll, true)
        }
      }
      const onReady = () => {
        const prose = proseDom(editor)
        if (prose) attach(prose)
      }
      const prose = proseDom(editor)
      if (prose) attach(prose)
      editor.on('create', onReady)
      return () => {
        editor.off('create', onReady)
        detach?.()
      }
    }

    let detach: (() => void) | null = null

    const attach = (prose: HTMLElement) => {
      if (detach) return

      const clearHover = () => {
        setHover((current) => (current === null ? current : null))
      }
      const clearDrop = () => {
        toRef.current = null
        setDrop((current) => (current === null ? current : null))
      }

      const updateDrop = (x: number, y: number) => {
        if (!dragRef.current) return
        const rect = prose.getBoundingClientRect()
        if (!withinRegion(rect, x, y)) {
          clearDrop()
          return
        }
        const blocks = blockElements(prose)
        const hit = hitBlock(blocks, y)
        if (!hit) {
          clearDrop()
          return
        }
        const from = dragRef.current.index
        const to = Math.min(hit.upper ? hit.index : hit.index + 1, blocks.length)
        if (to === from || to === from + 1) {
          clearDrop()
          return
        }
        const top = (hit.index === blocks.length || !hit.upper ? hit.rect.bottom : hit.rect.top) - 1
        const line = { top, left: rect.left, width: rect.width }
        toRef.current = to
        setDrop((current) =>
          current &&
          current.top === top &&
          current.left === line.left &&
          current.width === line.width
            ? current
            : line
        )
      }

      const finishDrag = (commit: boolean) => {
        const drag = dragRef.current
        const to = toRef.current // captured before the refs are cleared
        pendingRef.current = null
        dragRef.current = null
        toRef.current = null
        dragEndedAtRef.current = Date.now()
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        document.body.classList.remove('note-dragging-active')
        setSourceRect(null)
        scrollerRef.current = null
        lastPointerRef.current = null
        setDragging(false)
        setDrop(null)
        setGhost(null)
        setHover((current) => (current === null ? current : null))
        if (!commit || !drag || editor.isDestroyed) return
        if (to === null || to === drag.index || to === drag.index + 1) return
        moveBlock(editor, drag.index, to)
        try {
          editor.view.focus()
        } catch {
          // View went away mid-drag (note switched); the caret is not vital.
        }
      }

      const startDrag = (pending: PendingDrag) => {
        dragRef.current = pending
        const blocks = blockElements(prose)
        const source = blocks[pending.index] ?? null
        if (source) {
          const rect = source.getBoundingClientRect()
          setSourceRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
        }
        scrollerRef.current = scrollParentOf(prose)
        document.body.classList.add('note-dragging-active')
        setDragging(true)
        setDrop(null)
        const described = describeBlock(editor, pending.index)
        setGhost({
          x: pending.startX,
          y: pending.startY,
          kind: described.kind,
          text: described.text,
        })
        const step = () => {
          if (!dragRef.current) return
          const point = lastPointerRef.current
          const scroller = scrollerRef.current
          if (point && scroller) {
            const bottomEdge = window.innerHeight - EDGE_SCROLL
            let delta = 0
            if (point.y < EDGE_SCROLL) delta = -Math.ceil((EDGE_SCROLL - point.y) * 0.3)
            else if (point.y > bottomEdge) delta = Math.ceil((point.y - bottomEdge) * 0.3)
            if (delta !== 0) {
              scroller.scrollTop += delta
              updateDrop(point.x, point.y)
            }
          }
          rafRef.current = window.requestAnimationFrame(step)
        }
        rafRef.current = window.requestAnimationFrame(step)
      }

      const onMove = (event: MouseEvent) => {
        if (pendingRef.current || dragRef.current) return
        const rect = prose.getBoundingClientRect()
        if (!withinRegion(rect, event.clientX, event.clientY)) {
          clearHover()
          return
        }
        const blocks = blockElements(prose)
        const hit = hitBlock(blocks, event.clientY)
        if (!hit || hit.index === blocks.length) {
          clearHover()
          return
        }
        const el = blocks[hit.index] ?? null
        // Controls sit centered on the block's first text line, not pinned
        // to its top edge. (Handle box = 20px buttons + 2×1px padding = 22px.)
        const top = el ? Math.max(1, Math.round(firstLineCenterY(el)) - 11) : hit.rect.top + 2
        const left = Math.max(EDGE, rect.left - 50)
        setHover((current) =>
          current && current.index === hit.index && current.top === top && current.left === left
            ? current
            : { top, left, index: hit.index }
        )
      }

      const onPointerMove = (event: PointerEvent) => {
        const pending = pendingRef.current
        const drag = dragRef.current
        if (!pending && !drag) return
        const pointerId = pending?.pointerId ?? drag?.pointerId
        if (event.pointerId !== pointerId) return
        lastPointerRef.current = { x: event.clientX, y: event.clientY }
        if (pending && !drag) {
          const travel = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY)
          if (travel < DRAG_THRESHOLD) return
          startDrag(pending)
        }
        if (dragRef.current) {
          setGhost((current) =>
            current ? { ...current, x: event.clientX, y: event.clientY } : current
          )
          updateDrop(event.clientX, event.clientY)
        }
      }

      const onPointerUp = (event: PointerEvent) => {
        if (dragRef.current && event.pointerId === dragRef.current.pointerId) {
          event.preventDefault()
          finishDrag(true)
          return
        }
        if (pendingRef.current && event.pointerId === pendingRef.current.pointerId) {
          pendingRef.current = null // press released before the threshold: a plain click
        }
      }

      const onPointerCancel = (event: PointerEvent) => {
        const active = dragRef.current ?? pendingRef.current
        if (active && event.pointerId === active.pointerId) finishDrag(false)
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && dragRef.current) {
          event.preventDefault()
          finishDrag(false)
          return
        }
        // Ctrl/Cmd+A — never steal it from native fields (the bookmark /
        // embed / picker inputs need their own select-all).
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === 'a' &&
          !event.shiftKey &&
          !event.altKey
        ) {
          const target = event.target as HTMLElement | null
          if (
            target &&
            target !== editor.view.dom &&
            (target.tagName === 'INPUT' ||
              target.tagName === 'TEXTAREA' ||
              target.tagName === 'SELECT' ||
              (target.isContentEditable && !editor.view.dom.contains(target)))
          ) {
            return // let the field select its own text
          }
          try {
            const state = editor.state
            const from = state.selection.from
            // Second press on an already-selected module → the whole page.
            if (state.selection instanceof NodeSelection) {
              event.preventDefault()
              event.stopPropagation()
              editor.view.dispatch(state.tr.setSelection(new AllSelection(state.doc)))
              return
            }
            // Deepest ancestor first: inside ONE COLUMN of a columns block,
            // select-all covers THAT column's content only — never the
            // whole columns module, never the page. Inside a table cell,
            // the same rule selects the cell's text.
            const $from = state.doc.resolve(from)
            for (let depth = $from.depth; depth > 0; depth -= 1) {
              const ancestor = $from.node(depth)
              if (ancestor.type.name === 'column') {
                const start = $from.before(depth) + 1
                const end = $from.after(depth) - 1
                event.preventDefault()
                event.stopPropagation()
                editor.view.dispatch(
                  state.tr.setSelection(
                    TextSelection.create(state.doc, Math.min(start + 1, end), end)
                  )
                )
                editor.view.focus()
                return
              }
              if (ancestor.type.name === 'tableCell' || ancestor.type.name === 'tableHeader') {
                const start = $from.before(depth) + 1
                const end = $from.after(depth) - 1
                event.preventDefault()
                event.stopPropagation()
                editor.view.dispatch(
                  state.tr.setSelection(
                    TextSelection.create(state.doc, Math.min(start + 1, end), end)
                  )
                )
                editor.view.focus()
                return
              }
            }
            // First press inside a module → select that MODULE whole.
            let moduleSpan: BlockSpan | null = null
            state.doc.forEach((node, offset) => {
              if (
                from >= offset &&
                from < offset + node.nodeSize &&
                MODULE_NODE_TYPES.has(node.type.name)
              ) {
                moduleSpan = { from: offset, to: offset + node.nodeSize }
              }
            })
            if (moduleSpan) {
              const span = moduleSpan as BlockSpan
              event.preventDefault()
              event.stopPropagation()
              editor.view.dispatch(
                state.tr.setSelection(NodeSelection.create(state.doc, span.from))
              )
            }
          } catch {
            // State not ready — the default select-all applies.
          }
        }
      }

      /** Pointer released outside the window: cancel instead of sticking. */
      const onBlur = () => {
        if (dragRef.current || pendingRef.current) finishDrag(false)
      }

      const onScroll = () => {
        if (dragRef.current) {
          const point = lastPointerRef.current
          if (point) updateDrop(point.x, point.y)
          return
        }
        if (!pendingRef.current) clearHover()
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
      document.addEventListener('pointercancel', onPointerCancel)
      /* Capture phase + stopPropagation: prosemirror's baseKeymap binds
         Mod-a itself, and a bubble-phase window listener would only ever
         see the AllSelection it left behind. Capturing at the window lets
         the module-first rule win, and stopping propagation keeps PM from
         also selecting all on the same press. */
      window.addEventListener('keydown', onKeyDown, true)
      window.addEventListener('blur', onBlur)
      window.addEventListener('scroll', onScroll, true)

      detach = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
        document.removeEventListener('pointercancel', onPointerCancel)
        window.removeEventListener('keydown', onKeyDown, true)
        window.removeEventListener('blur', onBlur)
        window.removeEventListener('scroll', onScroll, true)
        finishDrag(false)
      }
    }

    // Attach immediately when the view already exists; otherwise the note
    // switch is recreating the editor — wait for its 'create' event.
    const onReady = () => {
      const prose = proseDom(editor)
      if (prose) attach(prose)
    }
    const prose = proseDom(editor)
    if (prose) attach(prose)
    editor.on('create', onReady)

    return () => {
      editor.off('create', onReady)
      detach?.()
    }
  }, [editor])

  if (!editor) return null

  /* ── The ⠿ menu's capabilities depend on the block it targets ─────────── */
  const menuNode = (() => {
    if (!menu) return null
    try {
      if (editor.isDestroyed) return null
      return editor.state.doc.child(menu.index) ?? null
    } catch {
      return null
    }
  })()
  const canTurnInto = menuNode ? TURN_INTO_TARGETS.has(menuNode.type.name) : false
  const canClear = menuNode ? CLEARABLE.has(menuNode.type.name) : false

  return (
    <>
      {dragging && sourceRect && (
        <div
          className="note-block-dim-ovl"
          style={{
            top: sourceRect.top,
            left: sourceRect.left,
            width: sourceRect.width,
            height: sourceRect.height,
          }}
          aria-hidden="true"
        />
      )}
      {(hover || pinned) && (
        <div
          className={dragging ? 'note-block-handle is-dragging' : 'note-block-handle'}
          style={{
            top: (hover ?? pinnedBoxRef.current)?.top ?? 0,
            left: (hover ?? pinnedBoxRef.current)?.left ?? 0,
          }}
          role="toolbar"
          aria-label="Block actions"
          onMouseEnter={() => {
            pinnedBoxRef.current = hover
            setPinned(true)
          }}
          onMouseLeave={() => setPinned(false)}
        >
          <button
            type="button"
            title="Add block on this line"
            aria-label="Add block on this line"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertSlashInline(editor, (hover ?? pinnedBoxRef.current)?.index ?? 0)}
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Drag to move — click for actions"
            aria-label="Block actions — click for menu, drag to move"
            className="note-block-grip"
            onPointerDown={(event) => {
              if (event.button !== 0) return
              // Keeps focus in the editor and stops text selection without
              // ever relying on native drag-and-drop.
              event.preventDefault()
              try {
                event.currentTarget.setPointerCapture(event.pointerId)
              } catch {
                // Capture is a nicety; the document listeners carry the drag.
              }
              pendingRef.current = {
                index: (hover ?? pinnedBoxRef.current)?.index ?? 0,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
              }
            }}
            onClick={(event) => {
              // A release after a real drag never opens the menu; a plain
              // click on the 6-dot grip opens the block actions menu.
              if (Date.now() - dragEndedAtRef.current < 150) return
              const rect = event.currentTarget.getBoundingClientRect()
              setSubMenu(null)
              setMenu({
                index: (hover ?? pinnedBoxRef.current)?.index ?? 0,
                x: rect.left,
                y: rect.bottom + 6,
              })
            }}
          >
            <GripVertical className="h-3 w-3" strokeWidth={2} />
          </button>
        </div>
      )}
      {dragging && drop && (
        <div
          className="note-block-drop"
          style={{ top: drop.top, left: drop.left, width: drop.width }}
        />
      )}
      {dragging && ghost && (
        <div
          className="note-drag-ghost"
          style={{ left: ghost.x + GHOST_OFFSET_X, top: ghost.y + GHOST_OFFSET_Y }}
          aria-hidden="true"
        >
          <GripVertical className="h-3 w-3 shrink-0" strokeWidth={1.75} />
          <span className="note-drag-kind">{ghost.kind}</span>
          <span className="note-drag-ghost-text">{ghost.text}</span>
        </div>
      )}

      {/* ── The ⠿ block menu: delete · duplicate · clear · turn into · color ·
             move up/down. Fully working, styles in notes.css §20. ── */}
      {menu && (
        <div
          ref={menuRef}
          className="note-block-menu"
          role="menu"
          aria-label="Block actions"
          style={{
            left: Math.max(EDGE, Math.min(menu.x, window.innerWidth - 232)),
            top: Math.min(menu.y, window.innerHeight - 320),
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="note-block-menu-item is-danger"
            onClick={() => {
              deleteBlockAt(editor, menu.index)
              setMenu(null)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} /> Delete
          </button>
          <button
            type="button"
            role="menuitem"
            className="note-block-menu-item"
            onClick={() => {
              duplicateBlockAt(editor, menu.index)
              setMenu(null)
            }}
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.6} /> Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className={`note-block-menu-item${canClear ? '' : 'is-disabled'}`}
            onClick={() => {
              if (!canClear) return
              clearBlockAt(editor, menu.index)
              setMenu(null)
            }}
          >
            <Eraser className="h-3.5 w-3.5" strokeWidth={1.6} /> Clear contents
          </button>
          <button
            type="button"
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={subMenu === 'turnInto'}
            className={`note-block-menu-item${canTurnInto ? '' : 'is-disabled'}`}
            onClick={(event) => {
              if (!canTurnInto) return
              const rect = event.currentTarget.getBoundingClientRect()
              setSubMenu(subMenu === 'turnInto' ? null : 'turnInto')
              setSubMenuPos({ x: rect.right - 2, y: rect.top })
            }}
          >
            <Type className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span className="min-w-0 flex-1">Turn into</span>
            <ChevronRight className="h-3 w-3" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={subMenu === 'color'}
            className="note-block-menu-item"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              setColorMode('text')
              setSubMenu(subMenu === 'color' ? null : 'color')
              setSubMenuPos({ x: rect.right - 2, y: rect.top })
            }}
          >
            <span className="note-block-menu-swatch" aria-hidden="true" />
            <span className="min-w-0 flex-1">Color</span>
            <ChevronRight className="h-3 w-3" strokeWidth={1.75} />
          </button>
          <span className="note-block-menu-sep" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            className="note-block-menu-item"
            onClick={() => {
              moveBlock(editor, menu.index, menu.index - 1)
              setMenu(null)
            }}
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.6} /> Move up
          </button>
          <button
            type="button"
            role="menuitem"
            className="note-block-menu-item"
            onClick={() => {
              moveBlock(editor, menu.index, menu.index + 2)
              setMenu(null)
            }}
          >
            <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.6} /> Move down
          </button>

          {subMenu === 'turnInto' && (
            <div
              className="note-block-menu is-sub"
              role="menu"
              aria-label="Turn into"
              style={{
                left: Math.max(EDGE, Math.min(subMenuPos.x, window.innerWidth - 190)),
                top: Math.min(subMenuPos.y, window.innerHeight - 260),
              }}
            >
              {(
                [
                  ['text', 'Text'],
                  ['h1', 'Heading 1'],
                  ['h2', 'Heading 2'],
                  ['h3', 'Heading 3'],
                  ['bullet', 'Bullet list'],
                  ['ordered', 'Numbered list'],
                  ['todo', 'To-do list'],
                  ['quote', 'Quote'],
                ] as [TurnIntoKind, string][]
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  className="note-block-menu-item"
                  onClick={() => {
                    turnBlockInto(editor, menu.index, kind)
                    setMenu(null)
                    setSubMenu(null)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {subMenu === 'color' && (
            <div
              className="note-block-menu is-sub is-wide"
              role="menu"
              aria-label="Color"
              style={{
                left: Math.max(EDGE, Math.min(subMenuPos.x, window.innerWidth - 250)),
                top: Math.min(subMenuPos.y, window.innerHeight - 330),
              }}
            >
              <div className="note-block-menu-tabs" role="tablist">
                {(['text', 'bg'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={colorMode === mode}
                    className={`note-block-menu-tab${colorMode === mode ? 'is-active' : ''}`}
                    onClick={() => setColorMode(mode)}
                  >
                    {mode === 'text' ? 'Text' : 'Background'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                role="menuitem"
                className="note-block-menu-item"
                onClick={() => {
                  colorBlockText(editor, menu.index, null, colorMode === 'bg')
                  setMenu(null)
                  setSubMenu(null)
                }}
              >
                <span className="note-block-menu-swatch is-default" aria-hidden="true" /> Default
              </button>
              <div className="note-block-menu-shades">
                {NOTE_SHADES.map((shade) => (
                  <button
                    key={shade.name}
                    type="button"
                    role="menuitem"
                    title={shade.label}
                    aria-label={`${colorMode === 'bg' ? 'Background' : 'Text'}: ${shade.label}`}
                    className={`note-block-menu-shade note-swatch-${shade.name}${colorMode === 'bg' ? 'is-bg' : ''}`}
                    onClick={() => {
                      colorBlockText(editor, menu.index, shade.name, colorMode === 'bg')
                      setMenu(null)
                      setSubMenu(null)
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
