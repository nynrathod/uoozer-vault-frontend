import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { mergeAttributes, Node } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

export const STICKY_COLORS = ['yellow', 'pink', 'blue', 'green', 'lilac'] as const
export type StickyColor = (typeof STICKY_COLORS)[number]

function nextColor(current: string): StickyColor {
  const index = STICKY_COLORS.indexOf(current as StickyColor)
  return STICKY_COLORS[(index + 1) % STICKY_COLORS.length] ?? 'yellow'
}

function StickyNoteView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const [textFocused, setTextFocused] = useState(false)
  const everFocusedRef = useRef(false)
  const color = STICKY_COLORS.includes(node.attrs.color as StickyColor)
    ? (node.attrs.color as StickyColor)
    : 'yellow'
  const text = String(node.attrs.text ?? '')

  /* The textarea must be INVISIBLE to ProseMirror. React's synthetic
     stopPropagation runs too late (ProseMirror listens natively on the
     editor root), so native capture listeners below stop every event PM
     would otherwise act on — a mousedown that reaches PM calls
     preventDefault and the caret never appears inside the card.
     `input` is deliberately NOT stopped: React's controlled onChange
     depends on it. */
  useEffect(() => {
    const area = textRef.current
    if (!area) return undefined
    const events = [
      'pointerdown',
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'keydown',
      'keyup',
      'beforeinput',
      'compositionstart',
      'compositionupdate',
      'compositionend',
      'paste',
      'drop',
      'dragstart',
    ]
    const stop = (event: Event) => event.stopPropagation()
    for (const name of events) area.addEventListener(name, stop, true)
    return () => {
      for (const name of events) area.removeEventListener(name, stop, true)
    }
  }, [])

  /* FIRST-CREATE caret (the reported bug: after inserting a sticky the
     card shows but the caret only appears on the second visit). When the
     sticky is inserted the editor selection sits ON this node, and PM may
     still be settling — the node view can even be re-created a frame
     later, silently dropping the focus. So: on mount, when PM holds a
     NodeSelection at THIS node, focus the textarea on the next TWO frames
     (a second rAF after the remount settles) plus one timeout fallback.
     `everFocusedRef` keeps it a once-per-instance, first-create-only
     effect — later mounts (note switch, undo) never steal focus. */
  useEffect(() => {
    if (everFocusedRef.current) return
    const area = textRef.current
    if (!area) return
    let isOurs = false
    try {
      const ourPos = typeof getPos === 'function' ? getPos() : null
      const sel = editor?.state.selection
      isOurs = typeof ourPos === 'number' && sel instanceof NodeSelection && sel.from === ourPos
    } catch {
      isOurs = false
    }
    if (!isOurs) return
    const focus = () => {
      if (!area.isConnected || everFocusedRef.current) return
      everFocusedRef.current = true
      area.focus({ preventScroll: true })
      const end = area.value.length
      area.setSelectionRange(end, end)
    }
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(focus)
    })
    const fallback = window.setTimeout(focus, 90)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first-create only
  }, [])

  /* ⌘L / Ctrl+L cycles the color while the sticky is selected OR its
     textarea is focused (Interaction spec — the card is the input).
     CAPTURE phase at the window: the textarea stops keydown propagation
     at the React root (so ProseMirror never parses the typing), and only
     a capture listener on the window still sees those events. */
  useEffect(() => {
    if (!selected && !textFocused) return undefined
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        event.stopPropagation()
        updateAttributes({ color: nextColor(color) })
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [selected, textFocused, color, updateAttributes])

  /* Stop the editor from ever seeing keystrokes / clicks inside the
     textarea — capture phase, so ProseMirror's bubble listeners on the
     editor root never fire and the card types like a plain textarea.
     The FIRST press also focuses the textarea on the next frame: PM may
     still be settling its selection from the insertion click, and without
     this the caret would only appear on the second click. */
  const stop = (event: { stopPropagation(): void }) => event.stopPropagation()

  /* Belt-and-braces focus for EVERY press (not just the first): two rAFs
     so PM has fully settled its selection from the insertion click, plus
     a timeout fallback for browsers that drop a rAF mid-composition. The
     double call is harmless — the same element, caret at the end. */
  const focusOnPress = () => {
    const area = textRef.current
    if (!area) return
    const doFocus = () => {
      if (!area.isConnected) return
      everFocusedRef.current = true
      area.focus({ preventScroll: true })
      const end = area.value.length
      area.setSelectionRange(end, end)
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(doFocus)
    })
    window.setTimeout(doFocus, 60)
  }

  return (
    <NodeViewWrapper
      className="note-sticky"
      data-color={color}
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        stop(event)
        focusOnPress()
      }}
    >
      <button
        type="button"
        className="note-sticky-dot"
        contentEditable={false}
        aria-label="Change sticky color"
        title="Change color (⌘L)"
        onPointerDown={stop}
        onClick={() => updateAttributes({ color: nextColor(color) })}
      >
        ●
      </button>
      <textarea
        ref={textRef}
        className="note-sticky-text"
        value={text}
        placeholder="Write…"
        aria-label="Sticky note text"
        spellCheck={false}
        onKeyDownCapture={stop}
        onKeyUpCapture={stop}
        onFocus={() => setTextFocused(true)}
        onBlur={() => setTextFocused(false)}
        onChange={(event) => updateAttributes({ text: event.target.value })}
      />
    </NodeViewWrapper>
  )
}

export const StickyNote = Node.create({
  name: 'sticky',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      text: { default: '' },
      color: { default: 'yellow' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-sticky]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-sticky': '',
        'data-color': node.attrs.color,
        class: 'note-sticky',
      }),
      node.attrs.text,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(StickyNoteView)
  },
})
