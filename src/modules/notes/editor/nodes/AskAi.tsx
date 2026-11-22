import { useMemo } from 'react'
import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Lock } from 'lucide-react'
import { noteUiBus } from '../../bus'

const CHIPS: { label: string; prompt: string }[] = [
  { label: 'Summarize', prompt: 'Summarize this note in three bullets' },
  { label: 'Continue writing', prompt: 'Continue writing from where the note stops' },
  { label: 'Fix tone', prompt: 'Fix the tone of this note so it reads clearly' },
  { label: 'Translate', prompt: 'Translate this note into plain English' },
]

function AskAiBlockView({ editor }: NodeViewProps) {
  const words = useMemo(() => {
    try {
      const text = editor?.state.doc.textContent ?? ''
      return text.trim() ? text.trim().split(/\s+/).length : 0
    } catch {
      return 0
    }
  }, [editor])

  const ask = (prompt: string) => noteUiBus.emit({ type: 'assistant.open', prompt })

  return (
    <NodeViewWrapper className="note-askai" contentEditable={false}>
      <button
        type="button"
        className="note-askai-card"
        onClick={() => ask(CHIPS[0]?.prompt ?? 'Summarize this note in three bullets')}
      >
        <svg
          className="note-askai-spark"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        </svg>
        Ask about this note
        <span className="note-askai-caret" aria-hidden="true" />
      </button>
      <div className="note-askai-chips">
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="note-askai-chip"
            onClick={() => ask(chip.prompt)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <p className="note-askai-foot">
        <Lock className="h-3 w-3" strokeWidth={1.6} aria-hidden="true" />
        Sends {words} words · not stored
      </p>
    </NodeViewWrapper>
  )
}

export const AskAiBlock = TiptapNode.create({
  name: 'askAi',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {}
  },
  parseHTML() {
    return [{ tag: 'div[data-ask-ai]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-ask-ai': '', class: 'note-askai' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(AskAiBlockView)
  },
})
