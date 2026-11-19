import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Selection } from '@tiptap/pm/state'
import { GripVertical, Plus } from 'lucide-react'
import { useNoteEditor } from '../editor/NoteEditorProvider'

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

/** Viewport rect for the hover / drag-source overlays. */
interface OverlayRect {
  top: number
  left: number
  width: number
  height: number
}

interface BlockHit {
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

function blockElements(prose: HTMLElement): HTMLElement[] {
  return Array.from(prose.children) as HTMLElement[]
}

/** The editor's DOM, or null while the view is not mounted yet. */
function proseDom(editor: Editor): HTMLElement | null {
  if (editor.isDestroyed) return null
  try {
    return editor.view.dom
  } catch {
    return null // EditorContent has not mounted the view yet
  }
}

/** Block under `y`; the tail below the last block maps to "insert at end". */
function hitBlock(blocks: HTMLElement[], y: number): BlockHit | null {
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
 * Range — so headings, list rows, task checkboxes and wrapped paragraphs all
 * line up with the text the user actually sees, with no line-height guessing.
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

/** Moves the top-level block `from` so it lands before block `to` (end when `to` is the count). */
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
 * Adds a paragraph holding a single "/" under the block at `index` and puts
 * the caret right after it — the slash menu detects it and opens on the
 * top/most-used modules, exactly like typing "/" does.
 */
function insertSlashBelow(editor: Editor, index: number): boolean {
  try {
    const doc = editor.state.doc
    let pos = doc.content.size
    doc.forEach((node, offset, i) => {
      if (i === index) pos = offset + node.nodeSize
    })
    return editor
      .chain()
      .focus()
      .insertContentAt(pos, { type: 'paragraph', content: [{ type: 'text', text: '/' }] })
      .setTextSelection(pos + 2)
      .run()
  } catch {
    return false // view not mounted yet
  }
}

export function BlockHandle() {
  const editor = useNoteEditor()
  const [hover, setHover] = useState<HandleBox | null>(null)
  const [dragging, setDragging] = useState(false)
  const [drop, setDrop] = useState<DropLine | null>(null)
  const [ghost, setGhost] = useState<GhostCard | null>(null)
  /** rev fix: hover / drag visuals are PORTAL-STYLE OVERLAYS now. Writing
   * classes straight onto ProseMirror-managed nodes (the old
   * `note-block-hover` / `note-block-drag-source`) made ProseMirror replace
   * the whole <table> element on every mousemove, which killed the table
   * chrome and every table operation. Overlays never touch editor DOM. */
  const [hoverRect, setHoverRect] = useState<OverlayRect | null>(null)
  const [sourceRect, setSourceRect] = useState<OverlayRect | null>(null)
  const pendingRef = useRef<PendingDrag | null>(null)
  const dragRef = useRef<PendingDrag | null>(null)
  const toRef = useRef<number | null>(null)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!editor) return
    // Gutter controls are a mouse affordance; touch devices skip them.
    if (!window.matchMedia('(pointer: fine)').matches) return

    let detach: (() => void) | null = null

    const attach = (prose: HTMLElement) => {
      if (detach) return

      /** Soft highlight on the block the gutter controls belong to (overlay). */
      const setHoverRectFor = (el: HTMLElement | null) => {
        if (!el) {
          setHoverRect((current) => (current === null ? current : null))
          return
        }
        const rect = el.getBoundingClientRect()
        setHoverRect((current) =>
          current &&
          current.top === rect.top &&
          current.left === rect.left &&
          current.width === rect.width
            ? current
            : { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        )
      }

      const clearHover = () => {
        setHoverRectFor(null)
        setHover((current) => (current === null ? current : null))
      }
      const clearDrop = () => {
        toRef.current = null
        setDrop((current) => (current === null ? current : null))
      }

      /** Recomputes the drop line from a viewport position. */
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

      /** Tears the drag down; commits the move when `commit` is true. */
      const finishDrag = (commit: boolean) => {
        const drag = dragRef.current
        const to = toRef.current // captured before the refs are cleared
        pendingRef.current = null
        dragRef.current = null
        toRef.current = null
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        document.body.classList.remove('note-dragging-active')
        setSourceRect(null)
        scrollerRef.current = null
        lastPointerRef.current = null
        setHoverRectFor(null)
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

      /** Turns a threshold-crossing press into a live drag. */
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
        // to its top edge. (Handle box = 22px buttons + 2×2px padding = 26px.)
        const top = el ? Math.max(1, Math.round(firstLineCenterY(el)) - 13) : hit.rect.top + 2
        const left = Math.max(EDGE, rect.left - 52)
        setHoverRectFor(el)
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
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('blur', onBlur)
      window.addEventListener('scroll', onScroll, true)

      detach = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
        document.removeEventListener('pointercancel', onPointerCancel)
        window.removeEventListener('keydown', onKeyDown)
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

  return (
    <>
      {hoverRect && !dragging && (
        <div
          className="note-block-hover-ovl"
          style={{
            top: hoverRect.top,
            left: hoverRect.left,
            width: hoverRect.width,
            height: hoverRect.height,
          }}
          aria-hidden="true"
        />
      )}
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
      {hover && (
        <div
          className={dragging ? 'note-block-handle is-dragging' : 'note-block-handle'}
          style={{ top: hover.top, left: hover.left }}
          role="toolbar"
          aria-label="Block actions"
        >
          <button
            type="button"
            title="Add block below"
            aria-label="Add block below"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertSlashBelow(editor, hover.index)}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Drag to move this block"
            aria-label="Move this block"
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
                index: hover.index,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
              }
            }}
          >
            <GripVertical className="h-3.5 w-3.5" strokeWidth={2} />
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
          <GripVertical className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="note-drag-kind">{ghost.kind}</span>
          <span className="note-drag-ghost-text">{ghost.text}</span>
        </div>
      )}
    </>
  )
}
