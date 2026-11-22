import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import type { Node as PMNode } from '@tiptap/pm/model'
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react'

type CellShade =
  'default' | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'

const CELL_COLORS: { name: string; shade: CellShade }[] = [
  { name: 'Default', shade: 'default' },
  { name: 'Gray', shade: 'gray' },
  { name: 'Brown', shade: 'brown' },
  { name: 'Orange', shade: 'orange' },
  { name: 'Yellow', shade: 'yellow' },
  { name: 'Green', shade: 'green' },
  { name: 'Blue', shade: 'blue' },
  { name: 'Purple', shade: 'purple' },
  { name: 'Pink', shade: 'pink' },
  { name: 'Red', shade: 'red' },
]

const DRAG_ROW_STEP = 28 // px of bottom-bar drag per row
const DRAG_COL_STEP = 44 // px of right-strip drag per column
const GRIP_MOVE_THRESHOLD = 4 // px before a grip press becomes a drag (spec: 4px)
const HOVER_GRACE_MS = 160 // grace after leaving the wrapper before chrome hides
/* The grip pair: ⠿ above ＋ (row) / ⠿ left of ＋ (column). The values keep
   the 18px grip, a 4px gap and an 18px ＋ — 40px of chrome per axis. */
const GRIP_SIZE = 18
const GRIP_GAP = 4
const GRIP_PAIR_SPAN = GRIP_SIZE * 2 + GRIP_GAP

const MIN_COL_WIDTH = 40 // px floor for scaled/resized columns
const MAX_COL_WIDTH = 1200 // px ceiling for a hand-widened column

/* ── glyphs: Notion's minimal icon set (all 1.5px strokes, 12px box) ────── */
function GripGlyph() {
  return (
    <svg width="8" height="12" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="2.5" r="1.35" />
      <circle cx="7.5" cy="2.5" r="1.35" />
      <circle cx="2.5" cy="7" r="1.35" />
      <circle cx="7.5" cy="7" r="1.35" />
      <circle cx="2.5" cy="11.5" r="1.35" />
      <circle cx="7.5" cy="11.5" r="1.35" />
    </svg>
  )
}

function PlusGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/* Menu config icons — every row of every table menu has one, like Notion. */
const MENU_ICON_ATTRS = {
  width: 13,
  height: 13,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}
function IconRowAbove() {
  return (
    <svg {...MENU_ICON_ATTRS}>
      <path d="M12 17V7M7 12l5-5 5 5" />
    </svg>
  )
}
function IconRowBelow() {
  return (
    <svg {...MENU_ICON_ATTRS}>
      <path d="M12 7v10M7 12l5 5 5-5" />
    </svg>
  )
}
function IconColLeft() {
  return (
    <svg {...MENU_ICON_ATTRS}>
      <path d="M17 12H7M12 7l-5 5 5 5" />
    </svg>
  )
}
function IconColRight() {
  return (
    <svg {...MENU_ICON_ATTRS}>
      <path d="M7 12h10M12 7l5 5-5 5" />
    </svg>
  )
}
function IconDuplicate() {
  return (
    <svg {...MENU_ICON_ATTRS}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  )
}
function IconPalette() {
  return (
    <svg {...MENU_ICON_ATTRS}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17" />
    </svg>
  )
}
function IconTrash() {
  return (
    <svg {...MENU_ICON_ATTRS}>
      <path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12" />
    </svg>
  )
}
function IconHeaderRow() {
  return (
    <svg {...MENU_ICON_ATTRS}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16" />
    </svg>
  )
}
function IconHeaderCol() {
  return (
    <svg {...MENU_ICON_ATTRS}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M10 5v14" />
    </svg>
  )
}
function IconCheck({ className }: { className?: string }) {
  return (
    <svg {...MENU_ICON_ATTRS} strokeWidth={2.2} className={className}>
      <path d="M5 12.5 10 17.5 19 6.5" />
    </svg>
  )
}

/* ── table-scoped transaction helpers ───────────────────────────────────── */

function tableAt(editor: Editor, pos: number): PMNode | null {
  try {
    const node = editor.state.doc.nodeAt(pos)
    return node && node.type.name === 'table' ? node : null
  } catch {
    return null
  }
}

/** Builds one empty cell matching `model`'s SHAPE but always untinted:
 *  new cells never inherit a row/column color (Notion). `keepType` keeps
 *  the source cell type (header column preserved); `bodyType` forces a
 *  plain body cell (new rows below a header row). The cell KEEPS the
 *  model's colwidth, so adding a column or row never re-flows the table —
 *  every existing column stays exactly the size the user set. */
function blankCellLike(model: PMNode, editor: Editor, keepType: boolean): PMNode | null {
  const paragraph = editor.state.schema.nodes.paragraph
  if (!paragraph) return null
  const type = keepType ? model.type : editor.state.schema.nodes.tableCell
  if (!type) return null
  return type.create({ ...model.attrs, background: null }, [paragraph.create()])
}

/** Sets a cell bg SHADE on every cell of one row / column / the whole table.
 *  The shade name is stored in `background`; notes.css maps it to the
 *  theme token (`--note-cellbg-*`). `null` clears the tint. */
export function setCellsBackground(
  editor: Editor,
  pos: number,
  scope: 'table' | { row: number } | { col: number },
  color: string | null
): boolean {
  const table = tableAt(editor, pos)
  if (!table) return false
  const tr = editor.state.tr
  let offset = pos + 1
  table.forEach((row, rowOffset, rowIndex) => {
    row.forEach((cell, cellOffset, colIndex) => {
      const match =
        scope === 'table' ||
        ('row' in scope && scope.row === rowIndex) ||
        ('col' in scope && scope.col === colIndex)
      if (!match) return
      tr.setNodeMarkup(offset + rowOffset + cellOffset + 1, undefined, {
        ...cell.attrs,
        background: color,
      })
    })
  })
  editor.view.dispatch(tr)
  return true
}

function isHeaderRow(table: PMNode): boolean {
  return table.childCount > 0 && table.child(0).firstChild?.type.name === 'tableHeader'
}

/** Header COLUMN: the first cell of EVERY row is a header cell. */
function isHeaderColumn(table: PMNode): boolean {
  if (table.childCount === 0) return false
  let all = true
  table.forEach((row) => {
    if (row.firstChild?.type.name !== 'tableHeader') all = false
  })
  return all
}

/** Header ↔ body for the whole first row. */
export function toggleHeaderRow(editor: Editor, pos: number): boolean {
  const table = tableAt(editor, pos)
  const rowType = editor.state.schema.nodes.tableRow
  const bodyType = editor.state.schema.nodes.tableCell
  const headType = editor.state.schema.nodes.tableHeader
  if (!table || !rowType || !bodyType || !headType || table.childCount === 0) return false
  const firstRow = table.child(0)
  const toHeader = !isHeaderRow(table)
  const cells: PMNode[] = []
  firstRow.forEach((cell) => {
    const type = toHeader ? headType : bodyType
    cells.push(type.create({ ...cell.attrs, colspan: 1, rowspan: 1 }, cell.content))
  })
  const nextRow = rowType.create(firstRow.attrs, cells)
  editor.view.dispatch(editor.state.tr.replaceWith(pos + 1, pos + 1 + firstRow.nodeSize, nextRow))
  return true
}

/** Header ↔ body for the whole first column. */
export function toggleHeaderColumn(editor: Editor, pos: number): boolean {
  const table = tableAt(editor, pos)
  const bodyType = editor.state.schema.nodes.tableCell
  const headType = editor.state.schema.nodes.tableHeader
  if (!table || !bodyType || !headType || table.childCount === 0) return false
  const toHeader = !isHeaderColumn(table)
  const tr = editor.state.tr
  let offset = pos + 1
  table.forEach((row, rowOffset) => {
    row.forEach((cell, cellOffset, colIndex) => {
      if (colIndex === 0) {
        const type = toHeader ? headType : bodyType
        tr.setNodeMarkup(offset + rowOffset + cellOffset + 1, type, {
          ...cell.attrs,
          colspan: 1,
          rowspan: 1,
        })
      }
    })
  })
  editor.view.dispatch(tr)
  return true
}

/** A new row: same column structure, always UNTINTED cells, and when it is
 *  inserted next to the header row it is a plain body row (Notion keeps
 *  exactly one header row at the top). Rows are appended at the BOTTOM by
 *  the ＋ bar; the row grip's ＋ inserts directly below its own row. */
export function insertRowNear(
  editor: Editor,
  pos: number,
  rowIndex: number,
  below: boolean
): boolean {
  const table = tableAt(editor, pos)
  if (!table || table.childCount === 0) return false
  const index = Math.min(Math.max(rowIndex, 0), table.childCount - 1)
  const model = table.child(index)
  const rowType = editor.state.schema.nodes.tableRow
  if (!rowType) return false
  const sourceIsHeader = isHeaderRow(table) && index === 0
  const cells: PMNode[] = []
  model.forEach((cell) => {
    const made = blankCellLike(cell, editor, !sourceIsHeader)
    if (made) cells.push(made)
  })
  const made = rowType.create(model.attrs, cells)
  if (!made) return false
  let insertAt = pos + 1
  const before = below ? index + 1 : index
  for (let i = 0; i < before; i += 1) insertAt += table.child(i).nodeSize
  editor.view.dispatch(editor.state.tr.insert(insertAt, made))
  return true
}

/** Duplicate — structure, tint AND content, like Notion. */
export function duplicateRow(editor: Editor, pos: number, rowIndex: number): boolean {
  const table = tableAt(editor, pos)
  if (!table || rowIndex < 0 || rowIndex >= table.childCount) return false
  const source = table.child(rowIndex)
  const rowType = editor.state.schema.nodes.tableRow
  if (!rowType) return false
  const cells: PMNode[] = []
  source.forEach((cell) => {
    cells.push(cell.type.create({ ...cell.attrs }, cell.content))
  })
  const copy = rowType.create(source.attrs, cells)
  let insertAt = pos + 1
  for (let i = 0; i <= rowIndex; i += 1) insertAt += table.child(i).nodeSize
  editor.view.dispatch(editor.state.tr.insert(insertAt, copy))
  return true
}

export function deleteRow(editor: Editor, pos: number, rowIndex: number): boolean {
  const table = tableAt(editor, pos)
  if (!table || table.childCount <= 1) return false
  if (rowIndex < 0 || rowIndex >= table.childCount) return false
  const target = table.child(rowIndex)
  editor.view.dispatch(editor.state.tr.delete(pos + 1, pos + 1 + target.nodeSize))
  return true
}

export function moveRow(editor: Editor, pos: number, from: number, to: number): boolean {
  const table = tableAt(editor, pos)
  if (!table || from === to) return false
  const count = table.childCount
  if (from < 0 || from >= count || to < 0 || to > count) return false
  const rows: PMNode[] = []
  table.forEach((row) => rows.push(row))
  const [moved] = rows.splice(from, 1)
  if (!moved) return false
  rows.splice(to > from ? to - 1 : to, 0, moved)
  const fragment = table.type.create(table.attrs, rows).content
  editor.view.dispatch(editor.state.tr.replaceWith(pos + 1, pos + 1 + table.content.size, fragment))
  return true
}

/** A new column: one untinted cell per row (header column stays header).
 *  Each new cell COPIES the anchor cell's colwidth, so the table stays a
 *  fixed layout and every existing column keeps its exact size — the new
 *  column just joins on the right. Rows are processed LAST→FIRST: each
 *  insert shifts the positions of everything after it, so ascending order
 *  would misalign the new cells (some rows even picked up another row's
 *  tint through the shift). */
export function insertColumnNear(
  editor: Editor,
  pos: number,
  colIndex: number,
  right: boolean
): boolean {
  const table = tableAt(editor, pos)
  if (!table || table.childCount === 0) return false
  const cols = table.child(0).childCount
  if (cols === 0) return false
  const anchor = Math.min(Math.max(right ? colIndex : colIndex - 1, 0), cols - 1)
  const tr = editor.state.tr
  const inserts: Array<{ at: number; cell: PMNode }> = []
  let offset = pos + 1
  table.forEach((row, rowOffset) => {
    row.forEach((cell, cellOffset, colI) => {
      if (colI === anchor) {
        const made = blankCellLike(cell, editor, true)
        if (made)
          inserts.push({ at: offset + rowOffset + cellOffset + 1 + cell.nodeSize, cell: made })
      }
    })
  })
  inserts.sort((a, b) => b.at - a.at).forEach((item) => tr.insert(item.at, item.cell))
  editor.view.dispatch(tr)
  return true
}

export function duplicateColumn(editor: Editor, pos: number, colIndex: number): boolean {
  const table = tableAt(editor, pos)
  if (!table) return false
  const tr = editor.state.tr
  const inserts: Array<{ at: number; cell: PMNode }> = []
  let offset = pos + 1
  table.forEach((row, rowOffset) => {
    row.forEach((cell, cellOffset, colI) => {
      if (colI === colIndex) {
        const copy = cell.type.create({ ...cell.attrs }, cell.content)
        inserts.push({ at: offset + rowOffset + cellOffset + 1 + cell.nodeSize, cell: copy })
      }
    })
  })
  // Last row first, so each insert cannot shift the positions still to come.
  inserts.sort((a, b) => b.at - a.at).forEach((item) => tr.insert(item.at, item.cell))
  editor.view.dispatch(tr)
  return true
}

export function deleteColumn(editor: Editor, pos: number, colIndex: number): boolean {
  const table = tableAt(editor, pos)
  if (!table || table.childCount === 0) return false
  if (table.child(0).childCount <= 1) return false
  const spans: Array<{ from: number; to: number }> = []
  let offset = pos + 1
  table.forEach((row, rowOffset) => {
    row.forEach((cell, cellOffset, colI) => {
      if (colI === colIndex) {
        const from = offset + rowOffset + cellOffset + 1
        spans.push({ from, to: from + cell.nodeSize })
      }
    })
  })
  // Delete from the end so earlier positions stay valid.
  const tr = editor.state.tr
  spans.sort((a, b) => b.from - a.from).forEach((span) => tr.delete(span.from, span.to))
  editor.view.dispatch(tr)
  return true
}

export function moveColumn(editor: Editor, pos: number, from: number, to: number): boolean {
  const table = tableAt(editor, pos)
  if (!table || from === to) return false
  const cols = table.child(0).childCount
  if (from < 0 || from >= cols || to < 0 || to > cols) return false
  const tr = editor.state.tr
  let offset = pos + 1
  table.forEach((row, rowOffset) => {
    const cells: PMNode[] = []
    row.forEach((cell) => cells.push(cell))
    const [moved] = cells.splice(from, 1)
    if (!moved) return
    cells.splice(to > from ? to - 1 : to, 0, moved)
    const rowNode = row.type.create(row.attrs, cells)
    tr.replaceWith(
      offset + rowOffset + 1,
      offset + rowOffset + 1 + row.content.size,
      rowNode.content
    )
  })
  editor.view.dispatch(tr)
  return true
}

/* ── RANGE deletes (select rows/columns → Delete removes them all) ──────── */

/** Deletes every row in the inclusive range [from..to]. A range covering
 *  ALL rows is clamped so one row always survives (Notion: a table keeps
 *  at least one row). One transaction — undo restores everything at once. */
export function deleteRowsRange(editor: Editor, pos: number, from: number, to: number): boolean {
  const table = tableAt(editor, pos)
  if (!table || table.childCount <= 1) return false
  const last = table.childCount - 1
  let lo = Math.max(0, Math.min(from, to))
  let hi = Math.min(last, Math.max(from, to))
  if (lo === 0 && hi === last) hi = last - 1 // never delete the final row
  if (hi < lo) return false
  const spans: Array<{ from: number; to: number }> = []
  let offset = pos + 1
  table.forEach((row, rowOffset, rowIndex) => {
    if (rowIndex >= lo && rowIndex <= hi) {
      spans.push({ from: offset + rowOffset, to: offset + rowOffset + row.nodeSize })
    }
  })
  const tr = editor.state.tr
  spans.sort((a, b) => b.from - a.from).forEach((span) => tr.delete(span.from, span.to))
  editor.view.dispatch(tr)
  return true
}

/** Deletes every column in the inclusive range [from..to]. A range covering
 *  ALL columns is clamped so one column always survives. */
export function deleteColumnsRange(editor: Editor, pos: number, from: number, to: number): boolean {
  const table = tableAt(editor, pos)
  if (!table || table.childCount === 0) return false
  const last = table.child(0).childCount - 1
  if (last < 1) return false
  let lo = Math.max(0, Math.min(from, to))
  let hi = Math.min(last, Math.max(from, to))
  if (lo === 0 && hi === last) hi = last - 1 // never delete the final column
  if (hi < lo) return false
  const spans: Array<{ from: number; to: number }> = []
  let offset = pos + 1
  table.forEach((row, rowOffset) => {
    row.forEach((cell, cellOffset, colI) => {
      if (colI >= lo && colI <= hi) {
        const cellFrom = offset + rowOffset + cellOffset + 1
        spans.push({ from: cellFrom, to: cellFrom + cell.nodeSize })
      }
    })
  })
  const tr = editor.state.tr
  spans.sort((a, b) => b.from - a.from).forEach((span) => tr.delete(span.from, span.to))
  editor.view.dispatch(tr)
  return true
}

/** Commits one column's width to EVERY cell of that column (colspan is
 *  always 1 in this schema — no merge UI). Used by the own resize drag.
 *  `markHandFit` flags the table as HAND-WIDENED: from then on no auto
 *  re-fit shrinks the grid back — a wider table scrolls inside the block
 *  instead (one transaction, one undo with the width itself). */
export function setColumnWidth(
  editor: Editor,
  pos: number,
  colIndex: number,
  width: number,
  markHandFit = false
): boolean {
  const table = tableAt(editor, pos)
  if (!table || table.childCount === 0) return false
  if (colIndex < 0 || colIndex >= table.child(0).childCount) return false
  const tr = editor.state.tr
  if (markHandFit && table.attrs.handFit !== true) {
    tr.setNodeMarkup(pos, undefined, { ...table.attrs, handFit: true })
  }
  let offset = pos + 1
  table.forEach((row, rowOffset) => {
    row.forEach((cell, cellOffset, colI) => {
      if (colI === colIndex) {
        tr.setNodeMarkup(offset + rowOffset + cellOffset + 1, undefined, {
          ...cell.attrs,
          colwidth: [width],
        })
      }
    })
  })
  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  return true
}

/** Fits the table INTO `containerWidth`: when the sum of the column widths
 *  exceeds the page/panel, every column scales down proportionally (with a
 *  small floor) until the grid fits. This is what makes adding a column on
 *  ANY side keep the whole table inside the page — the grid never spills
 *  out of the screen. Unpinned tables already render at 100% and are left
 *  alone. Returns true when a change was dispatched. */
export function fitColumnsToWidth(editor: Editor, pos: number, containerWidth: number): boolean {
  const table = tableAt(editor, pos)
  if (!table || table.childCount === 0 || !containerWidth || containerWidth < 1) return false
  const first = table.child(0)
  const cols = first.childCount
  if (cols === 0) return false
  const widths: number[] = []
  for (let index = 0; index < cols; index += 1) {
    const cell = first.child(index)
    const colwidth = Array.isArray(cell.attrs.colwidth) ? (cell.attrs.colwidth as number[]) : null
    const width = colwidth?.[0] ?? 0
    if (!width) return false // unpinned column — the 100% layout already fits
    widths.push(width)
  }
  const total = widths.reduce((sum, width) => sum + width, 0)
  if (total <= containerWidth) return false
  const factor = containerWidth / total
  const scaled = widths.map((width) => Math.max(MIN_COL_WIDTH, Math.round(width * factor)))
  // The MIN floor can overshoot the container — shave the remainder off
  // the widest columns until it fits (each keeps at least MIN_COL_WIDTH).
  let over = scaled.reduce((sum, width) => sum + width, 0) - containerWidth
  while (over > 0) {
    let widest = -1
    let widestWidth = MIN_COL_WIDTH
    for (let index = 0; index < scaled.length; index += 1) {
      if (scaled[index] > widestWidth) {
        widestWidth = scaled[index]
        widest = index
      }
    }
    if (widest < 0) break
    const shave = Math.min(over, widestWidth - MIN_COL_WIDTH)
    if (shave <= 0) break
    scaled[widest] -= shave
    over -= shave
  }
  const tr = editor.state.tr
  let offset = pos + 1
  table.forEach((row, rowOffset) => {
    row.forEach((cell, cellOffset, colIndex) => {
      const width = scaled[colIndex]
      if (!width) return
      tr.setNodeMarkup(offset + rowOffset + cellOffset + 1, undefined, {
        ...cell.attrs,
        colwidth: [width],
      })
    })
  })
  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  return true
}

/* ============================================================================
 * The node view
 * ==========================================================================*/

type MenuState =
  | { kind: 'table'; x?: number; y?: number }
  | { kind: 'row'; index: number; x?: number; y?: number }
  | { kind: 'col'; index: number; x?: number; y?: number }
  | { kind: 'color'; scope: 'table' | { row: number } | { col: number }; x?: number; y?: number }
  | null

interface MenuItem {
  key: string
  label: string
  icon: React.ReactNode
  run: () => void
  danger?: boolean
  toggle?: boolean
  sub?: boolean
  disabled?: boolean
}

/** The row/column range selected as a GROUP (⠿ click; ⇧click extends).
 *  `from..to` is inclusive — a single row/column is from === to. */
type GroupSelection = { axis: 'row' | 'col'; from: number; to: number } | null

/** Grip click → single; ⇧click on another grip of the SAME axis extends
 *  the range (min/max union). A ⇧click on a fresh selection starts single. */
function extendGroupSelection(
  current: GroupSelection,
  axis: 'row' | 'col',
  index: number,
  extend: boolean
): GroupSelection {
  if (extend && current && current.axis === axis) {
    return { axis, from: Math.min(current.from, index), to: Math.max(current.to, index) }
  }
  return { axis, from: index, to: index }
}

/** Touch devices get no hover chrome at all (user call: the ＋/⠿ must be
 *  GONE on mobile — block settings live in the long-press menu there).
 *  Guarded for environments without matchMedia (SSR, old jsdom harnesses):
 *  absence of the API means no reliable hover signal — desktop default. */
function isTouchUI(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return (
    window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches
  )
}

function SimpleTableView({ node, editor, deleteNode, getPos }: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [hoverRow, setHoverRow] = useState<number | null>(null)
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  const [menu, setMenu] = useState<MenuState>(null)
  const [selected, setSelected] = useState<GroupSelection>(null)
  const [dragLine, setDragLine] = useState<{ axis: 'row' | 'col'; pos: number } | null>(null)
  const dragRef = useRef<{ axis: 'row' | 'col'; from: number; to: number | null } | null>(null)
  const [hovered, setHovered] = useState(false)
  const leaveTimer = useRef<number | null>(null)
  const [pinned, setPinned] = useState(false)
  const [addRowsLive, setAddRowsLive] = useState(0)
  const [addColsLive, setAddColsLive] = useState(0)
  /* Own column-resize drag (replaces prosemirror-tables' plugin drag so it
     can be CLAMPED to the page: a drag changes only its column and can
     never push the grid outside the page or the panel). The ref carries
     the drag truth for the commit; the state mirrors it for rendering. */
  const resizeRef = useRef<{
    col: number
    startX: number
    startWidth: number
    width: number
    max: number
    otherTotal: number
    originLeft: number
  } | null>(null)
  const [resize, setResize] = useState<{
    col: number
    width: number
    originLeft: number
  } | null>(null)
  /* A real drag release also fires a click on the grip — this flag stops
     that click from re-selecting the ORIGINAL index over the landed one
     (and lets ⇧click extend instead of the pointerup single-select winning
     the race). */
  const suppressNextGripClick = useRef(false)
  /* Once the user hand-widens a column the table OWNS its widths: no auto
     re-fit ever shrinks it back — window/panel changes and column additions
     keep the user's large table and let it scroll instead. The flag lives
     on the table node (`handFit` attr), so it SURVIVES reloads and undo
     restores it together with the widths it belongs to. */
  const handWidened = node.attrs.handFit === true
  const touchUI = useRef(isTouchUI()).current

  const pos = typeof getPos === 'function' ? getPos() : null
  const tablePos = typeof pos === 'number' ? pos : null
  const rowCount = node.childCount
  const colCount = rowCount > 0 ? node.child(0).childCount : 0
  const headerRow = isHeaderRow(node)
  const headerCol = isHeaderColumn(node)

  /* The contentDOM <table>: NodeViewContent does not forward refs, so the
     element is looked up through the wrapper on demand. */
  const contentTable = useCallback((): HTMLTableElement | null => {
    const el = wrapperRef.current?.querySelector('[data-node-view-content]')
    return el instanceof HTMLTableElement ? el : null
  }, [])
  const bodyRows = useCallback((): HTMLElement[] => {
    const table = contentTable()
    if (!table) return []
    // Rows live in the renderer-appended tbody; fall back to any direct tr.
    const viaTbody = table.querySelectorAll(':scope > tbody > tr')
    if (viaTbody.length > 0) return Array.from(viaTbody) as HTMLElement[]
    return Array.from(table.querySelectorAll(':scope > tr')) as HTMLElement[]
  }, [contentTable])

  /* ── pin column widths on first hover ───────────────────────────────
     While any column lacks an explicit colwidth, the table renders at 100%
     width and the BROWSER redistributes space across ALL columns when one
     changes. Once every column is pinned (its measured width stored in
     the cell attrs), the own resize drag changes ONLY the dragged column.
     Pinning once is also what makes "add a column → keep sizes" hold:
     the new cells copy the anchor colwidth, the rest never move (and the
     fit pass below keeps the whole grid inside the page). */
  const ensureFixedWidths = useCallback(() => {
    if (typeof tablePos !== 'number') return
    const fresh = tableAt(editor, tablePos)
    if (!fresh || fresh.childCount === 0) return
    let unpinned = false
    fresh.child(0).forEach((cell) => {
      const colwidth = cell.attrs.colwidth
      if (!Array.isArray(colwidth) || !colwidth[0]) unpinned = true
    })
    if (!unpinned) return
    const rows = bodyRows()
    const cells = rows[0] ? (Array.from(rows[0].children) as HTMLElement[]) : []
    if (cells.length !== fresh.child(0).childCount) return
    const widths = cells.map((cell) => Math.round(cell.getBoundingClientRect().width))
    // No layout (hidden table, jsdom): keep the graceful 100% behaviour.
    if (widths.some((width) => !width || width < 1)) return
    const tr = editor.state.tr
    let offset = tablePos + 1
    fresh.forEach((row, rowOffset) => {
      row.forEach((cell, cellOffset, colIndex) => {
        const width = widths[colIndex]
        if (!width) return
        tr.setNodeMarkup(offset + rowOffset + cellOffset + 1, undefined, {
          ...cell.attrs,
          colwidth: [width],
        })
      })
    })
    if (tr.docChanged) editor.view.dispatch(tr)
  }, [editor, tablePos, bodyRows])

  /* ── the <colgroup> — THE resize fix ────────────────────────────────────
     prosemirror-tables' columnResizing reaches the colgroup through
     `tableEl.firstChild`. The renderer appends its <tbody> (the contentDOM)
     into our <table>, so without this view's colgroup the plugin would
     treat the tbody as the colgroup — deleting rows while "resizing" and
     never applying a width. We own the colgroup; the plugin patches it in
     place during drags, and we re-sync it from the committed colwidth
     attrs whenever the node changes. */
  const syncColgroup = useCallback(() => {
    const table = contentTable()
    if (!table) return
    let colgroup = table.querySelector(':scope > colgroup')
    if (!colgroup) {
      colgroup = document.createElement('colgroup')
      const first = table.firstElementChild
      if (first) table.insertBefore(colgroup, first)
      else table.appendChild(colgroup)
    }
    const firstRowNode = rowCount > 0 ? node.child(0) : null
    const cols = firstRowNode?.childCount ?? 0
    while (colgroup.children.length < cols) colgroup.appendChild(document.createElement('col'))
    while (colgroup.children.length > cols) colgroup.lastElementChild?.remove()
    if (!firstRowNode) return
    let total = 0
    let fixed = true
    for (let index = 0; index < cols; index += 1) {
      const cell = firstRowNode.child(index)
      const colwidth = Array.isArray(cell.attrs.colwidth) ? (cell.attrs.colwidth as number[]) : null
      let width = 0
      for (let span = 0; span < cell.attrs.colspan; span += 1) {
        width = colwidth?.[span] ?? 0
        if (width) break
      }
      const col = colgroup.children[index] as HTMLTableColElement | undefined
      if (!col) continue
      col.style.width = width ? `${width}px` : ''
      total += width
      if (!width) fixed = false
    }
    if (fixed && total > 0) {
      table.style.width = `${total}px`
      table.style.minWidth = ''
    } else {
      table.style.width = ''
      table.style.minWidth = ''
    }
  }, [contentTable, node, rowCount])
  useLayoutEffect(() => {
    syncColgroup()
  }, [syncColgroup])

  /* ── the page-fit pass ──────────────────────────────────────────────────
     The wrapper IS the page: its client width is the room the grid may
     occupy. While the user has not hand-widened the table, every column
     addition re-runs fitColumnsToWidth — the grid re-fits into the page
     and stays 100% responsive with no scrollbar. Once a column is
     hand-widened (the `handFit` attr) the table KEEPS those widths: a
     wider grid scrolls inside the block (it can never render outside the
     page), so the fit pass deliberately does nothing — user width wins. */
  const fitToPage = useCallback(() => {
    if (handWidened) return // hand-widened: scroll, never shrink
    const wrap = wrapperRef.current
    if (!wrap || typeof tablePos !== 'number') return
    fitColumnsToWidth(editor, tablePos, wrap.clientWidth)
  }, [editor, tablePos, handWidened])

  /* A ResizeObserver keeps LEGACY wide tables (never hand-widened) inside
     the page when the panel shrinks — old wide docs fold back instead of
     overflowing. A hand-widened table is skipped: it scrolls instead of
     being shrunk (user width wins over auto-fit). */
  useEffect(() => {
    const wrap = wrapperRef.current
    if (!wrap || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      // Never fight an active drag; the drag clamps itself.
      if (resizeRef.current) return
      fitToPage()
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [fitToPage])

  /* Column additions funnel through here so EVERY path (right strip click
     and drag, grip ＋, menu insert/duplicate) re-fits the grid to the
     page in the same tick it grows. */
  const addColumnRightOf = useCallback(
    (colIndex: number): boolean => {
      if (typeof tablePos !== 'number') return false
      if (!insertColumnNear(editor, tablePos, colIndex, true)) return false
      fitToPage()
      return true
    },
    [editor, tablePos, fitToPage]
  )
  const addColumnLeftOf = useCallback(
    (colIndex: number): boolean => {
      if (typeof tablePos !== 'number') return false
      if (!insertColumnNear(editor, tablePos, colIndex, false)) return false
      fitToPage()
      return true
    },
    [editor, tablePos, fitToPage]
  )
  const duplicateColAt = useCallback(
    (colIndex: number): boolean => {
      if (typeof tablePos !== 'number') return false
      if (!duplicateColumn(editor, tablePos, colIndex)) return false
      fitToPage()
      return true
    },
    [editor, tablePos, fitToPage]
  )

  /* Close the menu on outside interaction. */
  useEffect(() => {
    if (!menu) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Element
      if (target.closest('.note-table-pop')) return
      setMenu(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  /* Group selection keyboard behaviour: Delete/Backspace removes ALL rows
     or columns in the selected range, Escape deselects. The band is
     unambiguous — and any click OUTSIDE the grid (a paragraph, another
     block) clears it first (listener below), so a Delete can never fire
     against a stale band. The ProseMirror root is ONE contenteditable for
     the whole editor, so the DOM event target can never tell where the
     caret sits — the visible band is the source of truth, exactly like
     Notion: row selected → Delete deletes the row. */
  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null)
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && typeof tablePos === 'number') {
        const target = event.target as Element | null
        const targetEl = target instanceof HTMLElement ? target : null
        if (targetEl && (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA')) {
          // A real text field (rename, search…) is editing: never eat the key.
          return
        }
        event.preventDefault()
        if (selected.axis === 'row') {
          deleteRowsRange(editor, tablePos, selected.from, selected.to)
        } else {
          deleteColumnsRange(editor, tablePos, selected.from, selected.to)
        }
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [selected, tablePos, editor])

  /* A click on any editable surface OUTSIDE this grid clears the band —
     a caret that moved into a paragraph must never inherit the group's
     Delete. Inputs/fields and chrome own their own clicks. */
  useEffect(() => {
    if (!selected) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target) return
      if (wrapperRef.current?.contains(target)) return // cells clear via onGridMouseDown
      if (target.closest('.note-table-pop')) return // our own menu
      const editable = target.closest('[contenteditable="true"], input, textarea')
      if (editable) setSelected(null)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [selected])

  /* Clear transient chrome when the grid changes under us. */
  useEffect(() => {
    setHoverRow((current) => (current !== null && current >= rowCount ? null : current))
    setHoverCol((current) => (current !== null && current >= colCount ? null : current))
    setSelected((current) => {
      if (current === null) return current
      const count = current.axis === 'row' ? rowCount : colCount
      if (current.from >= count) return null
      return { ...current, from: current.from, to: Math.min(current.to, count - 1) }
    })
  }, [rowCount, colCount])

  /* Hover with a grace timer — the grips sit in the gutters OUTSIDE the
     grid, so the pointer crosses the wrapper edge on its way to them; the
     timer covers the jump, and each grip zone pins the chrome while the
     pointer is on the controls. */
  const onWrapperEnter = () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    setHovered(true)
    ensureFixedWidths()
  }
  const onWrapperLeave = () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => setHovered(false), HOVER_GRACE_MS)
  }
  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    },
    []
  )
  const chromeVisible = hovered || pinned || menu !== null || selected !== null

  /* Hover bookkeeping (delegated — rows are PM-owned DOM). Any cell hover
     names its row AND its column, so the grips follow the pointer.
     Pressing inside the grid clears a group selection (click = editing). */
  const onOver = (event: React.MouseEvent) => {
    const target = event.target as Element
    const rows = bodyRows()
    const tr = target.closest('tr')
    if (tr) {
      const index = rows.indexOf(tr as HTMLElement)
      if (index >= 0) setHoverRow(index)
    }
    const cell = target.closest('th, td')
    if (cell && cell.parentElement) {
      const colIndex = Array.from(cell.parentElement.children).indexOf(cell as HTMLElement)
      if (colIndex >= 0 && colIndex < colCount) setHoverCol(colIndex)
    }
  }
  const onGridMouseDown = (event: React.MouseEvent) => {
    const target = event.target as Element
    if (target.closest('th, td') && selected) setSelected(null)
  }

  /* ── grips: click → menu + group select · drag → reorder ──────────────── */

  const rowGripDown = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const startY = event.clientY
    let moved = false
    const rows = bodyRows()

    const onMove = (move: PointerEvent) => {
      if (!moved && Math.abs(move.clientY - startY) < GRIP_MOVE_THRESHOLD) return
      moved = true
      const wrap = wrapperRef.current
      if (!wrap) return
      const wrapRect = wrap.getBoundingClientRect()
      let target: number | null = null
      rows.forEach((row, i) => {
        const rect = row.getBoundingClientRect()
        if (move.clientY >= rect.top && move.clientY <= rect.bottom) {
          target = move.clientY > rect.top + rect.height / 2 ? i + 1 : i
        }
      })
      const firstTop = rows[0]?.getBoundingClientRect().top ?? 0
      const to = target ?? (move.clientY < firstTop ? 0 : rowCount)
      // Insertion line: the top of the target row, or the bottom of the last.
      const at =
        to < rows.length
          ? rows[to].getBoundingClientRect().top
          : rows[rows.length - 1]?.getBoundingClientRect().bottom
      if (at === undefined) return
      dragRef.current = { axis: 'row', from: index, to }
      setDragLine({ axis: 'row', pos: at - wrapRect.top })
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.classList.remove('note-table-dragging')
      const drag = dragRef.current
      dragRef.current = null
      setDragLine(null)
      if (!moved || !drag || typeof tablePos !== 'number') {
        // A plain click: the grip's onClick owns selection (it knows about
        // ⇧) — pointerup deliberately does NOT touch it.
        return
      }
      if (drag.to === null || drag.to === drag.from || drag.to === drag.from + 1) {
        // No real reorder — same as a plain click: let onClick decide.
        return
      }
      suppressNextGripClick.current = true
      moveRow(editor, tablePos, drag.from, drag.to)
      const landed = drag.to > drag.from ? drag.to - 1 : drag.to
      setSelected({ axis: 'row', from: landed, to: landed })
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.body.classList.add('note-table-dragging')
  }

  const colGripDown = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    let moved = false
    const cells = (
      bodyRows()[0]?.children ? Array.from(bodyRows()[0].children) : []
    ) as HTMLElement[]

    const onMove = (move: PointerEvent) => {
      if (!moved && Math.abs(move.clientX - startX) < GRIP_MOVE_THRESHOLD) return
      moved = true
      const wrap = wrapperRef.current
      if (!wrap) return
      const wrapRect = wrap.getBoundingClientRect()
      let target: number | null = null
      cells.forEach((cell, i) => {
        const rect = cell.getBoundingClientRect()
        if (move.clientX >= rect.left && move.clientX <= rect.right) {
          target = move.clientX > rect.left + rect.width / 2 ? i + 1 : i
        }
      })
      const firstLeft = cells[0]?.getBoundingClientRect().left ?? 0
      const to = target ?? (move.clientX < firstLeft ? 0 : colCount)
      const at =
        to < cells.length
          ? cells[to].getBoundingClientRect().left
          : cells[cells.length - 1]?.getBoundingClientRect().right
      if (at === undefined) return
      dragRef.current = { axis: 'col', from: index, to }
      setDragLine({ axis: 'col', pos: at - wrapRect.left })
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.classList.remove('note-table-dragging')
      const drag = dragRef.current
      dragRef.current = null
      setDragLine(null)
      if (!moved || !drag || typeof tablePos !== 'number') {
        // A plain click: onClick owns selection (⇧-aware).
        return
      }
      if (drag.to === null || drag.to === drag.from || drag.to === drag.from + 1) {
        return
      }
      suppressNextGripClick.current = true
      moveColumn(editor, tablePos, drag.from, drag.to)
      const landed = drag.to > drag.from ? drag.to - 1 : drag.to
      setSelected({ axis: 'col', from: landed, to: landed })
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.body.classList.add('note-table-dragging')
  }

  /* ── right bar: click adds one column · drag right adds many ──────────── */
  const onAddColPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const state = { startX: event.clientX, added: 0 }
    const onMove = (move: PointerEvent) => {
      if (typeof tablePos !== 'number') return
      const delta = move.clientX - state.startX
      const shouldAdd = Math.floor(delta / DRAG_COL_STEP)
      while (state.added < shouldAdd) {
        const fresh = tableAt(editor, tablePos)
        if (!fresh || fresh.childCount === 0) return
        if (!addColumnRightOf(fresh.child(0).childCount - 1)) return
        state.added += 1
        setAddColsLive(state.added)
      }
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      if (state.added === 0) {
        // A plain click: exactly one new column, on the right.
        if (typeof tablePos === 'number') {
          const fresh = tableAt(editor, tablePos)
          if (fresh && fresh.childCount > 0) {
            addColumnRightOf(fresh.child(0).childCount - 1)
          }
        }
      }
      setAddColsLive(0)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  /* ── bottom bar: click adds one row at the bottom · drag adds many ────── */
  const onAddPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const state = { startY: event.clientY, added: 0 }
    const onMove = (move: PointerEvent) => {
      if (typeof tablePos !== 'number') return
      const delta = move.clientY - state.startY
      const shouldAdd = Math.floor(delta / DRAG_ROW_STEP)
      while (state.added < shouldAdd) {
        const fresh = tableAt(editor, tablePos)
        if (!fresh) return
        if (!insertRowNear(editor, tablePos, fresh.childCount - 1, true)) return
        state.added += 1
        setAddRowsLive(state.added)
      }
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      if (state.added === 0) {
        // A plain click: exactly one new row, at the bottom.
        if (typeof tablePos === 'number') {
          const fresh = tableAt(editor, tablePos)
          if (fresh) insertRowNear(editor, tablePos, fresh.childCount - 1, true)
        }
      }
      setAddRowsLive(0)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  /* Pixel positions measured from the real DOM (hover + group selection).
     This effect MUST be idempotent: it re-runs on hover/selection changes
     and whenever the node re-renders (typing, resize, row/column changes),
     and every setState below keeps the previous object when the measurement
     is unchanged (React's Object.is bail-out). Without the dependency array
     plus that guard, each pass wrote a fresh object literal → re-render →
     re-run → … and React killed the page with
     "Maximum update depth exceeded". */
  const [rowBox, setRowBox] = useState<{ top: number; height: number } | null>(null)
  const [colBox, setColBox] = useState<{ left: number; width: number } | null>(null)
  const [selRowBox, setSelRowBox] = useState<{ top: number; height: number } | null>(null)
  const [selColBox, setSelColBox] = useState<{ left: number; width: number } | null>(null)
  /* The GRID's box (left + width included): the right ＋ strip, the bottom
     ＋ bar and the selection bands all anchor to the TABLE's edges — after
     a column add the strip must ride to the NEW right edge, never stay on
     the old column. `wrapW` is the wrapper's visible width: while a wide
     (hand-widened) grid is scrolled, the strips/bands/handle PARK at the
     panel edge instead of rendering outside the block. */
  const [gridBox, setGridBox] = useState<{
    top: number
    height: number
    left: number
    width: number
    wrapW: number
  } | null>(null)
  const measureChrome = useCallback(() => {
    const wrap = wrapperRef.current
    if (!wrap) return
    const wrapRect = wrap.getBoundingClientRect()
    const measureRow = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect()
      return { top: rect.top - wrapRect.top, height: rect.height }
    }
    const measureCol = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect()
      return { left: rect.left - wrapRect.left, width: rect.width }
    }
    const rows = bodyRows()
    const nextRow = hoverRow !== null ? (rows[hoverRow] ? measureRow(rows[hoverRow]) : null) : null
    const nextCol =
      hoverCol !== null
        ? (rows[0]?.children[hoverCol] as HTMLElement | undefined)
          ? measureCol(rows[0].children[hoverCol] as HTMLElement)
          : null
        : null
    const nextSelRow =
      selected?.axis === 'row' && rows[selected.from] && rows[selected.to]
        ? {
            top: rows[selected.from].getBoundingClientRect().top - wrapRect.top,
            height:
              rows[selected.to].getBoundingClientRect().bottom -
              rows[selected.from].getBoundingClientRect().top,
          }
        : null
    const nextSelCol =
      selected?.axis === 'col' &&
      (rows[0]?.children[selected.from] as HTMLElement | undefined) &&
      (rows[0]?.children[selected.to] as HTMLElement | undefined)
        ? {
            left: rows[0].children[selected.from].getBoundingClientRect().left - wrapRect.left,
            width:
              rows[0].children[selected.to].getBoundingClientRect().right -
              rows[0].children[selected.from].getBoundingClientRect().left,
          }
        : null
    const gridEl = contentTable()
    const nextGrid = gridEl
      ? (() => {
          const rect = gridEl.getBoundingClientRect()
          return {
            top: rect.top - wrapRect.top,
            height: rect.height,
            left: rect.left - wrapRect.left,
            width: rect.width,
            wrapW: wrapRect.width,
          }
        })()
      : null
    setRowBox((prev) =>
      prev !== null &&
      nextRow !== null &&
      prev.top === nextRow.top &&
      prev.height === nextRow.height
        ? prev
        : nextRow
    )
    setColBox((prev) =>
      prev !== null &&
      nextCol !== null &&
      prev.left === nextCol.left &&
      prev.width === nextCol.width
        ? prev
        : nextCol
    )
    setSelRowBox((prev) =>
      prev !== null &&
      nextSelRow !== null &&
      prev.top === nextSelRow.top &&
      prev.height === nextSelRow.height
        ? prev
        : nextSelRow
    )
    setSelColBox((prev) =>
      prev !== null &&
      nextSelCol !== null &&
      prev.left === nextSelCol.left &&
      prev.width === nextSelCol.width
        ? prev
        : nextSelCol
    )
    setGridBox((prev) =>
      prev !== null &&
      nextGrid !== null &&
      prev.top === nextGrid.top &&
      prev.height === nextGrid.height &&
      prev.left === nextGrid.left &&
      prev.width === nextGrid.width &&
      prev.wrapW === nextGrid.wrapW
        ? prev
        : nextGrid
    )
    /* deps deliberately exclude the setters — they are stable. */
  }, [hoverRow, hoverCol, selected, node, bodyRows, contentTable, colCount])
  useLayoutEffect(() => {
    measureChrome()
  }, [measureChrome])
  /* Scrolling a hand-widened grid and resizing the panel both move the
     table under the chrome — re-measure so bands/grips/strips stay glued
     to the VISIBLE table edges. */
  useEffect(() => {
    const onResize = () => measureChrome()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [measureChrome])

  const rowLine = dragLine?.axis === 'row' ? dragLine.pos : null
  const colLine = dragLine?.axis === 'col' ? dragLine.pos : null

  const openMenuAt = (state: NonNullable<MenuState>, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect()
    setMenu({ ...state, x: rect.left, y: rect.bottom + 6 })
  }

  const menuItems: MenuItem[] | null = useMemo(() => {
    if (!menu || menu.kind === 'color') return null
    if (menu.kind === 'table') {
      return [
        {
          key: 'hrow',
          label: 'Header row',
          icon: <IconHeaderRow />,
          toggle: headerRow,
          run: () => typeof tablePos === 'number' && toggleHeaderRow(editor, tablePos),
        },
        {
          key: 'hcol',
          label: 'Header column',
          icon: <IconHeaderCol />,
          toggle: headerCol,
          run: () => typeof tablePos === 'number' && toggleHeaderColumn(editor, tablePos),
        },
        {
          key: 'color',
          label: 'Color',
          icon: <IconPalette />,
          sub: true,
          run: () => setMenu({ kind: 'color', scope: 'table', x: menu.x, y: menu.y }),
        },
        {
          key: 'del',
          label: 'Delete table',
          icon: <IconTrash />,
          danger: true,
          run: () => deleteNode(),
        },
      ]
    }
    if (menu.kind === 'row') {
      return [
        {
          key: 'above',
          label: 'Insert above',
          icon: <IconRowAbove />,
          run: () =>
            typeof tablePos === 'number' && insertRowNear(editor, tablePos, menu.index, false),
        },
        {
          key: 'below',
          label: 'Insert below',
          icon: <IconRowBelow />,
          run: () =>
            typeof tablePos === 'number' && insertRowNear(editor, tablePos, menu.index, true),
        },
        {
          key: 'dup',
          label: 'Duplicate row',
          icon: <IconDuplicate />,
          run: () => typeof tablePos === 'number' && duplicateRow(editor, tablePos, menu.index),
        },
        {
          key: 'color',
          label: 'Color',
          icon: <IconPalette />,
          sub: true,
          run: () => setMenu({ kind: 'color', scope: { row: menu.index }, x: menu.x, y: menu.y }),
        },
        {
          key: 'del',
          label: 'Delete row',
          icon: <IconTrash />,
          danger: true,
          disabled: rowCount <= 1,
          run: () => typeof tablePos === 'number' && deleteRow(editor, tablePos, menu.index),
        },
      ]
    }
    return [
      {
        key: 'left',
        label: 'Insert left',
        icon: <IconColLeft />,
        run: () => addColumnLeftOf(menu.index),
      },
      {
        key: 'right',
        label: 'Insert right',
        icon: <IconColRight />,
        run: () => addColumnRightOf(menu.index),
      },
      {
        key: 'dup',
        label: 'Duplicate column',
        icon: <IconDuplicate />,
        run: () => duplicateColAt(menu.index),
      },
      {
        key: 'color',
        label: 'Color',
        icon: <IconPalette />,
        sub: true,
        run: () => setMenu({ kind: 'color', scope: { col: menu.index }, x: menu.x, y: menu.y }),
      },
      {
        key: 'del',
        label: 'Delete column',
        icon: <IconTrash />,
        danger: true,
        disabled: colCount <= 1,
        run: () => typeof tablePos === 'number' && deleteColumn(editor, tablePos, menu.index),
      },
    ]
  }, [
    menu,
    headerRow,
    headerCol,
    tablePos,
    editor,
    deleteNode,
    rowCount,
    colCount,
    addColumnLeftOf,
    addColumnRightOf,
    duplicateColAt,
  ])

  const applyColor = (shade: CellShade | null) => {
    if (typeof tablePos !== 'number' || !menu || menu.kind !== 'color') return
    setCellsBackground(editor, tablePos, menu.scope, shade)
    setMenu(null)
  }

  /* The hovered row's grip pair — vertically centered on the row, sitting
     in the LEFT gutter (⠿ above, ＋ below). The hovered column's pair sits
     ABOVE the grid, centered on the column (⠿ left, ＋ right). */
  const rowGrip = chromeVisible && hoverRow !== null && rowBox ? hoverRow : null
  const colGrip = chromeVisible && hoverCol !== null && colBox ? hoverCol : null

  /* ── OWN column-resize drag ────────────────────────────────────────────
     prosemirror-tables' plugin drag is replaced by this view-owned drag:
     the dragged column follows the pointer between MIN_COL_WIDTH and
     MAX_COL_WIDTH — it MAY grow the table far past the panel on purpose
     (large tables are allowed) and the block's horizontal scroll keeps
     everything inside the page. No other column ever moves. Live feedback
     patches the <colgroup> we own; release commits one width to every
     cell of the column and marks the table hand-widened (`handFit`). */
  const colHandleDown = (
    index: number,
    originLeft: number,
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (typeof tablePos !== 'number') return
    const wrap = wrapperRef.current
    const table = contentTable()
    if (!wrap || !table) return
    const colgroup = table.querySelector(':scope > colgroup')
    const colEls = colgroup ? (Array.from(colgroup.children) as HTMLElement[]) : []
    const widths = colEls.map((col) => parseFloat(col.style.width) || 0)
    const startWidth = widths[index] ?? 0
    if (!startWidth) return // unpinned — ensureFixedWidths runs on the next hover
    const otherTotal = widths.reduce((sum, width) => sum + width, 0) - startWidth
    // Large tables are ALLOWED: the column may grow past the panel — the
    // block's horizontal scroll keeps the grid inside the page.
    const max = Math.max(wrap.clientWidth, MAX_COL_WIDTH)
    const startX = event.clientX
    const drag = { col: index, startX, startWidth, width: startWidth, max, otherTotal, originLeft }
    resizeRef.current = drag
    setResize({ col: index, width: startWidth, originLeft })
    document.body.classList.add('note-table-resizing')

    const onMove = (move: PointerEvent) => {
      const live = resizeRef.current
      if (!live) return
      const raw = live.startWidth + (move.clientX - live.startX)
      const width = Math.min(Math.max(raw, MIN_COL_WIDTH), live.max)
      live.width = width
      setResize((current) => (current ? { ...current, width } : current))
      // Live feedback: patch OUR colgroup + the table box; nothing else moves.
      const liveTable = contentTable()
      const liveGroup = liveTable?.querySelector(':scope > colgroup')
      const colEl = liveGroup?.children[live.col] as HTMLElement | undefined
      if (colEl) colEl.style.width = `${width}px`
      if (liveTable) liveTable.style.width = `${live.otherTotal + width}px`
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.classList.remove('note-table-resizing')
      const done = resizeRef.current
      resizeRef.current = null
      setResize(null)
      if (done && typeof tablePos === 'number' && done.width !== done.startWidth) {
        // The user owns the widths now (`handFit` persists across reloads):
        // no auto re-fit shrinks this table — a wider grid scrolls instead.
        setColumnWidth(editor, tablePos, done.col, done.width, true)
      }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  /* The resize handle rides the HOVERED column's right border; while a
     drag is live it stays on the dragged column at the CURRENT width. */
  const handleCol = resize ? resize.col : hoverCol
  const handleLeft = resize
    ? resize.originLeft + resize.width - 4
    : colBox
      ? colBox.left + colBox.width - 4
      : null

  /* ── visible-area clamps for a hand-widened (scrollable) grid ─────────
     Chrome that anchors to the TABLE's edges must PARK at the panel edge
     or HIDE when its anchor scrolls out of view — nothing may render
     outside the block, even though the wrapper itself does not clip. */
  const wrapW = gridBox?.wrapW ?? null
  const visibleSpan = (left: number, width: number): { left: number; width: number } => {
    if (wrapW === null) return { left, width }
    const from = Math.max(0, left)
    const to = Math.min(wrapW, left + width)
    return { left: from, width: Math.max(0, to - from) }
  }
  const selRowBand =
    selected?.axis === 'row' && selRowBox && gridBox
      ? {
          ...visibleSpan(gridBox.left, gridBox.width),
          top: selRowBox.top,
          height: selRowBox.height,
        }
      : null
  const selColBand =
    selected?.axis === 'col' && selColBox ? visibleSpan(selColBox.left, selColBox.width) : null
  const colGripCenter = colBox ? colBox.left + colBox.width / 2 : null
  const colGripLeft =
    colGripCenter !== null
      ? gridBox
        ? Math.min(
            Math.max(colGripCenter - GRIP_SIZE / 2, 2),
            Math.max(2, gridBox.wrapW - GRIP_PAIR_SPAN - 2)
          )
        : colGripCenter - GRIP_SIZE / 2
      : null
  const colGripInView =
    colGripCenter !== null && (wrapW === null || (colGripCenter > -4 && colGripCenter < wrapW + 4))
  const colLineVisible = colLine !== null && (wrapW === null || (colLine >= 0 && colLine <= wrapW))
  const colLineClamped =
    colLine !== null && gridBox
      ? Math.min(Math.max(colLine, 0), Math.max(0, gridBox.wrapW - 2))
      : colLine
  const handleLeftClamped =
    handleLeft !== null && gridBox
      ? Math.min(handleLeft, Math.max(0, gridBox.wrapW - 10))
      : handleLeft
  /* While a wide grid is scrolled, the hovered column may be out of view —
     the handle hides with it (a live drag always keeps the handle). */
  const handleColVisible =
    resize !== null || (colBox !== null && visibleSpan(colBox.left, colBox.width).width > 4)
  const addColLeft =
    gridBox && gridBox.left + gridBox.width > gridBox.wrapW + 1 // wide grid is scrolled
      ? Math.min(gridBox.left + gridBox.width + 4, gridBox.wrapW - 28)
      : gridBox
        ? gridBox.left + gridBox.width + 4
        : null
  const addRowWidth = gridBox
    ? Math.max(0, Math.min(gridBox.width, gridBox.wrapW - gridBox.left))
    : null

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className="note-table-block"
      onMouseEnter={onWrapperEnter}
      onMouseLeave={onWrapperLeave}
      onMouseOver={onOver}
      onMouseDown={onGridMouseDown}
    >
      {/* table grip — the TOP-LEFT corner of the grid (Notion's spot);
          straddles the top border so the pointer reaches it from a header
          cell without leaving the wrapper. */}
      {chromeVisible && !touchUI && (
        <button
          type="button"
          className="note-table-tgrip"
          contentEditable={false}
          aria-label="Table menu"
          title="Table options"
          onMouseEnter={() => setPinned(true)}
          onMouseLeave={() => setPinned(false)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => openMenuAt({ kind: 'table' }, event.currentTarget)}
        >
          <GripGlyph />
        </button>
      )}

      {/* Horizontal scroll containment — a hand-widened grid scrolls
          INSIDE the block, so it can never render outside the page or the
          panel. The hover chrome lives OUTSIDE this scroller (node-view
          children of the wrapper) and keeps its exact behaviour on
          fitting tables. */}
      <div className="note-table-scroller" onScroll={measureChrome}>
        <NodeViewContent<'table'>
          as="table"
          className="note-table-grid"
          style={{ whiteSpace: 'normal' }}
        />
      </div>

      {/* ROW chrome — the ⠿ pair in the left gutter, the pair centered on
          the hovered row. The ＋ slot is always occupied; its icon only
          fades in when the pointer reaches the pair. */}
      {rowGrip !== null && rowBox && !touchUI && (
        <div
          className="note-table-gripzone is-row"
          contentEditable={false}
          style={{ top: rowBox.top + rowBox.height / 2 - GRIP_PAIR_SPAN / 2 }}
          onMouseEnter={() => setPinned(true)}
          onMouseLeave={() => setPinned(false)}
        >
          <button
            type="button"
            className="note-table-grip is-row"
            contentEditable={false}
            aria-label="Row options"
            title="Drag to move · Click to select row"
            onPointerDown={(event) => rowGripDown(rowGrip, event)}
            onClick={(event) => {
              if (suppressNextGripClick.current) {
                suppressNextGripClick.current = false
                return
              }
              setSelected((current) =>
                extendGroupSelection(current, 'row', rowGrip, event.shiftKey)
              )
              openMenuAt({ kind: 'row', index: rowGrip }, event.currentTarget)
            }}
          >
            <GripGlyph />
          </button>
          <button
            type="button"
            className="note-table-quickadd is-row"
            contentEditable={false}
            aria-label="Insert row below"
            title="Insert row below"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              typeof tablePos === 'number' && insertRowNear(editor, tablePos, rowGrip, true)
            }
          >
            <PlusGlyph />
          </button>
        </div>
      )}

      {/* COLUMN chrome — the ⠿ pair above the grid, the ⠿ centered on the
          hovered column, ＋ parked to its right (Notion's spots). */}
      {colGrip !== null && colBox && colGripInView && !touchUI && (
        <div
          className="note-table-gripzone is-col"
          contentEditable={false}
          style={{ left: colGripLeft ?? 0, top: -GRIP_PAIR_SPAN + 2 }}
          onMouseEnter={() => setPinned(true)}
          onMouseLeave={() => setPinned(false)}
        >
          <button
            type="button"
            className="note-table-grip is-col"
            contentEditable={false}
            aria-label="Column options"
            title="Drag to move · Click to select column"
            onPointerDown={(event) => colGripDown(colGrip, event)}
            onClick={(event) => {
              if (suppressNextGripClick.current) {
                suppressNextGripClick.current = false
                return
              }
              setSelected((current) =>
                extendGroupSelection(current, 'col', colGrip, event.shiftKey)
              )
              openMenuAt({ kind: 'col', index: colGrip }, event.currentTarget)
            }}
          >
            <GripGlyph />
          </button>
          <button
            type="button"
            className="note-table-quickadd is-col"
            contentEditable={false}
            aria-label="Insert column right"
            title="Insert column right"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => typeof tablePos === 'number' && addColumnRightOf(colGrip)}
          >
            <PlusGlyph />
          </button>
        </div>
      )}

      {/* Column-resize handle — the hovered column's RIGHT border shows
          ONLY the small grip pill (no line on a plain column hover); the
          blue guide line lights while hovering THAT pill or while a drag
          is live. Dragging moves ONLY that column and may grow it far
          past the panel — the scroll keeps it inside the page; the handle
          parks at the panel edge while the border runs past it. */}
      {chromeVisible &&
        handleCol !== null &&
        handleLeft !== null &&
        handleColVisible &&
        gridBox &&
        !touchUI && (
          <div
            className={`note-table-colhandle${resize ? 'is-resizing' : ''}`}
            contentEditable={false}
            style={{ left: handleLeftClamped ?? 0, top: gridBox.top, height: gridBox.height }}
            onPointerDown={(event) =>
              colHandleDown(handleCol, resize ? resize.originLeft : (colBox?.left ?? 0), event)
            }
            onMouseEnter={() => setPinned(true)}
            onMouseLeave={() => setPinned(false)}
          />
        )}

      {/* Group selection bands — ONE light-blue band + one group border
          across the whole row / column RANGE (never per-cell highlights);
          they hug the TABLE's edges, and while a wide grid is scrolled
          they clamp to the visible panel instead of spilling outside. */}
      {selRowBand && selRowBand.width > 2 && (
        <div
          className="note-table-band is-row"
          style={{
            top: selRowBand.top,
            height: selRowBand.height,
            left: selRowBand.left,
            width: selRowBand.width,
          }}
          contentEditable={false}
          aria-hidden="true"
        />
      )}
      {selColBand && selColBand.width > 2 && (
        <div
          className="note-table-band is-col"
          style={{
            left: selColBand.left,
            width: selColBand.width,
            ...(gridBox ? { top: gridBox.top, height: gridBox.height } : {}),
          }}
          contentEditable={false}
          aria-hidden="true"
        />
      )}

      {/* RIGHT full-height column bar — ALWAYS rendered and ANCHORED TO
          THE TABLE's right edge (measured, not a static offset): adding a
          column moves the bar to the NEW edge, so the ＋ is always on the
          real last column. While a hand-widened grid is scrolled, the bar
          parks at the panel edge so it never renders outside the block.
          The ＋ pill only shows on hover. Click: one column · drag right:
          many. */}
      {gridBox && addColLeft !== null && !touchUI && (
        <div
          className="note-table-addcol"
          contentEditable={false}
          style={{ top: gridBox.top, height: gridBox.height, left: addColLeft }}
          role="button"
          aria-label="Add column"
          title="Click to add a column · Drag to add more"
          onPointerDown={onAddColPointerDown}
        >
          <span className="note-table-addcol-plus">
            <PlusGlyph />
          </span>
          {addColsLive > 0 && <span className="note-table-addcol-count">+{addColsLive}</span>}
        </div>
      )}

      {/* BOTTOM row bar — Notion's quiet "New row" affordance: ALWAYS here
          so its line is reserved (hover never shifts the page below the
          table); the ＋ and hint only show on hover. It spans the TABLE's
          width (measured), so its ＋ sits under the grid's centre even when
          the grid is narrower than the panel. Click: one row at the bottom
          · drag: many. */}
      {!touchUI && (
        <div
          className="note-table-addrow"
          contentEditable={false}
          onPointerDown={onAddPointerDown}
          role="button"
          aria-label="Add row"
          title="Click to add a row · Drag to add more"
        >
          <span className="note-table-addrow-plus">
            <PlusGlyph />
          </span>
          <span className="note-table-addrow-hint">New row</span>
          {addRowsLive > 0 && <span className="note-table-addrow-count">+{addRowsLive}</span>}
        </div>
      )}

      {/* drag insertion line */}
      {rowLine !== null && (
        <div
          className="note-table-dragline is-row"
          style={{ top: rowLine }}
          contentEditable={false}
        />
      )}
      {colLineVisible && colLineClamped !== null && (
        <div
          className="note-table-dragline is-col"
          style={{ left: colLineClamped }}
          contentEditable={false}
        />
      )}

      {/* popovers (fixed, viewport coords) */}
      {menu && menu.kind !== 'color' && menuItems && (
        <div className="note-table-pop" style={{ left: menu.x ?? 0, top: menu.y ?? 0 }} role="menu">
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`note-table-pop-row${item.danger ? 'is-danger' : ''}${item.toggle ? 'is-active' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                item.run()
                if (!item.sub) setMenu(null)
              }}
            >
              <span className="note-table-pop-icon">{item.icon}</span>
              <span className="note-table-pop-label">{item.label}</span>
              {item.toggle && <IconCheck className="note-table-pop-check" />}
            </button>
          ))}
        </div>
      )}
      {menu && menu.kind === 'color' && (
        <div
          className="note-table-pop is-palette"
          style={{ left: menu.x ?? 0, top: menu.y ?? 0 }}
          role="menu"
        >
          {CELL_COLORS.map((color) => (
            <button
              key={color.name}
              type="button"
              role="menuitem"
              className="note-table-pop-row is-color"
              onClick={() => applyColor(color.shade === 'default' ? null : color.shade)}
            >
              {color.shade !== 'default' ? (
                <span className="note-table-pop-swatch" data-shade={color.shade} />
              ) : (
                <span className="note-table-pop-swatch is-clear">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                  </svg>
                </span>
              )}
              <span className="note-table-pop-label">{color.name}</span>
            </button>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  )
}

/* ── schema ─────────────────────────────────────────────────────────────── */

const cellBackgroundAttribute = {
  background: {
    // Shade NAME ("gray", "blue"…) — notes.css maps it to --note-cellbg-*.
    // Legacy docs may carry a hex; it keeps rendering via the inline style.
    default: null,
    parseHTML: (element: HTMLElement) => {
      const raw = element.getAttribute('data-cell-bg')
      if (!raw) return null
      return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw : raw.toLowerCase()
    },
    renderHTML: (attributes: Record<string, unknown>) => {
      if (!attributes.background) return {}
      const value = String(attributes.background)
      if (/^#[0-9a-f]{3,8}$/i.test(value)) {
        return {
          'data-cell-bg': value,
          style: `background-color: ${value}`,
        }
      }
      return { 'data-cell-bg': value.toLowerCase() }
    },
  },
}

export const SimpleTable = Table.extend({
  addOptions() {
    return {
      HTMLAttributes: { class: 'note-table' },
      /* The plugin's columnResizing drag is OFF — the node view owns the
         drag so it can ALLOW LARGE tables (wider grids scroll inside the
         block). The colgroup the view keeps as the table's first child is
         still fully ours. */
      resizable: false,
      renderWrapper: false,
      handleWidth: 8,
      cellMinWidth: 25,
      lastColumnResizable: true,
      allowTableNodeSelection: false,
      View: null, // the React node view below owns the DOM
    }
  },

  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      /* Set ONCE when the user hand-widens a column: from then on the
         table OWNS its widths — no auto re-fit shrinks the grid back; a
         wider grid scrolls inside the block instead. Lives in the doc
         JSON, so it survives reloads (and undo restores it with the
         widths it belongs to). */
      handFit: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-hand-fit') === 'true',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.handFit ? { 'data-hand-fit': 'true' } : {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(SimpleTableView, { contentDOMElementTag: 'tbody' })
  },
})

export const SimpleTableRow = TableRow.extend({
  name: 'tableRow',
})

export const SimpleTableCell = TableCell.extend({
  name: 'tableCell',
  addAttributes() {
    return { ...this.parent?.(), ...cellBackgroundAttribute }
  },
})

export const SimpleTableHeader = TableHeader.extend({
  name: 'tableHeader',
  addAttributes() {
    return { ...this.parent?.(), ...cellBackgroundAttribute }
  },
})

/** Builds the JSON for an empty simple table (used by seeds/tests). */
export function buildSimpleTableJSON(
  rows: number,
  cols: number
): {
  type: 'table'
  content: unknown[]
} {
  const makeRow = (header: boolean) => ({
    type: 'tableRow',
    content: Array.from({ length: cols }, () => ({
      type: header ? 'tableHeader' : 'tableCell',
      content: [{ type: 'paragraph' }],
    })),
  })
  return {
    type: 'table',
    content: Array.from({ length: Math.max(1, rows) }, (_, index) => makeRow(index === 0)),
  }
}
