import { useEffect, useRef, useState } from 'react'
import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import { AlignCenter, AlignLeft, AlignRight, Download, RefreshCw, Trash2 } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

type PickerTab = 'upload' | 'link'

const MIN_VIDEO_WIDTH = 160

function VideoGlyph() {
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
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m10 9 5 3-5 3V9z" />
    </svg>
  )
}

function MediaVideoView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const src = String(node.attrs.src ?? '')
  const caption = String(node.attrs.caption ?? '')
  const align = String(node.attrs.align ?? 'left')
  const storedWidth = typeof node.attrs.width === 'number' ? (node.attrs.width as number) : null

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTab, setPickerTab] = useState<PickerTab>('upload')
  const [linkDraft, setLinkDraft] = useState('')
  const [linkError, setLinkError] = useState(false)
  const [captionDraft, setCaptionDraft] = useState(caption)
  const [duration, setDuration] = useState(String(node.attrs.duration ?? ''))
  const [liveWidth, setLiveWidth] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    startWidth: number
    startX: number
    sign: number
    moved: boolean
  } | null>(null)

  const hasVideo = Boolean(src)

  /* Notion behaviour: a video block inserted without a source opens its
     picker immediately. */
  useEffect(() => {
    if (!hasVideo && !pickerOpen) setPickerOpen(true)
  }, [hasVideo, pickerOpen])

  /* Close the picker on outside interaction. */
  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as globalThis.Node
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

  /* Keep the caption draft in sync when attrs change externally. */
  useEffect(() => setCaptionDraft(caption), [caption])

  /* Duration read live from the metadata, persisted once. */
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return
    const onMeta = () => {
      const seconds = Math.round(video.duration)
      if (Number.isFinite(seconds) && seconds > 0) {
        const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
        setDuration(label)
        if (label !== String(node.attrs.duration ?? '')) updateAttributes({ duration: label })
      }
    }
    video.addEventListener('loadedmetadata', onMeta)
    return () => video.removeEventListener('loadedmetadata', onMeta)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- write-once commit
  }, [src])

  const applySource = (next: string, title?: string) => {
    updateAttributes({ src: next, title: title ?? String(node.attrs.title ?? ''), caption })
    setPickerOpen(false)
    setLinkDraft('')
    setLinkError(false)
  }

  const pickFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file || !file.type.startsWith('video/')) return
      applySource(URL.createObjectURL(file), file.name)
    }
    input.click()
  }

  const insertLink = () => {
    const value = linkDraft.trim()
    if (!/^https?:\/\/.+/i.test(value)) {
      setLinkError(true)
      return
    }
    applySource(value)
  }

  const downloadVideo = () => {
    const link = document.createElement('a')
    link.href = src
    link.download = String(node.attrs.title || 'video') || 'video'
    link.click()
  }

  const onEdgePointerDown = (sign: number) => (event: React.PointerEvent<HTMLElement>) => {
    const video = videoRef.current
    if (!video || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startWidth: video.offsetWidth,
      startX: event.clientX,
      sign,
      moved: false,
    }
  }

  const onEdgePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const width = Math.max(
      MIN_VIDEO_WIDTH,
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
          MIN_VIDEO_WIDTH,
          Math.round(drag.startWidth + drag.sign * (event.clientX - drag.startX))
        )
      : null
    dragRef.current = null
    setLiveWidth(null)
    if (width !== null) updateAttributes({ width })
  }

  const width = liveWidth ?? storedWidth

  const alignClass = align === 'center' ? 'is-center' : align === 'right' ? 'is-right' : ''

  const commitCaption = () => {
    if (captionDraft !== caption) updateAttributes({ caption: captionDraft })
  }

  return (
    <NodeViewWrapper className="note-media" data-drag-handle>
      {hasVideo ? (
        <>
          <div className={`note-media-frame ${alignClass} ${selected ? 'is-selected' : ''}`}>
            <video
              ref={videoRef}
              src={src}
              controls
              className="note-media-video"
              style={width !== null ? { width: `${width}px` } : undefined}
              draggable={false}
            />
            {duration && <span className="note-video-time">{duration}</span>}
            <i
              className="note-media-edge is-left"
              contentEditable={false}
              aria-label="Resize video (left edge)"
              onPointerDown={onEdgePointerDown(-1)}
              onPointerMove={onEdgePointerMove}
              onPointerUp={onEdgePointerUp}
            />
            <i
              className="note-media-edge is-right"
              contentEditable={false}
              aria-label="Resize video (right edge)"
              onPointerDown={onEdgePointerDown(1)}
              onPointerMove={onEdgePointerMove}
              onPointerUp={onEdgePointerUp}
            />
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
                title="Replace video"
                aria-label="Replace video"
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
                aria-label="Download video"
                onMouseDown={(event) => event.preventDefault()}
                onClick={downloadVideo}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Delete video"
                aria-label="Delete video"
                className="is-danger"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => deleteNode()}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <input
            className="note-caption-input"
            value={captionDraft}
            placeholder="Write a caption…"
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => setCaptionDraft(event.target.value)}
            onBlur={commitCaption}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitCaption()
                event.currentTarget.blur()
              }
            }}
          />
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
            <VideoGlyph />
            Add a video
          </button>

          {pickerOpen && (
            <div
              className="note-media-picker"
              ref={pickerRef}
              role="dialog"
              aria-label="Add a video"
            >
              <div className="note-media-picker-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={pickerTab === 'upload'}
                  className={`note-media-picker-tab${pickerTab === 'upload' ? 'is-active' : ''}`}
                  onClick={() => {
                    setPickerTab('upload')
                    setLinkError(false)
                  }}
                >
                  Upload
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pickerTab === 'link'}
                  className={`note-media-picker-tab${pickerTab === 'link' ? 'is-active' : ''}`}
                  onClick={() => {
                    setPickerTab('link')
                    setLinkError(false)
                  }}
                >
                  Link
                </button>
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
                    placeholder="Paste a video link…"
                    aria-label="Video URL"
                    spellCheck={false}
                    autoFocus
                  />
                  <button type="button" className="note-media-picker-primary" onClick={insertLink}>
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

export const MediaVideo = TiptapNode.create({
  name: 'mediaVideo',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '' },
      title: { default: '' },
      duration: { default: '' },
      caption: { default: '' },
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
    return [{ tag: 'figure[data-media-video]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-media-video': '',
        'data-width': node.attrs.width ?? '',
      }),
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaVideoView)
  },
})
