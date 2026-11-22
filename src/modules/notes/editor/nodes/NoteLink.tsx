import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { noteUiBus } from '../../bus'

function NoteLinkView({ node }: NodeViewProps) {
  const label = String(node.attrs.label || 'Untitled')
  const excerpt = String(node.attrs.excerpt || '')
  const noteId = typeof node.attrs.noteId === 'string' ? node.attrs.noteId : null

  const open = () => noteUiBus.emit({ type: 'note.open', noteId: noteId ?? undefined, label })

  return (
    <NodeViewWrapper
      className="note-notelink"
      contentEditable={false}
      role="button"
      tabIndex={0}
      title="Open linked note"
      onClick={open}
      onKeyDown={(event: ReactKeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }}
    >
      <span className="note-notelink-tile" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </span>
      <span className="note-notelink-body">
        <span className="note-notelink-title">{label}</span>
        {excerpt && <span className="note-notelink-excerpt">{excerpt}</span>}
      </span>
    </NodeViewWrapper>
  )
}

export const NoteLink = TiptapNode.create({
  name: 'noteLink',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      label: { default: 'Untitled' },
      noteId: { default: null },
      excerpt: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-note-link]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-note-link': '', class: 'note-notelink' }),
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(NoteLinkView)
  },
})
