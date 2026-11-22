import { useEffect, useMemo, useRef, useState } from 'react'
import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import { AlignCenter, AlignLeft, AlignRight, Download, RefreshCw, Trash2 } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { NOTE_IMAGE_BYTE_LIMIT } from '../../constants'
import { noteUiBus } from '../../bus'
import { normalizeGiphy, UNSPLASH_PICKS } from '../../data/mediaStock'

type PickerTab = 'upload' | 'link' | 'unsplash' | 'giphy'

const MIN_IMAGE_WIDTH = 48
const PICKER_TABS: { id: PickerTab; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'link', label: 'Link' },
  { id: 'unsplash', label: 'Unsplash' },
  { id: 'giphy', label: 'GIPHY' },
]

function ImageGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  )
}

function UnsplashGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 4h6v4h4v5h-4v7H9v-7H5V8h4V4z" />
    </svg>
  )
}

function GiphyGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 3h12l4 4v14H4V3zm2 2v14h12V8.5L14.5 5H6z" />
    </svg>
  )
}

function MediaImageView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const src = String(node.attrs.src ?? '')
  const alt = String(node.attrs.alt ?? '')
  const align = String(node.attrs.align ?? 'left')
  const storedWidth = typeof node.attrs.width === 'number' ? (node.attrs.width as number) : null

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTab, setPickerTab] = useState<PickerTab>('upload')
  const [linkDraft, setLinkDraft] = useState('')
  const [giphyDraft, setGiphyDraft] = useState('')
  const [stockQuery, setStockQuery] = useState('')
  const [linkError, setLinkError] = useState(false)
  const [liveWidth, setLiveWidth] = useState<number | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    startWidth: number
    startX: number
    sign: number
    moved: boolean
  } | null>(null)

  const hasImage = Boolean(src)

  /* Notion behaviour: an image block inserted without a source opens its
     picker immediately. */
  useEffect(() => {
    if (!hasImage && !pickerOpen) setPickerOpen(true)
  }, [hasImage, pickerOpen])

  /* Close the picker on outside interaction. */
  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (pickerRef.current && !pickerRef.current.contains(target)) setPickerOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  const applySource = (next: string, altText?: string) => {
    updateAttributes({ src: next, alt: altText ?? alt })
    setPickerOpen(false)
    setLinkDraft('')
    setGiphyDraft('')
    setStockQuery('')
    setLinkError(false)
  }

  const pickFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file || !file.type.startsWith('image/')) return
      if (file.size > NOTE_IMAGE_BYTE_LIMIT) {
        noteUiBus.emit({
          type: 'notify',
          tone: 'error',
          message:
            'Images over 1.5 MB are skipped locally. Vault sync can take larger files later.',
        })
        return
      }
      const reader = new FileReader()
      reader.onload = () => applySource(String(reader.result ?? ''), file.name)
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const insertLink = () => {
    const value = linkDraft.trim()
    if (!/^https?:\/\/.+/i.test(value) && !value.startsWith('data:image/')) {
      setLinkError(true)
      return
    }
    applySource(value)
  }

  const insertGiphy = () => {
    const value = giphyDraft.trim()
    const gif = normalizeGiphy(value) || (/^https?:\/\/.+\.(gif)(\?.*)?$/i.test(value) ? value : '')
    if (!gif) {
      setLinkError(true)
      return
    }
    applySource(gif)
  }

  /* Edge drag: live px width while moving, committed to attrs on release.
     The right edge grows with the pointer; the left edge inverts. */
  const onEdgePointerDown = (sign: number) => (event: React.PointerEvent<HTMLElement>) => {
    const img = imgRef.current
    if (!img || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startWidth: img.offsetWidth,
      startX: event.clientX,
      sign,
      moved: false,
    }
  }

  const onEdgePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const width = Math.max(
      MIN_IMAGE_WIDTH,
      Math.round(drag.startWidth + drag.sign * (event.clientX - drag.startX))
    )
    drag.moved = true
    setLiveWidth(width)
  }

  const onEdgePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const width = drag.moved
      ? Math.max(
          MIN_IMAGE_WIDTH,
          Math.round(drag.startWidth + drag.sign * (event.clientX - drag.startX))
        )
      : null
    dragRef.current = null
    setLiveWidth(null)
    if (width !== null) updateAttributes({ width })
  }

  const width = liveWidth ?? storedWidth

  const downloadImage = () => {
    const link = document.createElement('a')
    link.href = src
    link.download = String(node.attrs.alt || 'image') || 'image'
    link.click()
  }

  const alignClass = align === 'center' ? 'is-center' : align === 'right' ? 'is-right' : ''

  const stockGrid = useMemo(() => {
    const query = stockQuery.trim().toLowerCase()
    if (!query) return UNSPLASH_PICKS.slice(0, 9)
    return UNSPLASH_PICKS.filter((photo) => photo.label.toLowerCase().includes(query)).slice(0, 9)
  }, [stockQuery])

  return (
    <NodeViewWrapper className="note-media" data-drag-handle>
      {hasImage ? (
        <>
          <div className={`note-media-frame ${alignClass} ${selected ? 'is-selected' : ''}`}>
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              className="note-media-image"
              style={width !== null ? { width: `${width}px` } : undefined}
              draggable={false}
            />
            {/* edge resize handles (Notion: drag the image sides) */}
            <i
              className="note-media-edge is-left"
              contentEditable={false}
              aria-label="Resize image (left edge)"
              onPointerDown={onEdgePointerDown(-1)}
              onPointerMove={onEdgePointerMove}
              onPointerUp={onEdgePointerUp}
            />
            <i
              className="note-media-edge is-right"
              contentEditable={false}
              aria-label="Resize image (right edge)"
              onPointerDown={onEdgePointerDown(1)}
              onPointerMove={onEdgePointerMove}
              onPointerUp={onEdgePointerUp}
            />
            {/* Notion's floating toolbar: align · replace · download · delete */}
            <div className="note-media-toolbar" contentEditable={false}>
              <button
                type="button"
                title="Align left"
                aria-label="Align left"
                aria-pressed={align === 'left'}
                className={align === 'left' ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateAttributes({ align: 'left' })}
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Align center"
                aria-label="Align center"
                aria-pressed={align === 'center'}
                className={align === 'center' ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateAttributes({ align: 'center' })}
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Align right"
                aria-label="Align right"
                aria-pressed={align === 'right'}
                className={align === 'right' ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateAttributes({ align: 'right' })}
              >
                <AlignRight className="h-3.5 w-3.5" />
              </button>
              <span className="note-media-toolbar-sep" aria-hidden="true" />
              <button
                type="button"
                title="Replace image"
                aria-label="Replace image"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setPickerTab('upload')
                  setPickerOpen(true)
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Download"
                aria-label="Download image"
                onMouseDown={(event) => event.preventDefault()}
                onClick={downloadImage}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Delete image"
                aria-label="Delete image"
                className="is-danger"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => deleteNode()}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="note-media-empty" contentEditable={false}>
          <button
            type="button"
            className="note-media-add"
            onClick={() => {
              setPickerTab('upload')
              setPickerOpen(true)
            }}
          >
            <ImageGlyph />
            Add an image
          </button>

          {pickerOpen && (
            <div
              className="note-media-picker"
              ref={pickerRef}
              role="dialog"
              aria-label="Add an image"
            >
              <div className="note-media-picker-tabs" role="tablist">
                {PICKER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={pickerTab === tab.id}
                    className={`note-media-picker-tab${pickerTab === tab.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setPickerTab(tab.id)
                      setLinkError(false)
                    }}
                  >
                    {tab.id === 'unsplash' && (
                      <span className="note-media-picker-glyph">
                        <UnsplashGlyph />
                      </span>
                    )}
                    {tab.id === 'giphy' && (
                      <span className="note-media-picker-glyph">
                        <GiphyGlyph />
                      </span>
                    )}
                    {tab.label}
                  </button>
                ))}
              </div>

              {pickerTab === 'upload' && (
                <div className="note-media-picker-body">
                  <button type="button" className="note-media-picker-primary" onClick={pickFile}>
                    Upload file
                  </button>
                </div>
              )}

              {pickerTab === 'link' && (
                <div className="note-media-picker-body">
                  <input
                    className="note-media-picker-input"
                    value={linkDraft}
                    onChange={(event) => {
                      setLinkDraft(event.target.value)
                      setLinkError(false)
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (event.key === 'Enter') insertLink()
                    }}
                    placeholder="Paste an image link…"
                    aria-label="Image URL"
                    spellCheck={false}
                    autoFocus
                  />
                  <button type="button" className="note-media-picker-primary" onClick={insertLink}>
                    Create embed
                  </button>
                </div>
              )}

              {pickerTab === 'unsplash' && (
                <div className="note-media-picker-body">
                  <input
                    className="note-media-picker-input"
                    value={stockQuery}
                    onChange={(event) => setStockQuery(event.target.value)}
                    placeholder="Search photos…"
                    aria-label="Search Unsplash photos"
                    spellCheck={false}
                  />
                  <div className="note-media-stock">
                    {stockGrid.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        className="note-media-stock-item"
                        title={photo.label}
                        onClick={() => applySource(photo.src, photo.label)}
                      >
                        <img src={photo.thumb} alt={photo.label} loading="lazy" draggable={false} />
                      </button>
                    ))}
                    {stockGrid.length === 0 && (
                      <p className="note-media-picker-hint">No photos match “{stockQuery}”.</p>
                    )}
                  </div>
                </div>
              )}

              {pickerTab === 'giphy' && (
                <div className="note-media-picker-body">
                  <input
                    className="note-media-picker-input"
                    value={giphyDraft}
                    onChange={(event) => {
                      setGiphyDraft(event.target.value)
                      setLinkError(false)
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (event.key === 'Enter') insertGiphy()
                    }}
                    placeholder="Paste a GIPHY link…"
                    aria-label="GIF URL"
                    spellCheck={false}
                    autoFocus
                  />
                  <button type="button" className="note-media-picker-primary" onClick={insertGiphy}>
                    Create embed
                  </button>
                </div>
              )}

              {linkError && (
                <p className="note-media-picker-error">
                  That does not look like a link — try https://…
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}

export const MediaImage = TiptapNode.create({
  name: 'mediaImage',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '' },
      caption: { default: '' },
      alt: { default: '' },
      align: { default: 'left' },
      vaultFileId: { default: null },
      width: {
        default: null,
        rendered: false,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-width')
          if (raw === null) return null
          const parsed = Number.parseInt(raw, 10)
          return Number.isFinite(parsed) ? parsed : null
        },
      },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-media-image]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-media-image': '',
        'data-width': node.attrs.width ?? '',
      }),
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaImageView)
  },
})
