import { mergeAttributes, Node } from '@tiptap/core'
import { FileText } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

function FileBlockView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper className="note-file">
      <span className="note-file-icon">
        <FileText className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{String(node.attrs.fileName || 'File')}</span>
        <span className="text-muted-foreground block truncate text-[12px]">
          {String(node.attrs.sizeLabel || 'On this device')}
          {node.attrs.vaultFileId ? '' : ' · vault link connects later'}
        </span>
      </span>
    </NodeViewWrapper>
  )
}

export const FileBlock = Node.create({
  name: 'fileBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      fileName: { default: '' },
      sizeLabel: { default: '' },
      mime: { default: '' },
      vaultFileId: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-file-block]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-file-block': '' }), HTMLAttributes.fileName]
  },
  addNodeView() {
    return ReactNodeViewRenderer(FileBlockView)
  },
})
