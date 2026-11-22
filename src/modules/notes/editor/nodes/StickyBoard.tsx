import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Copy,
  Image as ImageIcon,
  ListTodo,
  Plus,
  Sparkle,
  SquareDashed,
  Trash2,
  Type,
} from 'lucide-react'
import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { noteUiBus } from '../../bus'

export type StickyBoardColor = 'yellow' | 'pink' | 'blue' | 'green' | 'lilac'

/** One sticky on the wall. Geometry is in board-canvas pixels. */
export interface StickyBoardItem {
  id: string
  x: number
  y: number
  w: number
  h: number
  color: StickyBoardColor
  text: string
  rotation: number
  /** Cluster id this sticky belongs to (reserved; membership not enforced). */
  cluster?: string | null
}

/** A dashed group region with a label pill on its top-left edge. */
export interface StickyBoardCluster {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
}

const STICKY_COLORS: readonly StickyBoardColor[] = ['yellow', 'pink', 'blue', 'green', 'lilac']

/* Sheet dimensions (Note-H): stickies 220×150, cluster region 600×228. */
const STICKY_W = 220
const STICKY_H = 150
const CLUSTER_W = 600
const CLUSTER_H = 228
const BOARD_MIN_HEIGHT = 520
/** Bottom strip the add-palette floats over — free-spot search stays above it. */
const PALETTE_ZONE = 96
/** Alternating sheet rotations: -2deg, 1.5deg. */
const ROTATIONS: readonly number[] = [-2, 1.5]

/** Starter copy per palette flavor (schema has no flavor field — text only). */
type StickyFlavor = 'plain' | 'text' | 'checklist' | 'image'
const FLAVOR_TEXT: Record<StickyFlavor, string> = {
  plain: '',
  text: '',
  checklist: '☐ ',
  image: '🖼 ',
}

let boardIdSeed = 0
function newBoardId(): string {
  boardIdSeed += 1
  return `sb-${Date.now().toString(36)}-${boardIdSeed.toString(36)}`
}

/* ── Attr coercion — bad JSON can never crash the canvas ─────────────────── */

function coerceColor(value: unknown): StickyBoardColor {
  return typeof value === 'string' && (STICKY_COLORS as readonly string[]).includes(value)
    ? (value as StickyBoardColor)
    : 'yellow'
}

export function toStickyItems(value: unknown): StickyBoardItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw): StickyBoardItem[] => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Partial<StickyBoardItem>
    if (typeof item.id !== 'string' || item.id === '') return []
    return [
      {
        id: item.id,
        x: Number(item.x) || 0,
        y: Number(item.y) || 0,
        w: Number(item.w) || STICKY_W,
        h: Number(item.h) || STICKY_H,
        color: coerceColor(item.color),
        text: typeof item.text === 'string' ? item.text : '',
        rotation: typeof item.rotation === 'number' ? item.rotation : (ROTATIONS[0] ?? -2),
        cluster: typeof item.cluster === 'string' ? item.cluster : null,
      },
    ]
  })
}

export function toStickyClusters(value: unknown): StickyBoardCluster[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw): StickyBoardCluster[] => {
    if (!raw || typeof raw !== 'object') return []
    const cluster = raw as Partial<StickyBoardCluster>
    if (typeof cluster.id !== 'string' || cluster.id === '') return []
    return [
      {
        id: cluster.id,
        x: Number(cluster.x) || 0,
        y: Number(cluster.y) || 0,
        w: Number(cluster.w) || CLUSTER_W,
        h: Number(cluster.h) || CLUSTER_H,
        label: typeof cluster.label === 'string' ? cluster.label : 'Group',
      },
    ]
  })
}

export function stickyCountLabel(count: number): string {
  return count === 1 ? '1 sticky' : `${count} stickies`
}

/** Starter wall for /sticky-board: two tilted stickies, like the sheet. */
export function stickyBoardSeed(): { items: StickyBoardItem[]; clusters: StickyBoardCluster[] } {
  return {
    items: [
      {
        id: newBoardId(),
        x: 24,
        y: 20,
        w: STICKY_W,
        h: STICKY_H,
        color: 'yellow',
        text: 'Share links that expire on their own',
        rotation: ROTATIONS[0] ?? -2,
        cluster: null,
      },
      {
        id: newBoardId(),
        x: 288,
        y: 84,
        w: STICKY_W,
        h: STICKY_H,
        color: 'pink',
        text: 'Safe mode switch in the editor',
        rotation: ROTATIONS[1] ?? 1.5,
        cluster: null,
      },
    ],
    clusters: [],
  }
}

/* ── Placement helpers ────────────────────────────────────────────────────── */

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** First free top-left spot on a 24px scan; falls back below everything. */
function findFreeSpot(
  items: StickyBoardItem[],
  clusters: StickyBoardCluster[],
  w: number,
  h: number,
  canvasWidth: number,
  boardHeight: number
): { x: number; y: number } {
  const step = 24
  const maxX = Math.max(8, canvasWidth - w - 8)
  const maxY = Math.max(8, boardHeight - h - PALETTE_ZONE)
  for (let y = 8; y <= maxY; y += step) {
    for (let x = 8; x <= maxX; x += step) {
      const box = { x, y, w, h }
      const hitsItem = items.some((item) => rectsOverlap(box, item))
      const hitsCluster = clusters.some((cluster) => rectsOverlap(box, cluster))
      if (!hitsItem && !hitsCluster) return { x, y }
    }
  }
  let bottom = 0
  items.forEach((item) => {
    bottom = Math.max(bottom, item.y + item.h)
  })
  clusters.forEach((cluster) => {
    bottom = Math.max(bottom, cluster.y + cluster.h)
  })
  return { x: 8, y: bottom + 24 }
}

/* ── Editable sticky text — uncontrolled while typing, committed on blur ─── */

function StickyTextLayer({
  item,
  onSelect,
  onCommit,
}: {
  item: StickyBoardItem
  onSelect: (id: string) => void
  onCommit: (id: string, text: string) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  // Sync DOM from attrs only while the layer is not being edited, so typing
  // never fights the node-view re-render (attrs commit on blur).
  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if (el.textContent !== item.text) el.textContent = item.text
  }, [item.text])

  /* The edit layer must be INVISIBLE to ProseMirror: React's synthetic
     stopPropagation runs after PM's native listeners on the editor root,
     and a native mousedown that reaches PM preventDefaults — the caret
     never shows. Native capture listeners on the layer itself stop the
     event before it ever leaves the card, and handle select / Escape
     natively (React handlers can't fire — the native event never reaches
     the React root). The commit still happens through React's onBlur,
     which is not stopped. */
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const stop = (event: Event) => event.stopPropagation()
    const onPointer = (event: PointerEvent) => {
      event.stopPropagation()
      onSelectRef.current(item.id)
    }
    const onKey = (event: KeyboardEvent) => {
      event.stopPropagation()
      if (event.key === 'Escape') el.blur()
    }
    const events = [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'keyup',
      'beforeinput',
      'compositionstart',
      'compositionupdate',
      'compositionend',
      'paste',
      'drop',
      'dragstart',
    ]
    el.addEventListener('pointerdown', onPointer, true)
    el.addEventListener('keydown', onKey, true)
    for (const name of events) el.addEventListener(name, stop, true)
    return () => {
      el.removeEventListener('pointerdown', onPointer, true)
      el.removeEventListener('keydown', onKey, true)
      for (const name of events) el.removeEventListener(name, stop, true)
    }
  }, [item.id])

  return (
    <div
      ref={ref}
      className="note-sb-sticky-text"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      aria-label="Sticky text"
      onBlur={(event) => onCommit(item.id, event.currentTarget.textContent ?? '')}
    />
  )
}

/* ── The board node view ──────────────────────────────────────────────────── */

interface DragState {
  id: string
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

function StickyBoardView({ node, editor, getPos, updateAttributes }: NodeViewProps) {
  const items = useMemo(() => toStickyItems(node.attrs.items), [node.attrs.items])
  const clusters = useMemo(() => toStickyClusters(node.attrs.clusters), [node.attrs.clusters])

  const canvasRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ id: string; dx: number; dy: number } | null>(null)

  const selectedItem = items.find((item) => item.id === selectedId) ?? null

  /* Render reads the memoized attrs; every mutation re-reads the node from
     ProseMirror state first, so back-to-back writes (e.g. text blur →
     toolbar click) can never clobber each other with stale arrays. */
  const readNodeAttrs = useCallback((): {
    items: StickyBoardItem[]
    clusters: StickyBoardCluster[]
  } => {
    const pos = typeof getPos === 'function' ? getPos() : undefined
    const current = typeof pos === 'number' ? editor.state.doc.nodeAt(pos) : null
    return {
      items: toStickyItems(current ? current.attrs.items : node.attrs.items),
      clusters: toStickyClusters(current ? current.attrs.clusters : node.attrs.clusters),
    }
  }, [editor, getPos, node])

  const commitItems = (next: StickyBoardItem[]) => updateAttributes({ items: next })

  /* Delete key removes the selected sticky; Esc deselects. Capture phase so
     ProseMirror's own keymap never deletes the whole board node instead. */
  useEffect(() => {
    if (selectedId === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const inTextField =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (event.key === 'Escape') {
        if (target instanceof HTMLElement && target.isContentEditable) target.blur()
        setSelectedId(null)
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !inTextField) {
        event.preventDefault()
        event.stopPropagation()
        updateAttributes({
          items: readNodeAttrs().items.filter((item) => item.id !== selectedId),
        })
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [selectedId, readNodeAttrs, updateAttributes])

  const beginStickyDrag = (event: ReactPointerEvent<HTMLDivElement>, item: StickyBoardItem) => {
    if (event.button !== 0) return
    // preventDefault suppresses the compatibility mouse events, so the
    // editor never starts an HTML5 node-drag — this board moves on pointers.
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(item.id)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer already released — the move/up handlers simply no-op.
    }
    dragRef.current = {
      id: item.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: item.x,
      originY: item.y,
      moved: false,
    }
  }

  const moveStickyDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    if (!state || state.pointerId !== event.pointerId) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    if (!state.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return
    state.moved = true
    setDragOffset({ id: state.id, dx, dy })
  }

  const endStickyDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    dragRef.current = null
    setDragOffset(null)
    if (!state || state.pointerId !== event.pointerId || !state.moved) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    commitItems(
      readNodeAttrs().items.map((entry) =>
        entry.id === state.id
          ? {
              ...entry,
              // Keep the 8px selection handles inside the canvas.
              x: Math.max(8, state.originX + dx),
              y: Math.max(8, state.originY + dy),
            }
          : entry
      )
    )
  }

  const commitStickyText = (id: string, text: string) => {
    commitItems(readNodeAttrs().items.map((item) => (item.id === id ? { ...item, text } : item)))
  }

  const recolorSticky = (id: string, color: StickyBoardColor) => {
    commitItems(readNodeAttrs().items.map((item) => (item.id === id ? { ...item, color } : item)))
  }

  const duplicateSticky = (item: StickyBoardItem) => {
    const copy: StickyBoardItem = {
      ...item,
      id: newBoardId(),
      x: item.x + 24,
      y: item.y + 24,
    }
    commitItems([...readNodeAttrs().items, copy])
    setSelectedId(copy.id)
  }

  const removeSticky = (id: string) => {
    commitItems(readNodeAttrs().items.filter((item) => item.id !== id))
    setSelectedId(null)
  }

  const addSticky = (flavor: StickyFlavor) => {
    const fresh = readNodeAttrs()
    const canvasWidth = canvasRef.current?.clientWidth ?? 900
    const spot = findFreeSpot(
      fresh.items,
      fresh.clusters,
      STICKY_W,
      STICKY_H,
      canvasWidth,
      boardHeight
    )
    const next: StickyBoardItem = {
      id: newBoardId(),
      x: spot.x,
      y: spot.y,
      w: STICKY_W,
      h: STICKY_H,
      color: STICKY_COLORS[fresh.items.length % STICKY_COLORS.length] ?? 'yellow',
      text: FLAVOR_TEXT[flavor],
      rotation: ROTATIONS[fresh.items.length % ROTATIONS.length] ?? ROTATIONS[0] ?? -2,
      cluster: null,
    }
    commitItems([...fresh.items, next])
    setSelectedId(next.id)
  }

  const addCluster = () => {
    const fresh = readNodeAttrs()
    const canvasWidth = canvasRef.current?.clientWidth ?? 900
    const width = Math.min(CLUSTER_W, Math.max(260, canvasWidth - 24))
    const spot = findFreeSpot(
      fresh.items,
      fresh.clusters,
      width,
      CLUSTER_H,
      canvasWidth,
      boardHeight
    )
    const next: StickyBoardCluster = {
      id: newBoardId(),
      x: spot.x,
      y: spot.y,
      w: width,
      h: CLUSTER_H,
      label: 'New group',
    }
    updateAttributes({ clusters: [...fresh.clusters, next] })
  }

  const askAi = () => noteUiBus.emit({ type: 'assistant.open' })

  /* Board height grows with content (and live drag) so the canvas never
     scrolls vertically and the palette always floats over free space. */
  const bottomLimit = useMemo(() => {
    let bottom = 0
    items.forEach((item) => {
      bottom = Math.max(bottom, item.y + item.h)
    })
    clusters.forEach((cluster) => {
      bottom = Math.max(bottom, cluster.y + cluster.h)
    })
    return bottom
  }, [items, clusters])
  const dragBottom = useMemo(() => {
    if (!dragOffset) return 0
    const dragged = items.find((item) => item.id === dragOffset.id)
    if (!dragged) return 0
    return dragged.y + dragOffset.dy + dragged.h
  }, [dragOffset, items])
  const boardHeight = Math.max(
    BOARD_MIN_HEIGHT,
    bottomLimit + PALETTE_ZONE,
    dragBottom + PALETTE_ZONE
  )

  const offsetFor = (item: StickyBoardItem) =>
    dragOffset && dragOffset.id === item.id
      ? { x: item.x + dragOffset.dx, y: item.y + dragOffset.dy }
      : { x: item.x, y: item.y }

  const canvasWidth = canvasRef.current?.clientWidth ?? 900
  const toolbarLeft = selectedItem
    ? Math.min(
        Math.max(offsetFor(selectedItem).x + selectedItem.w / 2, 110),
        Math.max(110, canvasWidth - 110)
      )
    : 0

  return (
    <NodeViewWrapper className={`note-sb${dragOffset ? 'is-dragging' : ''}`}>
      <div className="note-sb-frame">
        <div className="note-sb-head">
          <span className="note-sb-count">{stickyCountLabel(items.length)}</span>
        </div>

        <div
          ref={canvasRef}
          className="note-sb-canvas"
          style={{ height: boardHeight }}
          onPointerDown={() => setSelectedId(null)}
        >
          {clusters.map((cluster) => (
            <div
              key={cluster.id}
              className="note-sb-cluster"
              style={{ left: cluster.x, top: cluster.y, width: cluster.w, height: cluster.h }}
              contentEditable={false}
            >
              <span className="note-sb-cluster-label">{cluster.label}</span>
            </div>
          ))}

          {items.map((item) => {
            const selected = item.id === selectedId
            const offset = offsetFor(item)
            return (
              <div
                key={item.id}
                className={`note-sb-sticky${selected ? 'is-selected' : ''}${
                  dragOffset?.id === item.id ? 'is-dragging' : ''
                }`}
                data-color={item.color}
                style={{
                  left: offset.x,
                  top: offset.y,
                  width: item.w,
                  height: item.h,
                  transform: `rotate(${item.rotation}deg)`,
                  zIndex: selected ? 30 : 20,
                }}
                onPointerDown={(event) => beginStickyDrag(event, item)}
                onPointerMove={moveStickyDrag}
                onPointerUp={endStickyDrag}
                onPointerCancel={endStickyDrag}
              >
                <StickyTextLayer item={item} onSelect={setSelectedId} onCommit={commitStickyText} />
                {selected && (
                  <>
                    <span className="note-sb-handle note-sb-handle-tl" />
                    <span className="note-sb-handle note-sb-handle-tr" />
                    <span className="note-sb-handle note-sb-handle-bl" />
                    <span className="note-sb-handle note-sb-handle-br" />
                  </>
                )}
              </div>
            )
          })}

          {selectedItem && (
            <div
              className="note-sb-toolbar"
              style={{ left: toolbarLeft, top: Math.max(6, offsetFor(selectedItem).y - 52) }}
              contentEditable={false}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              {STICKY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`note-sb-dot${selectedItem.color === color ? 'is-active' : ''}`}
                  data-color={color}
                  aria-label={`Sticky color ${color}`}
                  aria-pressed={selectedItem.color === color}
                  onClick={() => recolorSticky(selectedItem.id, color)}
                />
              ))}
              <span className="note-sb-toolbar-divider" />
              <button
                type="button"
                className="note-sb-tool"
                aria-label="Duplicate sticky"
                title="Duplicate"
                onClick={() => duplicateSticky(selectedItem)}
              >
                <Copy size={15} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className="note-sb-tool"
                aria-label="Delete sticky"
                title="Delete"
                onClick={() => removeSticky(selectedItem.id)}
              >
                <Trash2 size={15} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>

        <div
          className="note-sb-palette"
          contentEditable={false}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="note-sb-dock">
            <button type="button" className="note-sb-add" onClick={() => addSticky('plain')}>
              <Plus size={15} strokeWidth={2.25} />
              Sticky
            </button>
            <button
              type="button"
              className="note-sb-round"
              aria-label="Add text sticky"
              title="Text"
              onClick={() => addSticky('text')}
            >
              <Type size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="note-sb-round"
              aria-label="Add checklist sticky"
              title="Checklist"
              onClick={() => addSticky('checklist')}
            >
              <ListTodo size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="note-sb-round"
              aria-label="Add image sticky"
              title="Image"
              onClick={() => addSticky('image')}
            >
              <ImageIcon size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="note-sb-round"
              aria-label="Add group region"
              title="Group"
              onClick={addCluster}
            >
              <SquareDashed size={16} strokeWidth={1.75} style={{ strokeDasharray: '3 3' }} />
            </button>
            <span className="note-sb-palette-divider" />
            <button
              type="button"
              className="note-sb-round note-sb-round-ai"
              aria-label="Ask AI about this board"
              title="Ask AI"
              onClick={askAi}
            >
              <Sparkle size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

/* ── The TipTap node ──────────────────────────────────────────────────────── */

export const StickyBoard = Node.create({
  name: 'stickyBoard',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      items: {
        default: [],
        parseHTML: (element) => toStickyItems(element.getAttribute('data-items')),
        renderHTML: (attributes) => ({
          'data-items': JSON.stringify(toStickyItems(attributes.items)),
        }),
      },
      clusters: {
        default: [],
        parseHTML: (element) => toStickyClusters(element.getAttribute('data-clusters')),
        renderHTML: (attributes) => ({
          'data-clusters': JSON.stringify(toStickyClusters(attributes.clusters)),
        }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-sticky-board]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-sticky-board': '', class: 'note-sb' }),
      stickyCountLabel(toStickyItems(node.attrs.items).length),
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(StickyBoardView)
  },
})
