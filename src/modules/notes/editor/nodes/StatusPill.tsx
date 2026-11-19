import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

function StatusPillView({ node }: NodeViewProps) {
  const tone = String(node.attrs.tone ?? 'planned')
  const toneClass =
    tone === 'progress'
      ? 'bg-primary/10 text-primary'
      : tone === 'done'
        ? 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]'
        : 'bg-secondary text-muted-foreground'
  return (
    <NodeViewWrapper as="span" className={`note-pill ${toneClass}`}>
      {String(node.attrs.label ?? '')}
    </NodeViewWrapper>
  )
}

export const StatusPill = Node.create({
  name: 'statusPill',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      label: { default: 'Planned' },
      tone: { default: 'planned' },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-status-pill]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-status-pill': HTMLAttributes.tone }), HTMLAttributes.label]
  },
  addNodeView() {
    return ReactNodeViewRenderer(StatusPillView)
  },
})
