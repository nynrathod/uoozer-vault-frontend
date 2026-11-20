import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Eraser,
  GripVertical,
  MoreHorizontal,
  Plus,
  Settings2,
  SquareDashedMousePointer,
  Trash2,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { useNoteEditor } from '../editor/NoteEditorProvider'
import { NOTE_SHADES } from '../editor/colors'
import {
  addColumnsAtEnd,
  addRowsAtEnd,
  clearColumnAt,
  clearRowAt,
  deleteColumnAt,
  deleteRowAt,
  deleteTableAt,
  duplicateColumnAt,
  duplicateRowAt,
  getTableOptions,
  getUniformColumnWidth,
  insertColumnsAt,
  insertRowsAt,
  isHeaderColumnAt,
  isHeaderRowAt,
  moveRowTo,
  selectColumnAt,
  selectRowAt,
  setColumnWidthAt,
  setRowHeightAt,
  setUniformColumnWidth,
  toggleHeaderColumnAt,
  toggleHeaderRowAt,
  updateTableOptions,
  type TableOptionsAttrs,
} from '../editor/nodes/UoozerTable'

/**
 * Liveness margin around the table, per side — just enough to keep the
 * on-border buttons (which straddle the table edge) alive while the pointer
 * reaches them. The chrome never lingers far OUTSIDE the table.
 */
const REGION = { top: 16, left: 16, right: 16, bottom: 16 }
/** Round button size (half of it overhangs the border it straddles). */
const BTN = 22
/** Grace period before the chrome hides after the pointer left the table. */
const HIDE_GRACE_MS = 220
/** Pointer travel before a press becomes a drag. */
const DRAG_THRESHOLD = 5
/** Px per extra column while drag-adding on the right rail. */
const ADD_COL_STEP = 72
/** Px per extra row while drag-adding on the bottom rail. */
const ADD_ROW_STEP = 30
/** Cap on rows/columns one drag can add. */
const ADD_MAX = 30
/** Column resize bounds. */
const MIN_COL_W = 64
/** Row resize bounds. */
const MIN_ROW_H = 33

/* ---- types ---------------------------------------------------------------- */

interface ColBox {
  left: number
  right: number
  width: number
}

interface RowBox {
  top: number
  bottom: number
  height: number
}

interface TableLayout {
  top: number
  left: number
  right: number
  bottom: number
  cols: ColBox[]
  rows: RowBox[]
  hasHeader: boolean
}

type MenuState =
  { kind: 'column'; index: number } | { kind: 'row'; index: number } | { kind: 'settings' } | null

interface AddDrag {
  axis: 'x' | 'y'
  count: number
  x: number
  y: number
}

interface ResizeDrag {
  kind: 'col' | 'row'
  index: number
  size: number
  pos: number
}

interface MoveDrag {
  from: number
  to: number
}

interface MenuItemDef {
  id: string
  label: string
  icon: LucideIcon
  shortcut?: string
  danger?: boolean
  sepBefore?: boolean
  run: () => void
}

/** Which column / row the pointer is currently over (−1 when on none). */
interface HoverZone {
  col: number
  row: number
}

/**
 * rev 7: maps the pointer to the column and the row it is over. The reach
 * margin matches the straddling on-border buttons, so hovering a button
 * keeps its own zone — a control under the pointer never unmounts.
 */
function zoneAt(t: TableLayout, x: number, y: number): HoverZone {
  const EDGE = 14
  const zone: HoverZone = { col: -1, row: -1 }
  if (t.cols.length && x >= t.left - EDGE && x <= t.right + EDGE) {
    const cx = Math.min(Math.max(x, t.cols[0].left + 1), t.cols[t.cols.length - 1].right - 1)
    zone.col = t.cols.findIndex((c) => cx >= c.left && cx <= c.right)
  }
  if (t.rows.length && y >= t.top - EDGE && y <= t.bottom + EDGE) {
    const cy = Math.min(Math.max(y, t.rows[0].top + 1), t.rows[t.rows.length - 1].bottom - 1)
    zone.row = t.rows.findIndex((r) => cy >= r.top && cy <= r.bottom)
  }
  return zone
}

/* ---- helpers --------------------------------------------------------------- */

function proseDom(editor: Editor): HTMLElement | null {
  if (editor.isDestroyed) return null
  try {
    return editor.view.dom
  } catch {
    return null // EditorContent has not mounted the view yet
  }
}

function measure(el: HTMLTableElement): TableLayout | null {
  const rect = el.getBoundingClientRect()
  const rows = el.rows
  if (!rows.length || !rows[0].cells.length) return null
  const hasHeader = rows[0].cells[0].tagName === 'TH'

  const cols: ColBox[] = []
  for (let col = 0; col < rows[0].cells.length; col += 1) {
    const cellRect = rows[0].cells[col].getBoundingClientRect()
    cols.push({ left: cellRect.left, right: cellRect.right, width: cellRect.width })
  }

  const rowBoxes: RowBox[] = []
  for (let row = 0; row < rows.length; row += 1) {
    const rowRect = rows[row].getBoundingClientRect()
    rowBoxes.push({ top: rowRect.top, bottom: rowRect.bottom, height: rowRect.height })
  }

  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    cols,
    rows: rowBoxes,
    hasHeader,
  }
}

function insideRegion(el: HTMLTableElement, x: number, y: number): boolean {
  const rect = el.getBoundingClientRect()
  return (
    x >= rect.left - REGION.left &&
    x <= rect.right + REGION.right &&
    y >= rect.top - REGION.top &&
    y <= rect.bottom + REGION.bottom
  )
}

function clampMenu(x: number, y: number, w: number, h: number) {
  return {
    left: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
    top: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
  }
}

/** Writes a live column-width preview: colgroup <col> when present, else cells. */
function previewColumnWidth(el: HTMLTableElement, index: number, width: number | null) {
  const value = width === null ? '' : `${width}px`
  const col = el.querySelectorAll(':scope > colgroup > col')[index]
  if (col instanceof HTMLElement) col.style.width = value
  for (const row of Array.from(el.rows)) {
    const cell = row.cells[index]
    if (cell) cell.style.width = value
  }
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const MOD = isMac ? '\u2318\u2325' : 'Ctrl+Alt+'

/* ---- settings presets ------------------------------------------------------ */

const ROW_HEIGHTS = [
  { label: 'Compact', value: 27 },
  { label: 'Default', value: null },
  { label: 'Tall', value: 46 },
] as const

const COL_WIDTHS = [
  { label: 'Narrow', value: 110 },
  { label: 'Default', value: null },
  { label: 'Wide', value: 190 },
] as const

const BORDER_WIDTHS = [
  { label: 'Hairline', value: null },
  { label: 'Medium', value: 2 },
  { label: 'Bold', value: 3 },
] as const

const RADII = [
  { label: 'None', value: 0 },
  { label: 'Small', value: null },
  { label: 'Medium', value: 10 },
] as const

/* ---- component ------------------------------------------------------------ */

export function TableHandles() {
  const editor = useNoteEditor()

  const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null)
  const [layout, setLayout] = useState<TableLayout | null>(null)
  const [menu, setMenu] = useState<MenuState>(null)
  const [addDrag, setAddDrag] = useState<AddDrag | null>(null)
  const [resizeDrag, setResizeDrag] = useState<ResizeDrag | null>(null)
  const [moveDrag, setMoveDrag] = useState<MoveDrag | null>(null)
  const [options, setOptions] = useState<TableOptionsAttrs | null>(null)
  const [headerRow, setHeaderRow] = useState(false)
  const [headerColumn, setHeaderColumn] = useState(false)
  const [uniformWidth, setUniformWidth] = useState<number | null>(null)
  /** Last pointer position while the chrome is alive; null when hidden. */
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  const tableRef = useRef<HTMLTableElement | null>(null)
  const layoutRef = useRef<TableLayout | null>(null)
  const menuRef = useRef<MenuState>(null)
  const editorRef = useRef<Editor | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const dragActiveRef = useRef(false)
  /** Cancels the in-flight drag (Escape / unmount) and drops its listeners. */
  const cancelDragRef = useRef<(() => void) | null>(null)

  menuRef.current = menu
  layoutRef.current = layout
  editorRef.current = editor

  /**
   * rev 6: the table element to run an op against, re-resolved at event time.
   * If the adopted element was replaced (attr patch re-rendered it), the
   * first live table is adopted instead — ops never run against detached
   * DOM, and the open menu survives the swap.
   */
  const currentTable = useCallback((): HTMLTableElement | null => {
    const attached = tableRef.current
    if (attached && document.body.contains(attached)) return attached
    const ed = editorRef.current
    const prose = ed && !ed.isDestroyed ? proseDom(ed) : null
    const first = prose?.querySelector('table')
    if (first instanceof HTMLTableElement) {
      tableRef.current = first
      setTableEl(first)
      return first
    }
    return null
  }, [])

  const scheduleRefresh = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      const el = tableRef.current
      if (!el || !document.body.contains(el)) {
        // Self-heal: the element was replaced (or never adopted) — re-adopt.
        currentTable()
        return
      }
      const next = measure(el)
      layoutRef.current = next
      setLayout(next)
    })
  }, [currentTable])

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const closeMenu = useCallback(() => {
    setMenu(null)
  }, [])

  const detachTable = useCallback(() => {
    cancelHide()
    tableRef.current = null
    layoutRef.current = null
    setTableEl(null)
    setLayout(null)
    setMenu(null)
    setPointer(null)
  }, [cancelHide])

  const adopt = useCallback(
    (el: HTMLTableElement, opts?: { keepMenu?: boolean }) => {
      cancelHide()
      tableRef.current = el
      setTableEl(el)
      if (!opts?.keepMenu) setMenu(null)
      scheduleRefresh()
    },
    [cancelHide, scheduleRefresh]
  )

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current !== null) return
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null
      detachTable()
    }, HIDE_GRACE_MS)
  }, [detachTable])

  /**
   * Runs one pointer drag on the window. `onEnd` receives whether the drag
   * finished normally or was cancelled (Escape, pointercancel, unmount).
   */
  const beginDrag = useCallback(
    (handlers: { onMove: (event: PointerEvent) => void; onEnd: (cancelled: boolean) => void }) => {
      dragActiveRef.current = true
      document.body.classList.add('note-table-select-lock')
      const move = (event: PointerEvent) => handlers.onMove(event)
      const finish = (cancelled: boolean) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', cancel)
        document.body.classList.remove('note-table-select-lock', 'note-table-busy', 'is-row-busy')
        dragActiveRef.current = false
        cancelDragRef.current = null
        handlers.onEnd(cancelled)
      }
      const up = () => finish(false)
      const cancel = () => finish(true)
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', cancel)
      cancelDragRef.current = () => finish(true)
    },
    []
  )

  /* ---- main effect: auto-adopt, hover tracking, menus, repositioning ------- */

  useEffect(() => {
    if (!editor) return
    // No (pointer: fine) gate: touch and coarse-pointer devices must get the
    // chrome too — a tap on the table fires pointermove and adopts it.

    /**
     * The chrome does not depend on pointer events to appear. Whatever table
     * already exists in the document is adopted immediately and re-checked on
     * every editor transaction. When the previous element was REPLACED (an
     * attr patch re-rendered it), the swap keeps the menu and hover state
     * alive so the settings panel never closes between two toggles.
     */
    const ensureAdopted = () => {
      try {
        const current = tableRef.current
        if (current && document.body.contains(current)) return
        const prose = proseDom(editor)
        if (!prose) {
          if (current) detachTable()
          return
        }
        const first = prose.querySelector('table')
        if (first instanceof HTMLTableElement) {
          if (current) {
            // The element was swapped under us: same logical table, keep UI.
            tableRef.current = first
            setTableEl(first)
            scheduleRefresh()
            return
          }
          adopt(first)
          return
        }
        if (current) detachTable()
      } catch {
        /* a failed scan must never kill the listeners */
      }
    }

    const onMove = (event: PointerEvent) => {
      if (dragActiveRef.current) return
      const target = event.target instanceof Element ? event.target : null
      // While a menu is open the chrome stays anchored until closed.
      if (menuRef.current) {
        cancelHide()
        return
      }
      // The pointer is over our own chrome: stay alive. Zones recompute from
      // the new position — every button now sits inside its zone, so the
      // control under the pointer never unmounts.
      if (target?.closest('[data-table-ui]')) {
        cancelHide()
        setPointer({ x: event.clientX, y: event.clientY })
        scheduleRefresh()
        return
      }
      const prose = proseDom(editor)
      if (!prose) return
      const hovered = target?.closest('table')
      if (hovered instanceof HTMLTableElement && prose.contains(hovered)) {
        if (tableRef.current !== hovered) adopt(hovered)
        else cancelHide()
        setPointer({ x: event.clientX, y: event.clientY })
        scheduleRefresh()
        return
      }
      const el = tableRef.current
      if (el && document.body.contains(el) && insideRegion(el, event.clientX, event.clientY)) {
        cancelHide()
        setPointer({ x: event.clientX, y: event.clientY })
        scheduleRefresh()
        return
      }
      scheduleHide()
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('[data-table-ui]')) return
      if (menuRef.current) closeMenu()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (cancelDragRef.current) {
        cancelDragRef.current()
        return
      }
      if (menuRef.current) closeMenu()
    }

    const onReflow = () => {
      ensureAdopted()
      scheduleRefresh()
    }

    // Capture phase — no intermediate stopPropagation() can block us.
    window.addEventListener('pointermove', onMove, { passive: true, capture: true })
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onReflow, { capture: true, passive: true })
    window.addEventListener('resize', onReflow)
    editor.on('transaction', onReflow)
    editor.on('destroy', detachTable)

    // Adopt whatever table already exists, then retry through the first
    // seconds of the note's life to win mount races.
    const retryTimers = [0, 250, 1000, 3000].map((ms) => window.setTimeout(ensureAdopted, ms))

    return () => {
      retryTimers.forEach((t) => window.clearTimeout(t))
      window.removeEventListener('pointermove', onMove, { capture: true } as EventListenerOptions)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onReflow, { capture: true } as EventListenerOptions)
      window.removeEventListener('resize', onReflow)
      editor.off('transaction', onReflow)
      editor.off('destroy', detachTable)
      cancelDragRef.current?.()
      cancelHide()
      detachTable()
    }
  }, [editor, adopt, cancelHide, closeMenu, detachTable, scheduleHide, scheduleRefresh])

  /* ---- drag handlers -------------------------------------------------------- */

  /** Edge rails: click adds one, dragging outward adds several. */
  const startRailAdd = (event: ReactPointerEvent, axis: 'x' | 'y') => {
    if (event.button !== 0) return
    event.preventDefault()
    if (!editor) return
    const el = currentTable()
    if (!el) return
    const start = axis === 'x' ? event.clientX : event.clientY
    const step = axis === 'x' ? ADD_COL_STEP : ADD_ROW_STEP
    let count = 0
    beginDrag({
      onMove: (e) => {
        const distance = (axis === 'x' ? e.clientX : e.clientY) - start
        count = Math.max(0, Math.min(ADD_MAX, Math.round(distance / step)))
        setAddDrag({ axis, count, x: e.clientX, y: e.clientY })
      },
      onEnd: (cancelled) => {
        setAddDrag(null)
        if (cancelled) return
        const target = currentTable()
        if (!target || !editor || editor.isDestroyed) return
        const n = Math.max(1, count)
        if (axis === 'x') addColumnsAtEnd(editor, target, n)
        else addRowsAtEnd(editor, target, n)
      },
    })
  }

  /**
   * rev 7: column resize strip — the whole column border, full table height.
   * Dragging horizontally sets the column width. A plain click does NOTHING:
   * inserting lives in the column menu, so grabbing the border can never add
   * a column by accident.
   */
  const startColResize = (event: ReactPointerEvent, index: number) => {
    if (event.button !== 0) return
    event.preventDefault()
    const el = currentTable()
    if (!el || !editor) return
    const startX = event.clientX
    const startW = layoutRef.current?.cols[index]?.width ?? 160
    let size = startW
    let dragging = false
    beginDrag({
      onMove: (e) => {
        if (!dragging) {
          if (Math.abs(e.clientX - startX) < DRAG_THRESHOLD) return
          dragging = true
          document.body.classList.add('note-table-busy')
        }
        size = Math.max(MIN_COL_W, startW + (e.clientX - startX))
        previewColumnWidth(el, index, size)
        setResizeDrag({ kind: 'col', index, size, pos: e.clientX })
      },
      onEnd: (cancelled) => {
        setResizeDrag(null)
        previewColumnWidth(el, index, null)
        if (cancelled) return
        const target = currentTable()
        if (!target || editor.isDestroyed || !dragging) return
        setColumnWidthAt(editor, target, index, size)
        scheduleRefresh()
      },
    })
  }

  /**
   * rev 7: row resize strip — the whole row border, full table width.
   * Dragging vertically sets the row height; a plain click does nothing.
   */
  const startRowResize = (event: ReactPointerEvent, index: number) => {
    if (event.button !== 0) return
    event.preventDefault()
    const el = currentTable()
    if (!el || !editor) return
    const startY = event.clientY
    const startH = layoutRef.current?.rows[index]?.height ?? 33
    let size = startH
    let dragging = false
    const apply = (h: number) => {
      const row = el.rows[index]
      if (row) row.style.height = `${h}px`
    }
    const reset = () => {
      const row = el.rows[index]
      if (row) row.style.height = ''
    }
    beginDrag({
      onMove: (e) => {
        if (!dragging) {
          if (Math.abs(e.clientY - startY) < DRAG_THRESHOLD) return
          dragging = true
          document.body.classList.add('note-table-busy', 'is-row-busy')
        }
        size = Math.max(MIN_ROW_H, startH + (e.clientY - startY))
        apply(size)
        setResizeDrag({ kind: 'row', index, size, pos: e.clientY })
      },
      onEnd: (cancelled) => {
        setResizeDrag(null)
        reset()
        if (cancelled) return
        const target = currentTable()
        if (!target || editor.isDestroyed || !dragging) return
        setRowHeightAt(editor, target, index, size)
        scheduleRefresh()
      },
    })
  }

  /** Row grip: a plain click opens the row menu, a drag reorders the row. */
  const startRowGrip = (event: ReactPointerEvent, index: number) => {
    if (event.button !== 0) return
    event.preventDefault()
    const el = currentTable()
    if (!el) return
    const startY = event.clientY
    let dragging = false
    let slot = index
    beginDrag({
      onMove: (e) => {
        const wasDragging = dragging
        if (!dragging) {
          if (Math.abs(e.clientY - startY) < DRAG_THRESHOLD) return
          dragging = true
        }
        let s = el.rows.length
        for (let i = 0; i < el.rows.length; i += 1) {
          if (e.clientY < el.rows[i].getBoundingClientRect().top) {
            s = i
            break
          }
        }
        if (s !== slot || !wasDragging) {
          slot = s
          setMoveDrag({ from: index, to: slot })
        }
      },
      onEnd: (cancelled) => {
        const wasDragging = dragging
        setMoveDrag(null)
        if (cancelled) return
        if (!wasDragging) {
          setMenu({ kind: 'row', index })
          return
        }
        const to = slot > index ? slot - 1 : slot
        const target = currentTable()
        if (to !== index && target && editor && !editor.isDestroyed) {
          moveRowTo(editor, target, index, to)
        }
      },
    })
  }

  /* ---- settings panel -------------------------------------------------------- */

  const openSettings = () => {
    const el = currentTable()
    if (!editor || !el) return
    setOptions(getTableOptions(editor, el))
    setHeaderRow(isHeaderRowAt(editor, el))
    setHeaderColumn(isHeaderColumnAt(editor, el, 0))
    setUniformWidth(getUniformColumnWidth(editor, el))
    setMenu({ kind: 'settings' })
  }

  const patchOptions = (patch: Partial<TableOptionsAttrs>) => {
    const el = currentTable()
    if (!editor || !el) return
    if (updateTableOptions(editor, el, patch)) {
      setOptions((current) => (current ? { ...current, ...patch } : current))
    }
  }

  const flipHeaderRow = () => {
    const el = currentTable()
    if (!editor || !el) return
    toggleHeaderRowAt(editor, el)
    setHeaderRow(isHeaderRowAt(editor, el))
  }

  const flipHeaderColumn = () => {
    const el = currentTable()
    if (!editor || !el) return
    toggleHeaderColumnAt(editor, el, 0)
    setHeaderColumn(isHeaderColumnAt(editor, el, 0))
  }

  const applyUniformWidth = (value: number | null) => {
    const el = currentTable()
    if (!editor || !el) return
    if (setUniformColumnWidth(editor, el, value)) setUniformWidth(value)
  }

  /* ---- render ---------------------------------------------------------------- */

  if (!editor || !tableEl || !layout) return null

  const { top, left, right, bottom, cols, rows } = layout
  const vw = window.innerWidth

  const zone = pointer ? zoneAt(layout, pointer.x, pointer.y) : { col: -1, row: -1 }
  const busy = Boolean(resizeDrag || moveDrag || addDrag)
  // rev 7: the chrome stays mounted while the pointer is over the table (or
  // over its own controls, or a menu is open, or a drag is in flight) — and
  // it disappears as soon as the pointer leaves the table for good.
  const showChrome = Boolean(pointer || menu || busy)
  if (!showChrome) return null

  // Hovered column / row crosshair (portal overlays — the visual the user
  // sees while moving across the grid, one column and one row at a time,
  // never touching ProseMirror DOM).
  const hoverCol =
    pointer &&
    pointer.x >= cols[0].left &&
    pointer.x <= cols[cols.length - 1].right &&
    pointer.y >= top - 4 &&
    pointer.y <= bottom + 4
      ? cols.findIndex((c) => pointer.x >= c.left && pointer.x <= c.right)
      : -1
  const hoverRow =
    pointer &&
    pointer.y >= rows[0].top &&
    pointer.y <= rows[rows.length - 1].bottom &&
    pointer.x >= left - 4 &&
    pointer.x <= right + 4
      ? rows.findIndex((r) => pointer.y >= r.top && pointer.y <= r.bottom)
      : -1

  const runThenClose = (run: () => void) => () => {
    run()
    setMenu(null)
  }

  const columnMenuIndex = menu?.kind === 'column' ? menu.index : -1

  const columnMenu =
    menu?.kind === 'column'
      ? clampMenu(
          (cols[menu.index].left + cols[menu.index].right) / 2 - 10,
          top + BTN / 2 + 4,
          208,
          262
        )
      : null

  const columnItems: MenuItemDef[] =
    menu?.kind === 'column'
      ? [
          {
            id: 'insert-left',
            label: 'Insert left',
            icon: ArrowLeft,
            shortcut: `${MOD}\u2190`,
            run: () => {
              const el = currentTable()
              if (el && !editor.isDestroyed) insertColumnsAt(editor, el, columnMenuIndex, 1)
            },
          },
          {
            id: 'insert-right',
            label: 'Insert right',
            icon: ArrowRight,
            shortcut: `${MOD}\u2192`,
            run: () => {
              const el = currentTable()
              if (el && !editor.isDestroyed) insertColumnsAt(editor, el, columnMenuIndex + 1, 1)
            },
          },
          {
            id: 'duplicate',
            label: 'Duplicate',
            icon: Copy,
            run: () => {
              const el = currentTable()
              if (el && !editor.isDestroyed) duplicateColumnAt(editor, el, columnMenuIndex)
            },
          },
          {
            id: 'select-col',
            label: 'Select column',
            icon: SquareDashedMousePointer,
            run: () => {
              const el = currentTable()
              if (el && !editor.isDestroyed) selectColumnAt(editor, el, columnMenuIndex)
            },
          },
          {
            id: 'clear',
            label: 'Clear contents',
            icon: Eraser,
            run: () => {
              const el = currentTable()
              if (el && !editor.isDestroyed) clearColumnAt(editor, el, columnMenuIndex)
            },
          },
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            danger: true,
            sepBefore: true,
            run: () => {
              const el = currentTable()
              if (!el || editor.isDestroyed) return
              if (cols.length <= 1) deleteTableAt(editor, el)
              else deleteColumnAt(editor, el, columnMenuIndex)
            },
          },
        ]
      : []

  const rowMenuIndex = menu?.kind === 'row' ? menu.index : -1

  const rowMenu =
    menu?.kind === 'row' ? clampMenu(left + BTN / 2 + 4, rows[menu.index].top - 4, 208, 262) : null

  const rowItems: MenuItemDef[] =
    menu?.kind === 'row'
      ? [
          {
            id: 'insert-above',
            label: 'Insert above',
            icon: ArrowUp,
            shortcut: `${MOD}\u2191`,
            run: () => {
              const el = currentTable()
              if (el && !editor.isDestroyed) insertRowsAt(editor, el, rowMenuIndex, 1)
            },
          },
          {
            id: 'insert-below',
            label: 'Insert below',
            icon: ArrowDown,
            shortcut: `${MOD}\u2193`,
            run: () => {
              const el = currentTable()
              if (el && !editor.isDestroyed) insertRowsAt(editor, el, rowMenuIndex + 1, 1)
            },
          },
          {
            id: 'duplicate',
            label: 'Duplicate',
            icon: Copy,
            run: () => {
              const el = currentTable()
              if (el && !editor.isDestroyed) duplicateRowAt(editor, el, rowMenuIndex)
            },
          },
          {
            id: 'select-row',
            label: 'Select row',
            icon: SquareDashedMousePointer,
            run: () => {
              const el = currentTable()
              if (el && !editor.isDestroyed) selectRowAt(editor, el, rowMenuIndex)
            },
          },
          {
            id: 'clear',
            label: 'Clear contents',
            icon: Eraser,
            run: () => {
              const el = currentTable()
              if (el && !editor.isDestroyed) clearRowAt(editor, el, rowMenuIndex)
            },
          },
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            danger: true,
            sepBefore: true,
            run: () => {
              const el = currentTable()
              if (!el || editor.isDestroyed) return
              if (rows.length <= 1) deleteTableAt(editor, el)
              else deleteRowAt(editor, el, rowMenuIndex)
            },
          },
        ]
      : []

  const settingsPos =
    menu?.kind === 'settings' ? clampMenu(right - 218, top + BTN / 2 + 4, 240, 470) : null

  return createPortal(
    <div data-table-ui data-chrome-rev="7" className="note-table-ui">
      {/* Hovered column + hovered row highlights (portal overlays). */}
      {hoverCol >= 0 && hoverCol < cols.length && (
        <div
          className="note-table-hl is-col"
          style={{
            left: cols[hoverCol].left,
            top,
            width: cols[hoverCol].width,
            height: bottom - top,
          }}
        />
      )}
      {hoverRow >= 0 && hoverRow < rows.length && (
        <div
          className="note-table-hl is-row"
          style={{
            left: left - 2,
            top: rows[hoverRow].top,
            width: right - left + 4,
            height: rows[hoverRow].height,
          }}
        />
      )}

      {/* Full-length resize strips (rev 7): every column border runs the
          whole table height, every row border the whole table width. Grab
          the line ANYWHERE to resize; a plain click does nothing. */}
      {cols.map((col, index) => (
        <div
          key={`col-resize-${index}`}
          className="note-table-resize"
          style={{ left: col.right - 5, top: top - 4, width: 10, height: bottom - top + 8 }}
          onPointerDown={(event) => startColResize(event, index)}
        />
      ))}
      {rows.map((row, index) => (
        <div
          key={`row-resize-${index}`}
          className="note-table-resize is-row"
          style={{ left: left - 4, top: row.bottom - 5, width: right - left + 8, height: 10 }}
          onPointerDown={(event) => startRowResize(event, index)}
        />
      ))}

      {/* Column options: the 3-dot button sits centered ON the top border
          line of the hovered column — never floating above the table. */}
      {zone.col >= 0 && !busy && (
        <button
          type="button"
          className={cn(
            'note-table-add is-dots',
            menu?.kind === 'column' && menu.index === zone.col && 'is-open'
          )}
          style={{
            left: (cols[zone.col].left + cols[zone.col].right) / 2 - BTN / 2,
            top: top - BTN / 2,
          }}
          title="Column options"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() =>
            setMenu(
              menu?.kind === 'column' && menu.index === zone.col
                ? null
                : { kind: 'column', index: zone.col }
            )
          }
        >
          <MoreHorizontal size={14} strokeWidth={2.25} />
        </button>
      )}

      {/* Row options: the grip sits centered ON the left border line of the
          hovered row — never floating left of the table. Click opens the
          row menu, dragging reorders the row. */}
      {zone.row >= 0 && !busy && (
        <button
          type="button"
          className={cn(
            'note-table-grip',
            menu?.kind === 'row' && menu.index === zone.row && 'is-open'
          )}
          style={{
            left: left - BTN / 2,
            top: (rows[zone.row].top + rows[zone.row].bottom) / 2 - 11,
          }}
          title="Row options (drag to move)"
          onPointerDown={(event) => startRowGrip(event, zone.row)}
        >
          <GripVertical size={13} strokeWidth={2} />
        </button>
      )}

      {/* Add controls ON the borders: drag outward to add several. */}
      <button
        type="button"
        className="note-table-add is-rail"
        style={{ left: right - BTN / 2, top: (top + bottom) / 2 - BTN / 2 }}
        title="Add a column (drag to add several)"
        onPointerDown={(event) => startRailAdd(event, 'x')}
      >
        <Plus size={14} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className="note-table-add is-rail"
        style={{ left: (left + right) / 2 - BTN / 2, top: bottom - BTN / 2 }}
        title="Add a row (drag to add several)"
        onPointerDown={(event) => startRailAdd(event, 'y')}
      >
        <Plus size={14} strokeWidth={2.25} />
      </button>

      {/* Table options gear: ON the top-right corner of the table. */}
      <button
        type="button"
        className={cn('note-table-add is-gear', menu?.kind === 'settings' && 'is-open')}
        style={{ left: Math.min(right, vw - 30) - BTN / 2, top: top - BTN / 2 }}
        title="Table options"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => (menu?.kind === 'settings' ? setMenu(null) : openSettings())}
      >
        <Settings2 size={13} strokeWidth={2} />
      </button>

      {/* Ghost cells previewing what a rail drag will add. */}
      {addDrag && addDrag.count > 0 && addDrag.axis === 'x' && (
        <div
          className="note-table-ghost is-cols"
          style={{ left: right + 8, top, height: bottom - top }}
        >
          {Array.from({ length: addDrag.count }, (_, i) => (
            <span key={i} className="note-table-ghost-cell is-col" />
          ))}
        </div>
      )}
      {addDrag && addDrag.count > 0 && addDrag.axis === 'y' && (
        <div
          className="note-table-ghost is-rows"
          style={{ left, top: bottom + 8, width: right - left }}
        >
          {Array.from({ length: addDrag.count }, (_, i) => (
            <span key={i} className="note-table-ghost-cell is-row" />
          ))}
        </div>
      )}

      {/* Live guide lines while resizing or reordering. */}
      {resizeDrag?.kind === 'col' && (
        <div
          className="note-table-resize-line"
          style={{ left: resizeDrag.pos - 1, top: top - 4, height: bottom - top + 8 }}
        />
      )}
      {resizeDrag?.kind === 'row' && (
        <div
          className="note-table-resize-line is-row"
          style={{ top: resizeDrag.pos - 1, left: left - 4, width: right - left + 8 }}
        />
      )}
      {moveDrag && rows[moveDrag.from] && (
        <>
          {/* Dragged row dims via overlay — never a class on PM cells. */}
          <div
            className="note-table-dim"
            style={{
              left,
              top: rows[moveDrag.from].top,
              width: right - left,
              height: rows[moveDrag.from].height,
            }}
          />
          <div
            className="note-table-move-line is-row"
            style={{
              top:
                (moveDrag.to === 0
                  ? rows[0].top
                  : moveDrag.to >= rows.length
                    ? rows[rows.length - 1].bottom
                    : rows[moveDrag.to].top) - 1.5,
              left: left - 6,
              width: right - left + 12,
            }}
          />
        </>
      )}

      {/* Counter badge while drag-adding. */}
      {addDrag && addDrag.count > 0 && (
        <div
          className="note-table-tip"
          style={{ left: Math.min(addDrag.x + 14, vw - 120), top: addDrag.y + 18 }}
        >
          +{addDrag.count}{' '}
          {addDrag.axis === 'x'
            ? addDrag.count === 1
              ? 'column'
              : 'columns'
            : addDrag.count === 1
              ? 'row'
              : 'rows'}
        </div>
      )}

      {/* Column menu. */}
      {columnMenu && (
        <div
          className="note-table-menu"
          style={{ ...columnMenu, width: 208 }}
          onMouseDown={(event) => event.preventDefault()}
        >
          {columnItems.map((item) => (
            <MenuRow key={item.id} item={item} onPick={runThenClose(item.run)} />
          ))}
        </div>
      )}

      {/* Row menu. */}
      {rowMenu && (
        <div
          className="note-table-menu"
          style={{ ...rowMenu, width: 208 }}
          onMouseDown={(event) => event.preventDefault()}
        >
          {rowItems.map((item) => (
            <MenuRow key={item.id} item={item} onPick={runThenClose(item.run)} />
          ))}
        </div>
      )}

      {/* Table options panel. */}
      {settingsPos && options && (
        <div
          className="note-table-menu note-table-menu--settings"
          style={settingsPos}
          onMouseDown={(event) => event.preventDefault()}
        >
          <div className="note-table-menu-group">Table</div>
          <ToggleRow label="Header row" on={headerRow} onClick={flipHeaderRow} />
          <ToggleRow label="Header first column" on={headerColumn} onClick={flipHeaderColumn} />
          <ToggleRow
            label="Zebra rows"
            on={options.zebra}
            onClick={() => patchOptions({ zebra: !options.zebra })}
          />

          <div className="note-table-menu-group">Border</div>
          <Segmented
            options={BORDER_WIDTHS}
            active={(value) => (options.borderWidth ?? null) === value}
            onPick={(value) => patchOptions({ borderWidth: value })}
          />
          <div className="note-table-swatch-grid" style={{ padding: '4px 8px 6px' }}>
            <button
              type="button"
              title="Theme border color"
              className={cn(
                'note-table-swatch is-default',
                options.borderColor === null && 'is-active'
              )}
              onClick={() => patchOptions({ borderColor: null })}
            />
            {NOTE_SHADES.map((shade) => (
              <button
                key={shade.name}
                type="button"
                title={shade.label}
                className={cn(
                  'note-table-swatch',
                  `note-swatch-bg-${shade.name}`,
                  options.borderColor === shade.name && 'is-active'
                )}
                onClick={() => patchOptions({ borderColor: shade.name })}
              />
            ))}
          </div>

          <div className="note-table-menu-group">Corners</div>
          <Segmented
            options={RADII}
            active={(value) => (options.radius ?? null) === value}
            onPick={(value) => patchOptions({ radius: value })}
          />

          <div className="note-table-menu-group">Row height</div>
          <Segmented
            options={ROW_HEIGHTS}
            active={(value) => (options.rowHeight ?? null) === value}
            onPick={(value) => patchOptions({ rowHeight: value })}
          />

          <div className="note-table-menu-group">Column width</div>
          <Segmented
            options={COL_WIDTHS}
            active={(value) => (uniformWidth ?? null) === value}
            onPick={(value) => applyUniformWidth(value)}
          />

          <div className="note-table-menu-sep" />
          <MenuRow
            item={{
              id: 'delete-table',
              label: 'Delete table',
              icon: Trash2,
              danger: true,
              run: () => {},
            }}
            onPick={runThenClose(() => {
              const el = currentTable()
              if (el && !editor.isDestroyed) deleteTableAt(editor, el)
            })}
          />
        </div>
      )}
    </div>,
    document.body
  )
}

/* ---- small presentational helpers ------------------------------------------ */

function MenuRow({ item, onPick }: { item: MenuItemDef; onPick: () => void }) {
  const Icon = item.icon
  return (
    <>
      {item.sepBefore && <div className="note-table-menu-sep" />}
      <button
        type="button"
        className={cn('note-table-menu-item', item.danger && 'is-danger')}
        onClick={onPick}
      >
        <Icon size={15} />
        <span className="note-table-menu-label">{item.label}</span>
        {item.shortcut && <span className="note-table-menu-shortcut">{item.shortcut}</span>}
      </button>
    </>
  )
}

function ToggleRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="note-table-menu-row" onClick={onClick}>
      <span className="note-table-menu-label">{label}</span>
      <span className={cn('note-table-switch', on && 'is-on')}>
        <span className="note-table-switch-knob" />
      </span>
    </button>
  )
}

function Segmented({
  options,
  active,
  onPick,
}: {
  options: readonly { label: string; value: number | null }[]
  active: (value: number | null) => boolean
  onPick: (value: number | null) => void
}) {
  return (
    <div className="note-table-seg-row">
      <div className="note-table-seg">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            className={cn('note-table-seg-btn', active(option.value) && 'is-active')}
            onClick={() => onPick(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
