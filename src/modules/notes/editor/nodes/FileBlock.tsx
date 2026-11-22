import { mergeAttributes, Node } from '@tiptap/core'
import { Download, FileText } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

function downloadHref(href: string, fileName: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function FileBlockView({ node }: NodeViewProps) {
  const name = String(node.attrs.fileName || 'File')
  const href = typeof node.attrs.href === 'string' ? node.attrs.href : ''
  const size = String(node.attrs.sizeLabel || '')

  return (
    <NodeViewWrapper className="note-file" data-downloadable={href ? 'true' : 'false'}>
      <span className="note-file-icon" aria-hidden="true">
        <FileText className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="note-file-name">{name}</span>
        <span className="note-file-meta">
          {size || 'Attached'}
          {href ? '' : ' · demo file — attach a real file to download'}
        </span>
      </span>
      <button
        type="button"
        className="note-file-download"
        title={href ? `Download ${name}` : 'Nothing to download yet'}
        aria-label={`Download ${name}`}
        disabled={!href}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          if (href) downloadHref(href, name)
        }}
      >
        <Download className="h-4 w-4" strokeWidth={1.75} />
      </button>
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
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-href'),
        renderHTML: (attributes) =>
          typeof attributes.href === 'string' && attributes.href
            ? { 'data-href': attributes.href }
            : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-file-block]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-file-block': '', class: 'note-file' }),
      node.attrs.fileName,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(FileBlockView)
  },
})
