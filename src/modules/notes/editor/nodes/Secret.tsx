import { useEffect, useRef, useState } from 'react'
import { mergeAttributes, Node } from '@tiptap/core'
import { Eye, EyeOff } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { NOTE_SECRET_AUTOHIDE_MS } from '../../constants'

function SecretView({ node, updateAttributes, selected }: NodeViewProps) {
  const text = String(node.attrs.text ?? '')
  const revealed = Boolean(node.attrs.revealed)
  const [editing, setEditing] = useState(text === '')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!revealed) return
    timerRef.current = window.setTimeout(
      () => updateAttributes({ revealed: false }),
      NOTE_SECRET_AUTOHIDE_MS
    )
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [revealed, updateAttributes])

  const toggle = () => updateAttributes({ revealed: !revealed })

  return (
    <NodeViewWrapper className="note-secret" selected={selected}>
      {revealed ? (
        <Eye className="text-primary h-4 w-4 shrink-0" strokeWidth={1.75} />
      ) : (
        <EyeOff className="text-primary h-4 w-4 shrink-0" strokeWidth={1.75} />
      )}
      <input
        className={`note-secret-text ${revealed ? '' : 'is-hidden'}`}
        value={text}
        placeholder="Type a secret…"
        aria-label="Secret text"
        readOnly={!editing && !revealed}
        onChange={(event) => updateAttributes({ text: event.target.value })}
        onFocus={() => setEditing(true)}
        onMouseDown={(event) => {
          if (!revealed) event.preventDefault()
        }}
      />
      <button
        type="button"
        className="note-secret-btn"
        onClick={toggle}
        contentEditable={false}
        aria-label={revealed ? 'Hide secret' : 'Reveal secret'}
      >
        {revealed ? 'Hide' : 'Reveal'}
      </button>
    </NodeViewWrapper>
  )
}

export const Secret = Node.create({
  name: 'secret',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      text: { default: '' },
      revealed: { default: false },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-secret]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-secret': '', class: 'note-secret' }),
      node.attrs.text,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(SecretView)
  },
})
