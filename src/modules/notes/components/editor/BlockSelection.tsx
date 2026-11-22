import { useEffect, useRef, useState } from 'react'
import { TextSelection } from '@tiptap/pm/state'
import { useNoteEditor } from '../../editor/NoteEditorProvider'
import { MODULE_NODE_TYPES, blockElements, blockSpanAt, hitBlock, proseDom } from './BlockHandle'

interface OverlayRect {
  top: number
  left: number
  width: number
  height: number
}

/** A live block-range selection: top-level child indexes [from, to). */
interface BlockRange {
  from: number
  to: number
}

export function BlockSelection() {
  const editor = useNoteEditor()
  const [rects, setRects] = useState<OverlayRect[] | null>(null)
  const rangeRef = useRef<BlockRange | null>(null)
  const dragRef = useRef<{
    anchor: number
    pointerId: number
    moved: boolean
  } | null>(null)

  /* ── rect measurement ─────────────────────────────────────────────────── */
  const measure = () => {
    const range = rangeRef.current
    if (!editor || editor.isDestroyed || !range) {
      setRects((current) => (current === null ? current : null))
      return
    }
    const prose = proseDom(editor)
    if (!prose) {
      setRects((current) => (current === null ? current : null))
      return
    }
    const blocks = blockElements(prose)
    const out: OverlayRect[] = []
    for (let index = range.from; index < Math.min(range.to, blocks.length); index += 1) {
      const rect = blocks[index]?.getBoundingClientRect()
      if (rect && rect.height > 0) {
        out.push({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
      }
    }
    setRects(out.length > 0 ? out : null)
  }

  const setRange = (range: BlockRange | null) => {
    rangeRef.current = range
    if (range) {
      document.body.classList.add('note-blocksel-active')
      measure()
    } else {
      document.body.classList.remove('note-blocksel-active')
      setRects((current) => (current === null ? current : null))
    }
  }

  /* Keep the overlay glued to the blocks while anything moves. */
  useEffect(() => {
    if (!editor) return
    const onTransaction = () => {
      if (!rangeRef.current) return
      const { from, to } = editor.state.selection
      const range = rangeRef.current
      // A user action that moved the caret out of the range dissolves it.
      const prose = proseDom(editor)
      const blocks = prose ? blockElements(prose) : []
      let spansBlocks = false
      if (blocks.length > 0) {
        let first = -1
        let last = -1
        let offset = 0
        editor.state.doc.forEach((node, nodeOffset, index) => {
          const end = nodeOffset + node.nodeSize
          if (from >= nodeOffset && from < end) first = index
          if (to > nodeOffset && to <= end) last = index
          offset = end
        })
        void offset
        spansBlocks = first !== -1 && last !== -1 && first !== last
      }
      if (!spansBlocks) {
        setRange(null)
        return
      }
      if (range) measure()
    }
    const onScrollOrResize = () => {
      if (rangeRef.current) measure()
    }
    editor.on('transaction', onTransaction)
    editor.on('selectionUpdate', onTransaction)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      editor.off('transaction', onTransaction)
      editor.off('selectionUpdate', onTransaction)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measure/setRange close over editor only
  }, [editor])

  /* ── pointer + keyboard behaviour ─────────────────────────────────────── */
  useEffect(() => {
    if (!editor) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (document.body.classList.contains('note-dragging-active')) return
      const prose = proseDom(editor)
      if (!prose) return
      const target = event.target as Element
      const insideProse = prose.contains(event.target as Node)
      /* The drag may START on the note canvas's empty space around the
         editor (margins/gutter) — exactly how Notion grabs a block range
         from outside the text column. Anything outside the canvas (sidebar,
         header, dialogs) still opts out. */
      if (!insideProse && !target.closest?.('.note-canvas, .note-surface')) return
      // Widgets own their pointers (table resize, media menus, callout tone…).
      if (target.closest('[contenteditable="false"]')) return
      const rect = prose.getBoundingClientRect()
      const blocks = blockElements(prose)
      const hit = hitBlock(blocks, event.clientY)
      let anchor: number
      if (hit) {
        anchor = hit.index
      } else {
        // Above every block → the first; below every block → the last.
        const firstTop = blocks[0]?.getBoundingClientRect().top ?? 0
        anchor = event.clientY < firstTop ? 0 : Math.max(0, blocks.length - 1)
      }
      if (anchor >= blocks.length) anchor = Math.max(0, blocks.length - 1)
      // Inside the text column, keep the horizontal guard; from the empty
      // space any horizontal position within the canvas is fair game.
      if (insideProse) {
        if (event.clientX < rect.left || event.clientX > rect.right + 16) return
      }
      dragRef.current = { anchor, pointerId: event.pointerId, moved: false }
    }

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const prose = proseDom(editor)
      if (!prose) return
      const blocks = blockElements(prose)
      if (blocks.length === 0) return
      const hit = hitBlock(blocks, event.clientY)
      const head = hit
        ? Math.min(hit.index, blocks.length - 1)
        : event.clientY < (blocks[0]?.getBoundingClientRect().top ?? 0)
          ? 0
          : blocks.length - 1
      if (head === drag.anchor) {
        if (drag.moved) setRange(null)
        return
      }
      drag.moved = true
      const from = Math.min(drag.anchor, head)
      const to = Math.max(drag.anchor, head) + 1
      // Suppress the native text highlight while dragging across blocks.
      try {
        window.getSelection()?.removeAllRanges()
      } catch {
        /* not fatal */
      }
      setRange({ from, to })
    }

    const finishDrag = (commit: boolean) => {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag) return
      const range = rangeRef.current
      if (!commit || !range || !drag.moved) return
      // Select the span in the editor so copy/delete act on the blocks.
      try {
        const start = blockSpanAt(editor, range.from)
        const end = blockSpanAt(editor, range.to - 1)
        if (start && end) {
          const tr = editor.state.tr
          tr.setSelection(
            TextSelection.create(
              editor.state.doc,
              Math.min(start.from + 1, start.to - 1),
              end.to - 1
            )
          )
          editor.view.dispatch(tr)
          editor.view.focus()
        }
      } catch {
        /* selection could not be created — the overlay stays, keys still work */
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) finishDrag(true)
    }
    const onPointerCancel = () => finishDrag(false)

    const onKeyDown = (event: KeyboardEvent) => {
      // ⌘/Ctrl+A — Notion's expanding select-all:
      //   1st press inside a text block → select THAT block's text (the
      //   native light-blue highlight);
      //   2nd press (the block is already fully selected) → every block,
      //   the same soft-blue page overlay.
      // Inside a MODULE BlockHandle selects that module instead.
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'a' &&
        !event.shiftKey &&
        !event.altKey
      ) {
        try {
          if (editor.isDestroyed) return
          const state = editor.state
          const from = state.selection.from
          let insideModule = false
          state.doc.forEach((node, offset) => {
            if (
              from >= offset &&
              from < offset + node.nodeSize &&
              MODULE_NODE_TYPES.has(node.type.name)
            ) {
              insideModule = true
            }
          })
          if (insideModule) return // BlockHandle owns this case
          const prose = proseDom(editor)
          if (!prose) return
          event.preventDefault()
          // The top-level block under the caret — its inner text span.
          let blockSpan: { from: number; to: number } | null = null
          let offset = 0
          for (let index = 0; index < state.doc.childCount; index += 1) {
            const node = state.doc.child(index)
            const end = offset + node.nodeSize
            if (from >= offset && from < end) {
              blockSpan = { from: node.isLeaf ? offset : offset + 1, to: end - 1 }
            }
            offset = end
          }
          const sel = state.selection
          const alreadyBlock =
            blockSpan !== null && sel.from <= blockSpan.from && sel.to >= blockSpan.to
          const tr = state.tr
          if (blockSpan && !alreadyBlock) {
            tr.setSelection(
              TextSelection.create(
                state.doc,
                blockSpan.from,
                Math.max(blockSpan.from, blockSpan.to)
              )
            )
          } else {
            tr.setSelection(TextSelection.create(state.doc, 1, state.doc.content.size))
          }
          editor.view.dispatch(tr)
          editor.view.focus()
          if (!(blockSpan && !alreadyBlock)) {
            setRange({ from: 0, to: editor.state.doc.childCount })
          } else {
            setRange(null)
          }
        } catch {
          /* fall back to the native select-all */
        }
        return
      }
      if (!rangeRef.current) return
      if (event.key === 'Escape') {
        event.preventDefault()
        setRange(null)
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        const range = rangeRef.current
        setRange(null)
        try {
          const start = blockSpanAt(editor, range.from)
          const end = blockSpanAt(editor, range.to - 1)
          if (start && end) {
            editor.view.dispatch(editor.state.tr.delete(start.from, end.to))
          }
        } catch {
          /* the doc moved under us; nothing to delete */
        }
      } else if (event.key.startsWith('Arrow')) {
        setRange(null)
      }
    }

    const onDocMouseDown = (event: MouseEvent) => {
      if (!rangeRef.current) return
      const prose = proseDom(editor)
      if (prose && prose.contains(event.target as Node)) return
      setRange(null)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointercancel', onPointerCancel, true)
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', onPointerCancel, true)
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKeyDown)
      setRange(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setRange closes over editor only
  }, [editor])

  if (!editor) return null

  return (
    <>
      {rects?.map((rect, index) => (
        <div
          key={`${index}-${rect.top}`}
          className="note-blocksel-ovl"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden="true"
        />
      ))}
    </>
  )
}
