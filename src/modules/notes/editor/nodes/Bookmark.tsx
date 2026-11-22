import { useEffect, useRef, useState } from 'react'
import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import {
  Bookmark as BookmarkIcon,
  MoreHorizontal,
  PencilLine,
  RefreshCw,
  Trash2,
} from 'lucide-react'
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

async function fetchPageMeta(url: string): Promise<{
  title: string | null
  description: string | null
  image: string | null
}> {
  const out: { title: string | null; description: string | null; image: string | null } = {
    title: null,
    description: null,
    image: null,
  }
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!response.ok) return out
    const html = (await response.text()).slice(0, 300_000)
    const pick = (re: RegExp): string | null => re.exec(html)?.[1]?.trim() ?? null
    const decode = (value: string): string =>
      value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    const title =
      pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
      pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ??
      pick(/<title[^>]*>([^<]+)<\/title>/i)
    const description =
      pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
      pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ??
      pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    let image =
      pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (image) {
      try {
        image = new URL(decode(image), url).toString()
      } catch {
        image = null
      }
    }
    out.title = title ? decode(title).slice(0, 140) : null
    out.description = description ? decode(description).slice(0, 300) : null
    out.image = image
  } catch {
    /* CORS or offline — the card falls back to the host name + placeholder */
  }
  return out
}

/** The sheet's 72×72 hills placeholder, drawn inline (no network). */
function ThumbTile({ src, alt }: { src?: string | null; alt: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        width={72}
        height={72}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{
          flex: 'none',
          width: 72,
          height: 72,
          borderRadius: 8,
          objectFit: 'cover',
          display: 'block',
          background: '#DCE8FB',
        }}
        onError={(event) => {
          event.currentTarget.style.display = 'none'
        }}
      />
    )
  }
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      role="img"
      aria-label="Thumbnail placeholder"
      style={{ flex: 'none', borderRadius: 8, display: 'block' }}
    >
      <rect width="72" height="72" fill="#DCE8FB" />
      <circle cx="52" cy="22" r="9" fill="#FFFFFF" />
      <path d="M0 72V48C18 38 34 48 52 44S66 42 72 44V72Z" fill="#5B8DEF" />
    </svg>
  )
}

function BookmarkView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const url = String(node.attrs.url ?? '')
  const [formOpen, setFormOpen] = useState(!url)
  const [menuOpen, setMenuOpen] = useState(false)
  const [draftUrl, setDraftUrl] = useState(url)
  const [fetching, setFetching] = useState(false)
  const formRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  /* Close the popup / ⋯ menu on outside interaction. */
  useEffect(() => {
    if (!formOpen && !menuOpen) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (formOpen && !formRef.current?.contains(target)) closeForm()
      if (menuOpen && !menuRef.current?.contains(target)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeForm()
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeForm closes over current draft
  }, [formOpen, menuOpen])

  const closeForm = () => {
    setFormOpen(false)
    // Escaping an empty creation removes the block (Notion behaviour).
    if (!url && !draftUrl.trim()) deleteNode()
  }

  /** Saves the URL, then quietly fills in whatever the page offers. */
  const submit = async () => {
    const next = normalizeUrl(draftUrl)
    if (!next) {
      deleteNode()
      return
    }
    setFormOpen(false)
    setFetching(true)
    updateAttributes({
      url: next,
      title: '',
      description: '',
      image: null,
    })
    const meta = await fetchPageMeta(next)
    setFetching(false)
    // The block may have been deleted while fetching — updateAttributes
    // throws on a dead view, so guard the write-back.
    if (!meta.title && !meta.description && !meta.image) return
    try {
      updateAttributes({
        title: meta.title ?? '',
        description: meta.description ?? '',
        image: meta.image ?? null,
      })
    } catch {
      /* node view gone (note switched); the fetched meta is simply dropped */
    }
  }

  const openForm = () => {
    setDraftUrl(url)
    setMenuOpen(false)
    setFormOpen(true)
  }

  if (!url && !formOpen) {
    return (
      <NodeViewWrapper className="note-bookmark" contentEditable={false}>
        <button type="button" className="note-bookmark-add" onClick={() => setFormOpen(true)}>
          <BookmarkIcon className="h-4 w-4" strokeWidth={1.75} />
          Add a web bookmark
        </button>
      </NodeViewWrapper>
    )
  }

  if (formOpen) {
    return (
      <NodeViewWrapper className="note-bookmark" contentEditable={false}>
        <div
          className="note-bookmark-pop"
          ref={formRef}
          role="dialog"
          aria-label="Create a web bookmark"
        >
          <input
            className="note-bookmark-pop-input"
            autoFocus
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
            placeholder="Paste a link — https://…"
            aria-label="Bookmark URL"
            spellCheck={false}
            inputMode="url"
          />
          <button
            type="button"
            className="note-bookmark-create"
            title="Create bookmark (Enter)"
            aria-label="Create bookmark"
            onClick={submit}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </NodeViewWrapper>
    )
  }

  const host = hostOf(url)
  const title = String(node.attrs.title || host || url)
  const description = String(node.attrs.description ?? '')
  const image = typeof node.attrs.image === 'string' && node.attrs.image ? node.attrs.image : null

  return (
    <NodeViewWrapper
      className="note-bookmark"
      contentEditable={false}
      data-fetching={fetching ? 'true' : 'false'}
    >
      <div className="note-bookmark-card">
        <a
          className="note-bookmark-main"
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          <span className="note-bookmark-text">
            <span className="note-bookmark-title">
              {title}
              {fetching && <RefreshCw className="note-bookmark-spin" aria-hidden="true" />}
            </span>
            {description && <span className="note-bookmark-desc">{description}</span>}
            <span className="note-bookmark-host">
              <i className="note-bookmark-host-dot" aria-hidden="true" />
              {host}
            </span>
          </span>
          <ThumbTile src={image} alt={title} />
        </a>
        <div className="note-bookmark-tools">
          <button
            type="button"
            className="note-bookmark-tool"
            title="Bookmark actions"
            aria-label="Bookmark actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <div className="note-bookmark-menu" ref={menuRef}>
              <button type="button" onClick={openForm}>
                <PencilLine className="h-3.5 w-3.5" strokeWidth={1.6} /> Edit URL
              </button>
              <button type="button" className="is-danger" onClick={() => deleteNode()}>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} /> Remove
              </button>
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const Bookmark = TiptapNode.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
      description: { default: '' },
      image: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-image'),
        renderHTML: (attributes) =>
          typeof attributes.image === 'string' && attributes.image
            ? { 'data-image': attributes.image }
            : {},
      },
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
