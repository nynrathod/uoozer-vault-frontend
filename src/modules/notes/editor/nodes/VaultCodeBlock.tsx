import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import CodeBlock from '@tiptap/extension-code-block'
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from '@tiptap/react'

const LANGUAGES = ['typescript', 'javascript', 'json', 'python', 'go', 'rust', 'text']

function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const language = String(node.attrs.language || 'text')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <NodeViewWrapper className="note-code">
      <div className="note-code-head" contentEditable={false}>
        <label className="note-code-lang">
          <select
            value={language}
            onChange={(event) => updateAttributes({ language: event.target.value })}
            onMouseDown={(event) => event.stopPropagation()}
            aria-label="Code language"
          >
            {LANGUAGES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="note-code-copy"
          onClick={() => void copy()}
          title={copied ? 'Copied' : 'Copy code'}
          contentEditable={false}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre>
        <NodeViewContent />
      </pre>
    </NodeViewWrapper>
  )
}

export const VaultCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})
