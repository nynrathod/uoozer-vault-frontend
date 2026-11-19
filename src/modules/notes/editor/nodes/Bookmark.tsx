import { useState } from 'react'
import { mergeAttributes, Node } from '@tiptap/core'
import { Bookmark as BookmarkIcon, Link2, Trash2 } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function normalizeUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function BookmarkView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const url = String(node.attrs.url ?? '')
  const [draft, setDraft] = useState('')

  if (!url) {
    return (
      <NodeViewWrapper className="note-bookmark is-empty" contentEditable={false}>
        <form
          className="note-bookmark-form"
          onSubmit={(event) => {
            event.preventDefault()
            const next = normalizeUrl(draft)
            if (!next) {
              deleteNode()
              return
            }
            updateAttributes({ url: next, title: hostOf(next) })
          }}
        >
          <Link2 className="text-muted-foreground h-4 w-4 shrink-0" strokeWidth={1.75} />
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (!draft.trim()) deleteNode()
            }}
            onKeyDown={(event) => {
              // Keep editor shortcuts out of the URL field.
              event.stopPropagation()
              if (event.key === 'Escape') deleteNode()
            }}
            placeholder="Paste a link and press Enter…"
            aria-label="Bookmark URL"
            spellCheck={false}
          />
        </form>
      </NodeViewWrapper>
    )
  }

  const host = hostOf(url)

  return (
    <NodeViewWrapper className="note-bookmark" contentEditable={false}>
      <a
        className="note-bookmark-card"
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        <span className="note-bookmark-icon">
          <BookmarkIcon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="note-bookmark-title">{String(node.attrs.title || host || url)}</span>
          <span className="note-bookmark-url">{url}</span>
        </span>
        <button
          type="button"
          className="note-bookmark-remove"
          title="Remove bookmark"
          aria-label="Remove bookmark"
          onClick={() => deleteNode()}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </a>
    </NodeViewWrapper>
  )
}

export const Bookmark = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-bookmark]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-bookmark': '' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(BookmarkView)
  },
})
