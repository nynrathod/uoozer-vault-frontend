import { useEffect, useRef, useState } from 'react'
import { mergeAttributes, Node } from '@tiptap/core'
import { Globe, SquarePlay, Trash2 } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

function normalizeEmbedUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function toEmbeddable(url: string): string {
  // Best-effort conversion of share links into player URLs.
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/)
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`
  return url
}

function EmbedView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const url = String(node.attrs.url ?? '')
  const allowed = String(node.attrs.allowed ?? 'never')
  const [draft, setDraft] = useState('')
  const [touched, setTouched] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as globalThis.Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  /** Enter commits whatever is in the field (empty deletes, like Notion). */
  const save = () => {
    const next = normalizeEmbedUrl(draft)
    if (next) updateAttributes({ url: next })
    else deleteNode()
  }

  /** Blur commits only what the user actually typed: an untouched field
      keeps the quiet empty state (no accidental deletion on click-away). */
  const onBlurSave = () => {
    if (!touched) return
    save()
  }

  // Session-loaded or always-allowed hosts render the frame.
  if (url && allowed !== 'never' && (loaded || allowed === 'always')) {
    return (
      <NodeViewWrapper className="note-embed" contentEditable={false}>
        <div className="note-embed-frame-wrap">
          <iframe
            src={toEmbeddable(url)}
            className="note-embed-frame"
            title={`Embedded content — ${url}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="encrypted-media; picture-in-picture; fullscreen"
          />
          <div className="note-embed-tools">
            <button
              type="button"
              className="note-embed-tool"
              title="Embed actions"
              aria-label="Embed actions"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
            {menuOpen && (
              <div className="note-embed-menu" ref={menuRef}>
                <button type="button" className="is-danger" onClick={() => deleteNode()}>
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} /> Remove embed
                </button>
              </div>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  if (url) {
    return (
      <NodeViewWrapper className="note-embed" contentEditable={false}>
        <div className="note-embed-consent">
          <span className="note-embed-consent-glyph" aria-hidden="true">
            <SquarePlay className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <p className="note-embed-consent-title">Allow this embed to load?</p>
          <p className="note-embed-consent-url">{url}</p>
          <p className="note-embed-consent-hint">
            Third-party content stays off until you allow it, so the site can’t track your reading.
          </p>
          <div className="note-embed-consent-row">
            <button
              type="button"
              className="note-embed-allow"
              onClick={() => {
                updateAttributes({ allowed: 'once' })
                setLoaded(true)
              }}
            >
              Load once
            </button>
            <button
              type="button"
              className="note-embed-always"
              onClick={() => {
                updateAttributes({ allowed: 'always' })
                setLoaded(true)
              }}
            >
              Always allow
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="note-embed" contentEditable={false}>
      <div className="note-embed-pop" role="dialog" aria-label="Add an embed">
        <p className="note-embed-pop-title">Embed a link</p>
        <input
          className="note-embed-pop-input"
          autoFocus
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setTouched(true)
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              save()
            }
          }}
          onBlur={onBlurSave}
          placeholder="Paste in https://…"
          aria-label="Embed URL"
          spellCheck={false}
          inputMode="url"
        />
        <p className="note-embed-pop-hint">
          Works with YouTube, Figma, Maps and any embeddable page.
        </p>
      </div>
    </NodeViewWrapper>
  )
}

export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: '' },
      allowed: { default: 'never' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-embed]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-embed': '', class: 'note-embed' }),
      node.attrs.url,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(EmbedView)
  },
})
