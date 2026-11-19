import { mergeAttributes, Node } from '@tiptap/core'
import { Lock } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'

function CalloutView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper className="note-callout" data-tone={String(node.attrs.tone ?? 'secure')}>
      <Lock className="text-primary mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <NodeViewContent className="note-callout-body" />
    </NodeViewWrapper>
  )
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { tone: { default: 'secure' } }
  },
  parseHTML() {
    return [{ tag: 'aside[data-callout]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },
})
