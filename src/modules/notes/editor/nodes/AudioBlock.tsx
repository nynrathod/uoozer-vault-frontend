import { useRef, useState } from 'react'
import { mergeAttributes, Node } from '@tiptap/core'
import { Pause, Play } from 'lucide-react'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function AudioBlockView({ node }: NodeViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const src = String(node.attrs.src ?? '')
  const title = String(node.attrs.title ?? 'Audio')
  const duration = String(node.attrs.duration ?? '')

  const toggle = () => {
    const audio = audioRef.current
    if (!audio || !src) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  return (
    <NodeViewWrapper className={`note-audio ${playing ? 'is-playing' : ''}`}>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setElapsed(0)
          }}
          onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        />
      )}
      <button
        type="button"
        className="note-audio-play"
        onClick={toggle}
        contentEditable={false}
        aria-label={playing ? 'Pause audio' : 'Play audio'}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="h-3.5 w-3.5 fill-current" />
        )}
      </button>
      <span className="note-audio-wave" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <span key={index} />
        ))}
      </span>
      <span className="note-audio-time">
        {formatElapsed(elapsed)}
        {duration ? ` / ${duration}` : ''}
      </span>
      <span className="text-muted-foreground hidden truncate text-[12px] sm:block" title={title}>
        {title}
      </span>
    </NodeViewWrapper>
  )
}

export const AudioBlock = Node.create({
  name: 'audioBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: '' },
      duration: { default: '' },
      src: { default: '' },
      vaultFileId: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-audio-block]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-audio-block': '', class: 'note-audio' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(AudioBlockView)
  },
})
