import { useRef, useState } from 'react'
import { mergeAttributes, Node } from '@tiptap/core'
import { Lock, Play } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

function MediaVideoView({ node }: NodeViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const src = String(node.attrs.src ?? '')
  const title = String(node.attrs.title ?? 'Video')
  const duration = String(node.attrs.duration ?? '')
  const caption = String(node.attrs.caption ?? '')

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  return (
    <NodeViewWrapper className="note-media">
      <div className="note-video-frame">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            className="note-video"
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : (
          <div className="note-video-poster" />
        )}
        {!playing && (
          <button
            type="button"
            className="note-video-play"
            onClick={toggle}
            contentEditable={false}
          >
            <Play className="h-[18px] w-[18px] fill-current" />
            <span className="sr-only">Play</span>
          </button>
        )}
        {duration && <span className="note-video-time">{duration}</span>}
      </div>
      <p className="note-caption">
        <Lock className="mr-1 inline h-3 w-3 align-[-1px]" />
        {title}
        {caption ? ` · ${caption}` : ''}
      </p>
    </NodeViewWrapper>
  )
}

export const MediaVideo = Node.create({
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
      vaultFileId: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-media-video]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-media-video': '' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaVideoView)
  },
})
