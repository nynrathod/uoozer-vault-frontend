import { mergeAttributes } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Table } from '@tiptap/extension-table'
import type { TableOptions } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import {
  CellSelection,
  deleteCellSelection,
  deleteColumn,
  deleteRow,
  deleteTable,
} from '@tiptap/pm/tables'
import { Fragment, Node as PMNode } from '@tiptap/pm/model'
import type { Schema } from '@tiptap/pm/model'
import type { ViewMutationRecord } from '@tiptap/pm/view'

export interface TableOptionsAttrs {
  /** Border thickness in px. null = theme default (1px). */
  borderWidth: number | null
  /** Border shade name from the note palette. null = theme border color. */
  borderColor: string | null
  /** Outer corner radius in px. null = default (6px). */
  radius: number | null
  /** Minimum row height in px. null = default (33px). */
  rowHeight: number | null
  /** Alternating row backgrounds. */
  zebra: boolean
}

const DEFAULT_TABLE_OPTIONS: TableOptionsAttrs = {
  borderWidth: null,
  borderColor: null,
  radius: null,
  rowHeight: null,
  zebra: false,
}

/** Lower bound for a per-row height; matches --tbl-row-h in index.css. */
const MIN_ROW_H = 33

/** Builds the inline CSS variables consumed by the table rules in index.css. */
function tableStyleVars(attrs: Record<string, unknown>): string {
  const options = readTableOptions(attrs)
  const borderColor = options.borderColor
    ? `var(--note-fg-${options.borderColor})`
    : 'hsl(var(--border))'
  return [
    `--tbl-border-w: ${options.borderWidth ?? 1}px`,
    `--tbl-border-c: ${borderColor}`,
    `--tbl-radius: ${options.radius ?? 6}px`,
    `--tbl-row-h: ${options.rowHeight ?? 33}px`,
  ].join('; ')
}

/**
 * The exact HTML attributes renderHTML emits for a table node. Shared by
 * renderHTML and the node view so both paths stay identical.
 */
function tableDOMAttrs(attrs: Record<string, unknown>): Record<string, string> {
  const options = readTableOptions(attrs)
  const out: Record<string, string> = { class: 'note-table', style: tableStyleVars(attrs) }
  if (options.borderWidth !== null) out['data-tbl-border-w'] = String(options.borderWidth)
  if (options.borderColor) out['data-tbl-border-c'] = options.borderColor
  if (options.radius !== null) out['data-tbl-radius'] = String(options.radius)
  if (options.rowHeight !== null) out['data-tbl-row-h'] = String(options.rowHeight)
  if (options.zebra) out['data-tbl-zebra'] = 'true'
  return out
}

/** Keys the node view has to clear when an option is switched back off. */
const TABLE_DATA_KEYS = [
  'data-tbl-border-w',
  'data-tbl-border-c',
  'data-tbl-radius',
  'data-tbl-row-h',
  'data-tbl-zebra',
] as const

/** Normalizes stored attributes into a complete options object. */
export function readTableOptions(
  attrs: Record<string, unknown> | undefined | null
): TableOptionsAttrs {
  if (!attrs) return { ...DEFAULT_TABLE_OPTIONS }
  const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null
  return {
    borderWidth: num(attrs.borderWidth),
    borderColor:
      typeof attrs.borderColor === 'string' && attrs.borderColor ? attrs.borderColor : null,
    radius: num(attrs.radius),
    rowHeight: num(attrs.rowHeight),
    zebra: Boolean(attrs.zebra),
  }
}

function numberAttribute(name: string) {
  return {
    default: null,
    parseHTML: (element: HTMLElement) => {
      const raw = element.getAttribute(`data-tbl-${name}`)
      if (raw === null) return null
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : null
    },
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes[name] === null || attributes[name] === undefined
        ? {}
        : { [`data-tbl-${name}`]: String(attributes[name]) },
  }
}

/* -------------------------------------------------------------------------- */
/* Table node                                                                  */
/* -------------------------------------------------------------------------- */

export const UoozerTable = Table.extend({
  name: 'table',

  addOptions() {
    // The cast is required: spreading a possibly-undefined parent options
    // object widens every property to optional, which no longer satisfies
    // the TableOptions interface this override must return.
    return {
      ...this.parent?.(),
      HTMLAttributes: { class: 'note-table' },
    } as TableOptions
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      borderWidth: numberAttribute('border-w'),
      borderColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-tbl-border-c'),
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.borderColor === 'string' && attributes.borderColor
            ? { 'data-tbl-border-c': attributes.borderColor }
            : {},
      },
      radius: numberAttribute('radius'),
      rowHeight: numberAttribute('row-h'),
      zebra: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-tbl-zebra') === 'true',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.zebra ? { 'data-tbl-zebra': 'true' } : {},
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'table',
      mergeAttributes(HTMLAttributes, tableDOMAttrs(node.attrs as Record<string, unknown>)),
      0,
    ]
  },

  /**
   * rev 6: a node view that patches attributes IN PLACE.
   *
   * Without it, ProseMirror cannot update a table whose markup changed
   * (`!node.sameMarkup(this.node)` fails in ViewDesc.update) and destroys +
   * recreates the whole <table> element on every settings change — which
   * detached the table chrome's adopted element, closed the open settings
   * panel, and remounted every React node view inside the table (status
   * pills). This view keeps the same DOM element for the lifetime of the
   * node and just rewrites class / style / data attributes, exactly like
   * tiptap's own TableView does for column widths.
   */
  addNodeView() {
    const applyAttrs = (el: HTMLElement, node: PMNode) => {
      const attrs = tableDOMAttrs(node.attrs as Record<string, unknown>)
      el.className = attrs.class
      el.setAttribute('style', attrs.style)
      for (const key of TABLE_DATA_KEYS) {
        if (key in attrs) el.setAttribute(key, attrs[key])
        else el.removeAttribute(key)
      }
    }
    return ({ node }) => {
      const table = document.createElement('table')
      applyAttrs(table, node)
      const tbody = table.appendChild(document.createElement('tbody'))
      let current = node
      return {
        dom: table,
        contentDOM: tbody,
        update: (next: PMNode) => {
          if (next.type !== current.type) return false
          current = next
          applyAttrs(table, next)
          return true
        },
        // Attribute mutations on the <table> itself are ours (applyAttrs);
        // everything inside the tbody belongs to ProseMirror.
        ignoreMutation: (mutation: ViewMutationRecord) =>
          mutation.type === 'attributes' && mutation.target === table,
      }
    }
  },

  addKeyboardShortcuts() {
    const insideTable = () =>
      this.editor.isActive('table') ||
      this.editor.isActive('tableCell') ||
      this.editor.isActive('tableHeader')

    /**
     * Mod-a inside a table selects the WHOLE TABLE as a visible cell
     * selection (rev 7). A second press falls through to the native
     * select-all so the whole document can still be reached.
     */
    const selectWholeTable = () => {
      try {
        if (this.editor.isDestroyed) return false
        const { state, view } = this.editor
        const { selection } = state
        if (
          selection instanceof CellSelection &&
          selection.isRowSelection() &&
          selection.isColSelection()
        ) {
          return false // the table is already fully selected → native select-all
        }
        for (let depth = selection.$from.depth; depth >= 0; depth -= 1) {
          if (selection.$from.node(depth).type.name !== 'table') continue
          const geo = tableGeometry(selection.$from.node(depth), selection.$from.before(depth))
          const first = geo.rows[0]?.cells[0]
          const lastRow = geo.rows[geo.rows.length - 1]
          const last = lastRow?.cells[lastRow.cells.length - 1]
          if (!first || !last) return false
          view.dispatch(state.tr.setSelection(CellSelection.create(state.doc, first.pos, last.pos)))
          return true
        }
        return false
      } catch {
        return false
      }
    }

    /**
     * rev 7 — Uoozer-style Backspace/Delete semantics for table selections:
     *
     * - whole table selected (Mod-a, or a cursor drag across every cell):
     *   BOTH keys remove the whole table;
     * - full row(s) selected: Delete removes the row structure,
     *   Backspace clears the cell contents (structure stays);
     * - full column(s) selected: Delete removes the columns,
     *   Backspace clears the contents;
     * - a partial cell selection: both keys clear the selected cells.
     */
    const deleteBySelection = (key: 'backspace' | 'delete') => {
      return () => {
        try {
          if (this.editor.isDestroyed) return false
          const { state, view } = this.editor
          const { selection } = state
          // A NodeSelection over the table (native tab/select paths).
          if (selection instanceof NodeSelection && selection.node.type.name === 'table') {
            view.dispatch(state.tr.delete(selection.from, selection.to).scrollIntoView())
            return true
          }
          if (!(selection instanceof CellSelection)) return false
          const fullRow = selection.isRowSelection()
          const fullCol = selection.isColSelection()
          if (fullRow && fullCol) {
            deleteTable(state, view.dispatch)
            return true
          }
          if (key === 'delete') {
            if (fullRow) {
              // deleteRow refuses a selection spanning every row (single-row
              // table) — the table itself is the thing to remove then.
              if (deleteRow(state, view.dispatch)) return true
              deleteTable(state, view.dispatch)
              return true
            }
            if (fullCol) {
              if (deleteColumn(state, view.dispatch)) return true
              deleteTable(state, view.dispatch)
              return true
            }
          }
          deleteCellSelection(state, view.dispatch)
          return true
        } catch {
          return false
        }
      }
    }

    return {
      'Mod-a': selectWholeTable,
      Backspace: deleteBySelection('backspace'),
      Delete: deleteBySelection('delete'),
      'Mod-Alt-ArrowRight': () =>
        insideTable() ? this.editor.chain().focus().addColumnAfter().goToNextCell().run() : false,
      'Mod-Alt-ArrowLeft': () =>
        insideTable()
          ? this.editor.chain().focus().addColumnBefore().goToPreviousCell().run()
          : false,
      'Mod-Alt-ArrowDown': () =>
        insideTable() ? this.editor.chain().focus().addRowAfter().run() : false,
      'Mod-Alt-ArrowUp': () =>
        insideTable() ? this.editor.chain().focus().addRowBefore().run() : false,
    }
  },

  addCommands() {
    return {
      // Spread first: keeps every command shipped by the base Table extension
      // (insertTable, addColumnBefore/After, addRowBefore/After, deleteRow,
      // deleteColumn, deleteTable, toggleHeader*, goToNextCell, ...).
      // Redefining addCommands() without this spread would replace them all.
      ...this.parent?.(),
      /**
       * Updates the display options of the table at the current selection.
       * The settings panel uses updateTableOptions() with the table element,
       * which works without a caret inside the table.
       */
      setTableOptions:
        (patch: Partial<TableOptionsAttrs>) =>
        ({
          state,
          dispatch,
        }: {
          state: EditorState
          dispatch?: ((tr: Transaction) => void) | undefined
        }) => {
          const found = tableFromSelection(state.selection.$from)
          if (!found) return false
          if (dispatch) {
            const tr = state.tr
            tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, ...patch })
            dispatch(tr)
          }
          return true
        },
    }
  },
})

/* -------------------------------------------------------------------------- */
/* Row node                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Row node with an optional per-row height (data-tbl-row-h). The attribute is
 * rendered as a min-height on the <tr> so the row-height drag handle in
 * TableHandles can resize single rows; tables without the attribute keep the
 * table-level default from --tbl-row-h.
 */
export const UoozerTableRow = TableRow.extend({
  name: 'tableRow',

  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('data-tbl-row-h')
          if (raw === null) return null
          const parsed = Number(raw)
          return Number.isFinite(parsed) ? parsed : null
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.height === null || attributes.height === undefined
            ? {}
            : { 'data-tbl-row-h': String(attributes.height) },
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const height = Number(node.attrs.height)
    const style = [
      Number.isFinite(height) && height > 0 ? `height: ${height}px` : '',
      typeof HTMLAttributes.style === 'string' ? HTMLAttributes.style : '',
    ]
      .filter(Boolean)
      .join('; ')
    return ['tr', mergeAttributes(HTMLAttributes, style ? { style } : {}), 0]
  },
})

/* -------------------------------------------------------------------------- */
/* Cell nodes                                                                  */
/* -------------------------------------------------------------------------- */

const cellShadeAttribute = {
  shade: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute('data-cell-shade'),
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.shade ? { 'data-cell-shade': String(attributes.shade) } : {},
  },
}

function cellAttributes(node: PMNode, HTMLAttributes: Record<string, unknown>) {
  const attrs: Record<string, unknown> = { ...HTMLAttributes }
  const firstWidth = Array.isArray(node.attrs.colwidth) ? Number(node.attrs.colwidth[0]) : 0
  const style = [
    Number.isFinite(firstWidth) && firstWidth > 0 ? `width: ${firstWidth}px` : '',
    typeof attrs.style === 'string' ? attrs.style : '',
  ]
    .filter(Boolean)
    .join('; ')
  if (style) attrs.style = style
  if (node.attrs.shade) {
    attrs['data-cell-shade'] = String(node.attrs.shade)
    attrs.class = [
      'note-cell',
      `note-cellbg-${node.attrs.shade}`,
      typeof attrs.class === 'string' ? attrs.class : '',
    ]
      .filter(Boolean)
      .join(' ')
  }
  return attrs
}

export const UoozerTableCell = TableCell.extend({
  name: 'tableCell',

  addAttributes() {
    return { ...this.parent?.(), ...cellShadeAttribute }
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['td', cellAttributes(node, HTMLAttributes), 0]
  },
})

export const UoozerTableHeader = TableHeader.extend({
  name: 'tableHeader',

  addAttributes() {
    return { ...this.parent?.(), ...cellShadeAttribute }
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['th', cellAttributes(node, HTMLAttributes), 0]
  },
})

// Declared flat, the same way @tiptap/extension-table declares insertTable
// and friends, so editor.commands.setTableOptions(...) type-checks directly.
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    setTableOptions: (patch: Partial<TableOptionsAttrs>) => ReturnType
  }
}

/* -------------------------------------------------------------------------- */
/* Table geometry                                                              */
/* -------------------------------------------------------------------------- */

interface CellRef {
  node: PMNode
  pos: number
}

interface RowRef {
  node: PMNode
  pos: number
  cells: CellRef[]
}

interface TableGeometry {
  table: PMNode
  tablePos: number
  rows: RowRef[]
}

function tableFromSelection($from: {
  depth: number
  node: (depth: number) => PMNode
  before: (depth: number) => number
}) {
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      return { node: $from.node(depth), pos: $from.before(depth) }
    }
  }
  return null
}

/**
 * Resolves the ProseMirror table node behind a rendered <table> element.
 *
 * rev 6: the document is scanned and each table node is matched through the
 * view's own DOM map (`view.nodeDOM`). This works no matter how tiptap
 * rendered the table (bare `<table>` from renderHTML, or a NodeView wrapper
 * `div.tableWrapper > table`), never throws for foreign elements, and is
 * immune to the `posAtDOM` heuristics that broke when the table element sat
 * outside the NodeView's contentDOM. The old position-based resolve remains
 * as a fallback.
 */
export function resolveTable(
  editor: Editor,
  tableEl: HTMLTableElement
): { node: PMNode; pos: number } | null {
  try {
    if (editor.isDestroyed) return null
    const { state, view } = editor
    let found: { node: PMNode; pos: number } | null = null
    state.doc.descendants((node, pos) => {
      if (found) return false
      if (node.type.name !== 'table') return true
      try {
        const dom = view.nodeDOM(pos)
        if (dom instanceof HTMLElement && (dom === tableEl || dom.contains(tableEl))) {
          found = { node, pos }
          return false
        }
      } catch {
        /* stale position — keep scanning */
      }
      return true
    })
    if (found) return found
    // Fallback: resolve by DOM position (element rendered without a match).
    const pos = view.posAtDOM(tableEl, 0)
    const $pos = state.doc.resolve(pos)
    return tableFromSelection($pos)
  } catch {
    return null // element detached or view not mounted
  }
}

/** Absolute positions of every row and cell, computed once per operation. */
function tableGeometry(table: PMNode, tablePos: number): TableGeometry {
  const rows: RowRef[] = []
  let rowPos = tablePos + 1
  table.forEach((row) => {
    const cells: CellRef[] = []
    let cellPos = rowPos + 1
    row.forEach((cell) => {
      cells.push({ node: cell, pos: cellPos })
      cellPos += cell.nodeSize
    })
    rows.push({ node: row, pos: rowPos, cells })
    rowPos += row.nodeSize
  })
  return { table, tablePos, rows }
}

/** Simple tables only: merged cells are never produced by this UI. */
function isSimpleGrid(geo: TableGeometry): boolean {
  return geo.rows.every((row) =>
    row.cells.every(
      (cell) => Number(cell.node.attrs.colspan) <= 1 && Number(cell.node.attrs.rowspan) <= 1
    )
  )
}

function setSafeSelection(tr: Transaction, pos: number) {
  try {
    const clamped = Math.max(0, Math.min(pos, tr.doc.content.size))
    tr.setSelection(TextSelection.near(tr.doc.resolve(clamped)))
  } catch {
    // Atom content keeps the current selection.
  }
}

/**
 * Runs one transaction against the table behind `tableEl`. `mutate` receives
 * the geometry of the CURRENT document and appends steps; positions computed
 * from the geometry stay valid as long as steps are appended in descending
 * position order (which every operation below respects). Returns the caret
 * position to land after the change, or null to keep the selection.
 */
function runTableOp(
  editor: Editor,
  tableEl: HTMLTableElement,
  mutate: (geo: TableGeometry, tr: Transaction, schema: Schema) => number | null | false
): boolean {
  try {
    if (editor.isDestroyed) return false
    const found = resolveTable(editor, tableEl)
    if (!found) {
      // rev 5: never fail silently again - this is the line that names the
      // cause when a click "does nothing" (detached element or remounting view).
      console.warn('[note-table] operation skipped: table element not resolvable')
      return false
    }
    const geo = tableGeometry(found.node, found.pos)
    if (!isSimpleGrid(geo)) {
      console.warn('[note-table] operation skipped: merged cells present')
      return false
    }
    const { state, view } = editor
    const tr = state.tr
    const caret = mutate(geo, tr, state.schema)
    if (caret === false) {
      console.warn('[note-table] operation rejected by its own guard')
      return false
    }
    if (typeof caret === 'number') setSafeSelection(tr, caret)
    view.dispatch(tr)
    return true
  } catch (error) {
    console.warn('[note-table] operation failed:', error)
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* Public operations                                                           */
/* -------------------------------------------------------------------------- */

/** Appends `count` empty columns on the right edge. */
export function addColumnsAtEnd(editor: Editor, tableEl: HTMLTableElement, count: number): boolean {
  if (count <= 0) return false
  return runTableOp(editor, tableEl, (geo, tr) => {
    let caret: number | null = null
    for (let r = geo.rows.length - 1; r >= 0; r -= 1) {
      const row = geo.rows[r]
      const last = row.cells[row.cells.length - 1]
      if (!last) continue
      const base = last.pos + last.node.nodeSize
      for (let k = 0; k < count; k += 1) {
        const cell = last.node.type.createAndFill()
        if (!cell) continue
        tr.insert(base, cell)
        if (r === 0 && k === count - 1) caret = base + 1
      }
    }
    return caret
  })
}

/** Removes `count` columns from the right edge; at least one column survives. */
export function removeColumnsFromEnd(
  editor: Editor,
  tableEl: HTMLTableElement,
  count: number
): boolean {
  if (count <= 0) return false
  return runTableOp(editor, tableEl, (geo, tr) => {
    const width = geo.rows[0]?.cells.length ?? 0
    const n = Math.min(count, width - 1)
    if (n <= 0) return false
    for (let r = geo.rows.length - 1; r >= 0; r -= 1) {
      const cells = geo.rows[r].cells
      for (let i = cells.length - 1; i >= cells.length - n && i >= 0; i -= 1) {
        tr.delete(cells[i].pos, cells[i].pos + cells[i].node.nodeSize)
      }
    }
    return null
  })
}

/** Appends `count` empty rows on the bottom edge, matching the last row's header styling. */
export function addRowsAtEnd(editor: Editor, tableEl: HTMLTableElement, count: number): boolean {
  if (count <= 0) return false
  return runTableOp(editor, tableEl, (geo, tr, schema) => {
    const rowType = schema.nodes.tableRow
    const template = geo.rows[geo.rows.length - 1]
    if (!rowType || !template) return false
    const base = template.pos + template.node.nodeSize
    let caret: number | null = null
    for (let k = 0; k < count; k += 1) {
      const cells = template.cells
        .map((cell) => cell.node.type.createAndFill())
        .filter((cell): cell is PMNode => cell !== null)
      if (cells.length !== template.cells.length) return false
      const row = rowType.create(null, cells)
      tr.insert(base + k * row.nodeSize, row)
      if (k === 0) caret = base + 2
    }
    return caret
  })
}

/** Removes `count` rows from the bottom edge; at least one row survives. */
export function removeRowsFromEnd(
  editor: Editor,
  tableEl: HTMLTableElement,
  count: number
): boolean {
  if (count <= 0) return false
  return runTableOp(editor, tableEl, (geo, tr) => {
    const n = Math.min(count, geo.rows.length - 1)
    if (n <= 0) return false
    for (let i = geo.rows.length - 1; i >= geo.rows.length - n; i -= 1) {
      const row = geo.rows[i]
      tr.delete(row.pos, row.pos + row.node.nodeSize)
    }
    return null
  })
}

/**
 * Inserts `count` empty columns in one transaction so the first lands at
 * `index` (0..width). New cells copy the cell type at the landing spot, so a
 * column inserted into the header row is a header cell too. The count-aware
 * version powers drag-to-add on the table rails and the border "+" buttons.
 */
export function insertColumnsAt(
  editor: Editor,
  tableEl: HTMLTableElement,
  index: number,
  count: number
): boolean {
  if (count <= 0) return false
  return runTableOp(editor, tableEl, (geo, tr) => {
    let caret: number | null = null
    for (let r = geo.rows.length - 1; r >= 0; r -= 1) {
      const row = geo.rows[r]
      if (row.cells.length === 0) continue
      const at = Math.min(Math.max(index, 0), row.cells.length)
      const anchor = row.cells[at] ?? row.cells[row.cells.length - 1]
      if (!anchor) continue
      const base = at < row.cells.length ? anchor.pos : anchor.pos + anchor.node.nodeSize
      for (let k = 0; k < count; k += 1) {
        const cell = anchor.node.type.createAndFill()
        if (!cell) continue
        tr.insert(base + k * cell.nodeSize, cell)
        if (r === 0 && caret === null) caret = base + 1
      }
    }
    return caret
  })
}

/** Inserts one empty column so it lands at `index` (0..width). */
export function insertColumnAt(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return insertColumnsAt(editor, tableEl, index, 1)
}

/**
 * Inserts `count` empty rows in one transaction so the first lands at `index`
 * (0..height). Cell types are copied from the row at the landing spot, so
 * inserting above the header row keeps the header look on the right row.
 */
export function insertRowsAt(
  editor: Editor,
  tableEl: HTMLTableElement,
  index: number,
  count: number
): boolean {
  if (count <= 0) return false
  return runTableOp(editor, tableEl, (geo, tr, schema) => {
    const rowType = schema.nodes.tableRow
    const height = geo.rows.length
    if (!rowType || height === 0) return false
    const template = geo.rows[Math.min(Math.max(index, 0), height - 1)]
    const block: PMNode[] = []
    for (let k = 0; k < count; k += 1) {
      const cells = template.cells
        .map((cell) => cell.node.type.createAndFill())
        .filter((cell): cell is PMNode => cell !== null)
      if (cells.length !== template.cells.length) return false
      block.push(rowType.create(null, cells))
    }
    const at = Math.min(Math.max(index, 0), height)
    const last = geo.rows[height - 1]
    const insertPos = at < height ? geo.rows[at].pos : last.pos + last.node.nodeSize
    tr.insert(insertPos, block)
    return insertPos + 2
  })
}

/** Inserts one empty row so it lands at `index` (0..height). */
export function insertRowAt(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return insertRowsAt(editor, tableEl, index, 1)
}

export function deleteColumnAt(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    if ((geo.rows[0]?.cells.length ?? 0) <= 1) return false
    for (let r = geo.rows.length - 1; r >= 0; r -= 1) {
      const cell = geo.rows[r].cells[index]
      if (cell) tr.delete(cell.pos, cell.pos + cell.node.nodeSize)
    }
    return null
  })
}

export function deleteRowAt(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    if (geo.rows.length <= 1) return false
    const row = geo.rows[index]
    if (!row) return false
    tr.delete(row.pos, row.pos + row.node.nodeSize)
    return null
  })
}

export function duplicateColumnAt(
  editor: Editor,
  tableEl: HTMLTableElement,
  index: number
): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    let caret: number | null = null
    for (let r = geo.rows.length - 1; r >= 0; r -= 1) {
      const cell = geo.rows[r].cells[index]
      if (!cell) continue
      tr.insert(cell.pos + cell.node.nodeSize, cell.node.copy(cell.node.content))
      if (r === 0) caret = cell.pos + cell.node.nodeSize + 1
    }
    return caret
  })
}

export function duplicateRowAt(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    const row = geo.rows[index]
    if (!row) return false
    const clone = row.node.copy(row.node.content)
    tr.insert(row.pos + row.node.nodeSize, clone)
    return row.pos + row.node.nodeSize + 2
  })
}

/** Empties every cell of a column, keeping widths and colors. */
export function clearColumnAt(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    const targets: CellRef[] = []
    geo.rows.forEach((row) => {
      const cell = row.cells[index]
      if (cell) targets.push(cell)
    })
    if (targets.length === 0) return false
    targets
      .sort((a, b) => b.pos - a.pos)
      .forEach((cell) => {
        const empty = cell.node.type.createAndFill(cell.node.attrs)
        if (empty)
          tr.replaceWith(cell.pos + 1, cell.pos + 1 + cell.node.content.size, empty.content)
      })
    return null
  })
}

/** Empties every cell of a row, keeping widths and colors. */
export function clearRowAt(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    const row = geo.rows[index]
    if (!row) return false
    ;[...row.cells]
      .sort((a, b) => b.pos - a.pos)
      .forEach((cell) => {
        const empty = cell.node.type.createAndFill(cell.node.attrs)
        if (empty)
          tr.replaceWith(cell.pos + 1, cell.pos + 1 + cell.node.content.size, empty.content)
      })
    return null
  })
}

/**
 * Selects an entire column as a ProseMirror cell selection, so the standard
 * Backspace / Delete rules apply to it (rev 7: Backspace clears the data,
 * Delete removes the column).
 */
export function selectColumnAt(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    const top = geo.rows[0]?.cells[index]
    const bottom = geo.rows[geo.rows.length - 1]?.cells[index]
    if (!top || !bottom) return false
    tr.setSelection(CellSelection.create(tr.doc, top.pos, bottom.pos))
    return null
  })
}

/**
 * Selects an entire row as a ProseMirror cell selection (see selectColumnAt).
 */
export function selectRowAt(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    const row = geo.rows[index]
    const first = row?.cells[0]
    const last = row?.cells[row.cells.length - 1]
    if (!first || !last) return false
    tr.setSelection(CellSelection.create(tr.doc, first.pos, last.pos))
    return null
  })
}

/**
 * Selects the whole table as a ProseMirror cell selection (menu counterpart
 * of the Mod-a shortcut).
 */
export function selectTableAt(editor: Editor, tableEl: HTMLTableElement): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    const first = geo.rows[0]?.cells[0]
    const lastRow = geo.rows[geo.rows.length - 1]
    const last = lastRow?.cells[lastRow.cells.length - 1]
    if (!first || !last) return false
    tr.setSelection(CellSelection.create(tr.doc, first.pos, last.pos))
    return null
  })
}

/**
 * Moves a column to a new slot. `to` is the final index (0..width-1) the
 * column occupies after the move.
 */
export function moveColumnTo(
  editor: Editor,
  tableEl: HTMLTableElement,
  from: number,
  to: number
): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    const width = geo.rows[0]?.cells.length ?? 0
    if (from === to || from < 0 || from >= width || to < 0 || to >= width) return false
    const newRows: PMNode[] = geo.rows.map((row) => {
      const cells = row.cells.map((cell) => cell.node)
      const [moved] = cells.splice(from, 1)
      if (!moved) return row.node
      cells.splice(to, 0, moved)
      return row.node.copy(Fragment.fromArray(cells))
    })
    tr.replaceWith(geo.tablePos + 1, geo.tablePos + 1 + geo.table.content.size, newRows)
    let offset = 0
    newRows[0].forEach((cell, _, i) => {
      if (i === to) setSafeSelection(tr, geo.tablePos + 2 + offset + 1)
      offset += cell.nodeSize
    })
    return null
  })
}

/** Moves a row to a new slot (final index after the move). */
export function moveRowTo(
  editor: Editor,
  tableEl: HTMLTableElement,
  from: number,
  to: number
): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    const height = geo.rows.length
    if (from === to || from < 0 || from >= height || to < 0 || to >= height) return false
    const rows = geo.rows.map((row) => row.node)
    const [moved] = rows.splice(from, 1)
    if (!moved) return false
    rows.splice(to, 0, moved)
    tr.replaceWith(geo.tablePos + 1, geo.tablePos + 1 + geo.table.content.size, rows)
    let offset = geo.tablePos + 1
    for (let i = 0; i < to; i += 1) offset += rows[i].nodeSize
    return offset + 2
  })
}

/** Toggles the header look of one column (every cell th <-> td). */
export function toggleHeaderColumnAt(
  editor: Editor,
  tableEl: HTMLTableElement,
  index: number
): boolean {
  return runTableOp(editor, tableEl, (geo, tr, schema) => {
    const isHeader = geo.rows[0]?.cells[index]?.node.type.name === 'tableHeader'
    const targetType = schema.nodes[isHeader ? 'tableCell' : 'tableHeader']
    if (!targetType) return false
    let touched = 0
    geo.rows.forEach((row) => {
      const cell = row.cells[index]
      if (!cell) return
      tr.setNodeMarkup(cell.pos, targetType, cell.node.attrs)
      touched += 1
    })
    return touched > 0 ? null : false
  })
}

/** Toggles the header look of the first row. */
export function toggleHeaderRowAt(editor: Editor, tableEl: HTMLTableElement): boolean {
  return runTableOp(editor, tableEl, (geo, tr, schema) => {
    const firstRow = geo.rows[0]
    if (!firstRow || firstRow.cells.length === 0) return false
    const isHeader = firstRow.cells[0].node.type.name === 'tableHeader'
    const targetType = schema.nodes[isHeader ? 'tableCell' : 'tableHeader']
    if (!targetType) return false
    firstRow.cells.forEach((cell) => {
      tr.setNodeMarkup(cell.pos, targetType, cell.node.attrs)
    })
    return null
  })
}

export function isHeaderColumnAt(
  editor: Editor,
  tableEl: HTMLTableElement,
  index: number
): boolean {
  const found = resolveTable(editor, tableEl)
  if (!found) return false
  const geo = tableGeometry(found.node, found.pos)
  if (!geo.rows[0]?.cells[index]) return false
  return geo.rows.every(
    (row) => !row.cells[index] || row.cells[index].node.type.name === 'tableHeader'
  )
}

export function isHeaderRowAt(editor: Editor, tableEl: HTMLTableElement): boolean {
  const found = resolveTable(editor, tableEl)
  if (!found) return false
  const geo = tableGeometry(found.node, found.pos)
  const firstRow = geo.rows[0]
  return Boolean(
    firstRow && firstRow.cells.length > 0 && firstRow.cells[0].node.type.name === 'tableHeader'
  )
}

/** Sets the background shade of one column; null clears it. */
export function setColumnShadeAt(
  editor: Editor,
  tableEl: HTMLTableElement,
  index: number,
  shade: string | null
): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    let touched = 0
    geo.rows.forEach((row) => {
      const cell = row.cells[index]
      if (!cell) return
      tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, shade })
      touched += 1
    })
    return touched > 0 ? null : false
  })
}

/** Persists a per-row height (min height of the <tr>); null clears it. */
export function setRowHeightAt(
  editor: Editor,
  tableEl: HTMLTableElement,
  index: number,
  height: number | null
): boolean {
  const value = height === null ? null : Math.round(Math.min(600, Math.max(MIN_ROW_H, height)))
  return runTableOp(editor, tableEl, (geo, tr) => {
    const row = geo.rows[index]
    if (!row) return false
    tr.setNodeMarkup(row.pos, undefined, { ...row.node.attrs, height: value })
    return null
  })
}

/** Persists a column width by writing colwidth on every cell of the column. */
export function setColumnWidthAt(
  editor: Editor,
  tableEl: HTMLTableElement,
  index: number,
  width: number
): boolean {
  const clamped = Math.round(Math.min(640, Math.max(64, width)))
  return runTableOp(editor, tableEl, (geo, tr) => {
    geo.rows.forEach((row) => {
      const cell = row.cells[index]
      if (cell) tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, colwidth: [clamped] })
    })
    return null
  })
}

/** Applies one width to every column; null returns to equal columns. */
export function setUniformColumnWidth(
  editor: Editor,
  tableEl: HTMLTableElement,
  width: number | null
): boolean {
  const value = width === null ? null : [Math.round(Math.min(640, Math.max(64, width)))]
  return runTableOp(editor, tableEl, (geo, tr) => {
    geo.rows.forEach((row) => {
      row.cells.forEach((cell) => {
        tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, colwidth: value })
      })
    })
    return null
  })
}

/** The shared column width, or null when columns are not uniform. */
export function getUniformColumnWidth(editor: Editor, tableEl: HTMLTableElement): number | null {
  const found = resolveTable(editor, tableEl)
  if (!found) return null
  const geo = tableGeometry(found.node, found.pos)
  const widthOf = (cell: CellRef | undefined): number | null => {
    const value = Array.isArray(cell?.node.attrs.colwidth) ? Number(cell.node.attrs.colwidth[0]) : 0
    return Number.isFinite(value) && value > 0 ? value : null
  }
  const reference = widthOf(geo.rows[0]?.cells[0])
  if (reference === null) return null
  const uniform = geo.rows.every((row) => row.cells.every((cell) => widthOf(cell) === reference))
  return uniform ? reference : null
}

/** Updates display options of the table behind `tableEl`. */
export function updateTableOptions(
  editor: Editor,
  tableEl: HTMLTableElement,
  patch: Partial<TableOptionsAttrs>
): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    tr.setNodeMarkup(geo.tablePos, undefined, { ...geo.table.attrs, ...patch })
    return null
  })
}

/** Reads the current display options of the table behind `tableEl`. */
export function getTableOptions(editor: Editor, tableEl: HTMLTableElement): TableOptionsAttrs {
  const found = resolveTable(editor, tableEl)
  return found
    ? readTableOptions(found.node.attrs as Record<string, unknown>)
    : { ...DEFAULT_TABLE_OPTIONS }
}

export function deleteTableAt(editor: Editor, tableEl: HTMLTableElement): boolean {
  return runTableOp(editor, tableEl, (geo, tr) => {
    tr.delete(geo.tablePos, geo.tablePos + geo.table.nodeSize)
    return null
  })
}
