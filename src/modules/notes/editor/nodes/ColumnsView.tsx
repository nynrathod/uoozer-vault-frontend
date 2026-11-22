import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Equal, Trash2 } from 'lucide-react'

const COUNT_CHOICES = [2, 3, 4, 5]
const SNAP_TARGETS = [25, 33, 50, 66, 75]
const SNAP_TOLERANCE = 4
const MIN_COLUMN_WIDTH = 20
const WIDTHS_TOTAL = 100
const HOVER_GRACE_MS = 160 // grace after leaving the wrapper before chrome hides

/* ── Width math (pure) ──────────────────────────────────────────────────── */

/** Equal percent split of `count` tracks; remainder lands on the last ones. */
export function equalWidths(count: number): number[] {
  const n = Math.max(1, Math.floor(count))
  const base = Math.floor(WIDTHS_TOTAL / n)
  const remainder = WIDTHS_TOTAL - base * n
  return Array.from({ length: n }, (_, index) => base + (index >= n - remainder ? 1 : 0))
}

/**
 * Migration: stored widths only count when there is one per column and the
 * sum still lands near 100 — otherwise fall back to an equal split of the
 * actual child count.
 */
export function normalizeWidths(raw: unknown, count: number): number[] {
  if (count <= 0) return []
  const list = Array.isArray(raw) ? raw : []
  const widths: number[] = []
  for (const item of list) {
    if (typeof item === 'number' && Number.isFinite(item) && item > 0) widths.push(item)
  }
  if (widths.length === count) {
    const total = widths.reduce((sum, value) => sum + value, 0)
    if (Math.abs(total - WIDTHS_TOTAL) <= 2) return widths
  }
  return equalWidths(count)
}

/** Parses `data-widths="28,44,28"`; anything malformed migrates instead. */
export function parseWidthsAttribute(raw: string | null): number[] | null {
  if (!raw) return null
  const widths: number[] = []
  for (const part of raw.split(',')) {
    const value = Number(part.trim())
    if (!Number.isFinite(value) || value <= 0 || value > 100) return null
    widths.push(Math.round(value))
  }
  return widths.length > 0 ? widths : null
}

/** Real column count of a parsed `div[data-type="columns"]` element. */
export function columnsChildCountFromElement(element: Element): number {
  const direct = element.querySelectorAll(':scope > [data-type="column"]').length
  if (direct > 0) return direct
  const parsed = Number(element.getAttribute('data-count'))
  return parsed >= 2 && parsed <= 5 ? parsed : 2
}

/** Live drag state: move the pair beside `rule`, clamped to the 20% minimum. */
function withPair(base: number[], rule: number, left: number, right: number): number[] {
  const out = base.slice()
  out[rule] = left
  out[rule + 1] = right
  return out
}

/** Cumulative boundary percents — one per rule (n−1 rules for n columns). */
function cumulativeBoundaries(widths: number[]): number[] {
  const out: number[] = []
  let acc = 0
  for (let index = 0; index < widths.length - 1; index += 1) {
    acc += widths[index]
    out.push(acc)
  }
  return out
}

/** Rounds to integers and forces the sum back to exactly 100. */
function intFitTo100(widths: number[]): number[] {
  const n = widths.length
  if (n === 0) return widths
  const min = Math.min(MIN_COLUMN_WIDTH, Math.floor(WIDTHS_TOTAL / n))
  const out = widths.map((value) => Math.max(min, Math.round(value)))
  let total = out.reduce((sum, value) => sum + value, 0)
  let guard = 0
  while (total !== WIDTHS_TOTAL && guard < 400) {
    guard += 1
    let widest = 0
    for (let index = 1; index < n; index += 1) if (out[index] > out[widest]) widest = index
    if (total > WIDTHS_TOTAL) {
      if (out[widest] <= min) break
      out[widest] -= 1
      total -= 1
    } else {
      out[widest] += 1
      total += 1
    }
  }
  return out
}

/**
 * Release-time snap: only the two columns beside the dragged rule are
 * considered (the live drag never snaps). A width within ±4 of 25/33/50/66/75
 * locks to it; the rounding drift is absorbed by the neighbouring column so
 * the sum stays exactly 100 and nothing drops below the minimum.
 */
export function snapCommitWidths(widths: number[], rule: number): number[] {
  const out = widths.slice()
  const right = rule + 1
  if (right >= out.length) return intFitTo100(out)
  const snapped = [false, false]
  ;[rule, right].forEach((index, side) => {
    const target = SNAP_TARGETS.find((snap) => Math.abs(out[index] - snap) <= SNAP_TOLERANCE)
    if (target !== undefined) {
      out[index] = target
      snapped[side] = true
    }
  })
  const drift = WIDTHS_TOTAL - out.reduce((sum, value) => sum + value, 0)
  if (drift !== 0) {
    let absorb = -1
    if (!snapped[0]) absorb = rule
    else if (!snapped[1]) absorb = right
    else {
      let widest = -Infinity
      for (let index = 0; index < out.length; index += 1) {
        if (index === rule || index === right) continue
        if (out[index] > widest) {
          widest = out[index]
          absorb = index
        }
      }
      if (absorb === -1) absorb = out[rule] >= out[right] ? rule : right
    }
    out[absorb] += drift
  }
  return intFitTo100(out)
}

/* ── The node view ──────────────────────────────────────────────────────── */

function ColumnsViewComponent({
  node,
  editor,
  selected,
  updateAttributes,
  deleteNode,
  getPos,
}: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragRule, setDragRule] = useState<number | null>(null)
  const [liveWidths, setLiveWidths] = useState<number[] | null>(null)
  const leaveTimer = useRef<number | null>(null)
  /* Touch devices render no hover chrome at all (notes.css §12 hides any
     leak; this gate keeps the DOM clean in the first place). Guarded for
     environments without matchMedia (SSR, old jsdom harnesses). */
  const touchUI = useRef(
    typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      (window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches)
  ).current

  const onWrapperEnter = () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    setHovered(true)
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

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.()
      document.body.classList.remove('note-col-resizing')
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const wrapper = wrapperRef.current
      if (wrapper && event.target instanceof Node && wrapper.contains(event.target)) return
      setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const childCount = node.childCount
  const widths = normalizeWidths(node.attrs.widths, childCount)
  const shown = liveWidths ?? widths

  /* The track widths live on THIS wrapper as CSS variables — the React-
     owned element React patches in place (never replaces), so the values
     survive every re-render and notes.css maps them onto whatever tracks
     exist right now. */
  const widthVars: CSSProperties = {}
  for (let index = 0; index < Math.max(childCount, 1); index += 1) {
    ;(widthVars as Record<string, string>)[`--note-col-w-${index}`] = String(shown[index] ?? 1)
  }

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, rule: number) => {
    if (event.button !== 0) return
    const wrapper = wrapperRef.current
    const row = wrapper?.querySelector('[data-node-view-content]')
    const rowWidth = row instanceof HTMLElement ? row.getBoundingClientRect().width : 0
    if (rowWidth <= 0) return
    const base = shown
    if (rule < 0 || rule + 1 >= base.length) return
    event.preventDefault()
    event.stopPropagation()

    const target = event.currentTarget
    const pointerId = event.pointerId
    const startX = event.clientX
    const startLeft = base[rule]
    const startRight = base[rule + 1]
    const pairTotal = startLeft + startRight
    const latest = { left: startLeft, right: startRight }

    const onMove = (moveEvent: PointerEvent) => {
      if (pairTotal < MIN_COLUMN_WIDTH * 2) return
      const deltaPct = ((moveEvent.clientX - startX) / rowWidth) * WIDTHS_TOTAL
      const left = Math.min(
        Math.max(startLeft + deltaPct, MIN_COLUMN_WIDTH),
        pairTotal - MIN_COLUMN_WIDTH
      )
      latest.left = left
      latest.right = pairTotal - left
      setLiveWidths(withPair(base, rule, latest.left, latest.right))
    }
    const finish = (commit: boolean) => {
      cleanup()
      setDragRule(null)
      setLiveWidths(null)
      document.body.classList.remove('note-col-resizing')
      if (commit) {
        updateAttributes({
          widths: snapCommitWidths(withPair(base, rule, latest.left, latest.right), rule),
          count: base.length,
        })
      }
    }
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      finish(true)
    }
    const onCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return
      finish(false)
    }
    const onLost = () => finish(false)
    const cleanup = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onCancel)
      target.removeEventListener('lostpointercapture', onLost)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      dragCleanupRef.current = null
    }

    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      /* capture is a nicety — the drag still works without it */
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onCancel)
    target.addEventListener('lostpointercapture', onLost)
    /* Window fallback so the drag always terminates, even if capture failed. */
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    dragCleanupRef.current = cleanup
    setDragRule(rule)
    setLiveWidths(base.slice())
    document.body.classList.add('note-col-resizing')
  }

  const equalize = () => {
    updateAttributes({ widths: equalWidths(childCount), count: childCount })
  }

  /** Re-lays the block to `count` columns: tail columns merge, new ones start empty. */
  const chooseCount = (count: number) => {
    setMenuOpen(false)
    if (count === childCount) {
      equalize()
      return
    }
    const pos = getPos()
    if (typeof pos !== 'number') return
    const columnType = editor.state.schema.nodes.column
    if (!columnType) return
    const children: PMNode[] = []
    const keep = Math.min(count, childCount)
    for (let index = 0; index < keep; index += 1) children.push(node.child(index))
    if (count < childCount) {
      let merged = Fragment.empty
      for (let index = count - 1; index < childCount; index += 1) {
        merged = merged.append(node.child(index).content)
      }
      const tail =
        merged.childCount > 0 ? columnType.create(null, merged) : columnType.createAndFill()
      if (!tail) return
      children[children.length - 1] = tail
    } else {
      for (let index = childCount; index < count; index += 1) {
        const fresh = columnType.createAndFill()
        if (!fresh) return
        children.push(fresh)
      }
    }
    const next = node.type.create(
      { ...node.attrs, count, widths: equalWidths(count) },
      Fragment.fromArray(children)
    )
    editor.view.dispatch(editor.state.tr.replaceWith(pos, pos + node.nodeSize, next))
  }

  const boundaries = cumulativeBoundaries(shown)
  const chromeVisible = !touchUI && (hovered || selected || pinned || menuOpen) && dragRule === null

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`note-columns note-col-block${dragRule !== null ? 'is-dragging' : ''}`}
      style={widthVars}
      data-count={childCount}
      onMouseEnter={onWrapperEnter}
      onMouseLeave={onWrapperLeave}
    >
      {chromeVisible && (
        <div
          className="note-col-toolbar"
          contentEditable={false}
          onMouseEnter={() => setPinned(true)}
          onMouseLeave={() => setPinned(false)}
        >
          <button
            type="button"
            className="note-col-toolbar-count"
            aria-label={`Column layout — ${childCount} columns`}
            title={`${childCount} columns · Change layout`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="note-col-toolbar-glyph" aria-hidden="true">
              {Array.from({ length: Math.min(childCount, 5) }, (_, index) => (
                <span key={index} className="note-col-toolbar-bar" />
              ))}
            </span>
            <span className="note-col-toolbar-num">{childCount}</span>
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="note-col-toolbar-equal"
            aria-label="Equal widths"
            title="Equal widths"
            onMouseDown={(event) => event.preventDefault()}
            onClick={equalize}
          >
            <Equal className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="note-col-toolbar-delete"
            aria-label="Delete columns"
            title="Delete"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => deleteNode()}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )}
      {chromeVisible && menuOpen && (
        <div className="note-col-menu" contentEditable={false}>
          {COUNT_CHOICES.map((count) => (
            <button
              key={count}
              type="button"
              className={`note-col-menu-item${count === childCount ? 'is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseCount(count)}
            >
              <span className="note-col-menu-bars" aria-hidden="true">
                {Array.from({ length: count }, (_, index) => (
                  <span key={index} className="note-col-menu-bar" />
                ))}
              </span>
              {count} columns
              <span className="note-col-menu-hint" />
            </button>
          ))}
        </div>
      )}
      <NodeViewContent className="note-col-row" />
      {dragRule !== null && boundaries[dragRule] !== undefined && (
        <div
          className="note-col-tooltip"
          contentEditable={false}
          style={{ left: `${boundaries[dragRule]}%` }}
        >
          {shown.map((value) => Math.round(value)).join(' · ')}
        </div>
      )}
      {!touchUI &&
        boundaries.map((boundary, rule) => (
          <div
            key={rule}
            role="separator"
            aria-orientation="vertical"
            className={`note-col-rule${dragRule === rule ? 'is-active' : ''}`}
            style={{ left: `${boundary}%` }}
            contentEditable={false}
            onPointerDown={(event) => startDrag(event, rule)}
          >
            <span className="note-col-handle" aria-hidden="true">
              <svg width="8" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="9" cy="6" r="2" />
                <circle cx="15" cy="6" r="2" />
                <circle cx="9" cy="12" r="2" />
                <circle cx="15" cy="12" r="2" />
                <circle cx="9" cy="18" r="2" />
                <circle cx="15" cy="18" r="2" />
              </svg>
            </span>
          </div>
        ))}
    </NodeViewWrapper>
  )
}

export const ColumnsView = ColumnsViewComponent

export function columnsNodeView() {
  return ReactNodeViewRenderer(ColumnsViewComponent)
}
