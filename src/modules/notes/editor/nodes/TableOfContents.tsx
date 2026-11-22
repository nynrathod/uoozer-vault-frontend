import { useEffect, useMemo, useState } from 'react'
import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { headingsFromDoc } from '../../utils/document'

function TableOfContentsView({ editor }: NodeViewProps) {
  // Bumped by the editor's `update` event (fires only when the document
  // changes), so the list re-derives after every heading edit.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (editor.isDestroyed) return
    const sync = () => setVersion((v) => v + 1)
    editor.on('update', sync)
    return () => {
      editor.off('update', sync)
    }
  }, [editor])

  const headings = useMemo(() => {
    try {
      return editor.isDestroyed ? [] : headingsFromDoc(editor.getJSON())
    } catch {
      return []
    }
    // `version` marks the latest document change.
  }, [editor, version])

  if (headings.length === 0) {
    return (
      <NodeViewWrapper className="note-toc">
        <p className="text-muted-foreground py-1 text-[13px]">
          Headings will appear here — start one with /Heading.
        </p>
      </NodeViewWrapper>
    )
  }

  const jumpTo = (index: number) => {
    try {
      if (editor.isDestroyed) return
      let seen = -1
      let target = -1
      editor.state.doc.forEach((node, offset) => {
        if (node.type.name === 'heading') {
          seen += 1
          if (seen === index) target = offset + 1
        }
      })
      if (target >= 0) {
        editor.chain().focus().setTextSelection(target).scrollIntoView().run()
      }
    } catch {
      // Document changed under us; the next render refreshes the list.
    }
  }

  return (
    <NodeViewWrapper className="note-toc">
      {headings.map((heading, index) => (
        <div
          key={`${index}-${heading.text}`}
          className="note-toc-item"
          style={{ paddingLeft: `${(heading.level - 1) * 14}px` }}
        >
          <button
            type="button"
            className="note-toc-link"
            contentEditable={false}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => jumpTo(index)}
          >
            {heading.text}
          </button>
        </div>
      ))}
    </NodeViewWrapper>
  )
}

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'div[data-toc]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toc': '', class: 'note-toc' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(TableOfContentsView)
  },
})
