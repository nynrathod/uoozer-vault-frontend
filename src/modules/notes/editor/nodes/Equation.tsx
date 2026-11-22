import { useEffect, useRef, useState } from 'react'
import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

const DEFAULT_FORMULA = 'a² + b² = c²'

function EquationView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const formula = String(node.attrs.formula ?? '')
  const [open, setOpen] = useState(formula.trim() === '')
  const [draft, setDraft] = useState(formula)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Autosize the input to its content while typing, and focus it whenever
  // the editor opens (insert auto-open AND later click edits).
  useEffect(() => {
    const area = inputRef.current
    if (!area || !open) return
    area.style.height = 'auto'
    area.style.height = `${Math.max(34, area.scrollHeight + 2)}px`
    area.focus()
  }, [open, draft])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) save()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save is stable enough for this scope
  }, [open, draft])

  const save = () => {
    setOpen(false)
    const text = draft.trim()
    if (text !== formula.trim()) {
      if (!text) {
        deleteNode()
        return
      }
      updateAttributes({ formula: text })
    }
  }

  if (open) {
    return (
      <NodeViewWrapper className="note-equation note-equation-editor" as="div">
        <div className="note-equation-pop" contentEditable={false} ref={rootRef}>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            placeholder="e.g. a^2 + b^2 = c^2"
            aria-label="Equation formula"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                save()
              }
            }}
          />
          <div className="note-equation-pop-foot">
            <button type="button" className="note-equation-btn is-primary" onClick={save}>
              Done
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      className="note-equation"
      as="div"
      title="Click to edit"
      onClick={() => {
        setDraft(formula)
        setOpen(true)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event: ReactKeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setDraft(formula)
          setOpen(true)
        }
      }}
    >
      <span className="note-equation-formula">{formula || DEFAULT_FORMULA}</span>
    </NodeViewWrapper>
  )
}

export const Equation = TiptapNode.create({
  name: 'equation',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      formula: { default: DEFAULT_FORMULA },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-equation]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-equation': '', class: 'note-equation' }),
      node.attrs.formula,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(EquationView)
  },
})
