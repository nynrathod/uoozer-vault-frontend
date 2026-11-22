import { mergeAttributes, Node } from '@tiptap/core'
import { Check, AlertTriangle, Lock } from 'lucide-react'
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from '@tiptap/react'

const TONES = ['secure', 'success', 'warning'] as const
type CalloutTone = (typeof TONES)[number]

function nextTone(tone: string): CalloutTone {
  const index = TONES.indexOf(tone as CalloutTone)
  return TONES[(index + 1) % TONES.length] ?? 'secure'
}

const TONE_ICON: Record<CalloutTone, typeof Lock> = {
  secure: Lock,
  success: Check,
  warning: AlertTriangle,
}

function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const tone = TONES.includes(node.attrs.tone) ? (node.attrs.tone as CalloutTone) : 'secure'
  const Icon = TONE_ICON[tone]
  return (
    <NodeViewWrapper className="note-callout" data-tone={tone}>
      <button
        type="button"
        className="note-callout-icon"
        contentEditable={false}
        title="Change tone"
        aria-label="Change callout tone"
        onClick={() => updateAttributes({ tone: nextTone(tone) })}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </button>
      <NodeViewContent className="note-callout-body" />
    </NodeViewWrapper>
  )
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { tone: { default: 'secure' } }
  },
  parseHTML() {
    return [{ tag: 'aside[data-callout]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },
})
