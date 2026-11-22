import { mergeAttributes, Node } from '@tiptap/core'
import { FileText } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { noteUiBus } from '../../bus'

function ChildPageView({ node }: NodeViewProps) {
  const label = String(node.attrs.label || 'Untitled page')
  const noteId = typeof node.attrs.noteId === 'string' ? node.attrs.noteId : null

  return (
    <NodeViewWrapper
      className="note-childpage"
      role="button"
      tabIndex={0}
      title="Open page"
      onClick={() => noteUiBus.emit({ type: 'note.open', noteId: noteId ?? undefined, label })}
      onKeyDown={(event: ReactKeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          noteUiBus.emit({ type: 'note.open', noteId: noteId ?? undefined, label })
        }
      }}
      contentEditable={false}
    >
      <FileText className="text-ghost h-[17px] w-[17px] shrink-0" strokeWidth={1.6} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </NodeViewWrapper>
  )
}

export const ChildPage = Node.create({
  name: 'childPage',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      label: { default: 'Untitled page' },
      noteId: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-child-page]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-child-page': '',
        class: 'note-childpage',
      }),
      node.attrs.label,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ChildPageView)
  },
})
