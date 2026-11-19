import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

function MediaImageView({ node, updateAttributes }: NodeViewProps) {
  const src = String(node.attrs.src ?? '')
  const caption = String(node.attrs.caption ?? '')
  return (
    <NodeViewWrapper className="note-media">
      {src ? (
        <img src={src} alt={String(node.attrs.alt ?? '')} className="note-media-image" />
      ) : (
        <div className="note-media-fallback">Image unavailable</div>
      )}
      <input
        className="note-caption-input"
        value={caption}
        placeholder="Add a caption..."
        onChange={(event) => updateAttributes({ caption: event.target.value })}
        onMouseDown={(event) => event.stopPropagation()}
      />
    </NodeViewWrapper>
  )
}

export const MediaImage = Node.create({
  name: 'mediaImage',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '' },
      caption: { default: '' },
      alt: { default: '' },
      vaultFileId: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-media-image]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-media-image': '' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaImageView)
  },
})
