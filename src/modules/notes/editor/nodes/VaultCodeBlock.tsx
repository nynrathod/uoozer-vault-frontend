import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Copy } from 'lucide-react'
import CodeBlock from '@tiptap/extension-code-block'
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from '@tiptap/react'
import { NOTE_COPY_FEEDBACK_MS } from '../../constants'

const LANGUAGES = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'json',
  'html',
  'css',
  'python',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'sql',
  'bash',
  'yaml',
  'toml',
  'markdown',
  'text',
]

function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [langQuery, setLangQuery] = useState('')
  const [langIndex, setLangIndex] = useState(0)
  const popRef = useRef<HTMLDivElement | null>(null)
  const langBtnRef = useRef<HTMLButtonElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const language = String(node.attrs.language || 'text')

  /* Close the language popover on outside interaction / Escape. */
  useEffect(() => {
    if (!langOpen) return
    const onDown = (event: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(event.target as Node)) setLangOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLangOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [langOpen])

  /* Focus the filter field when the popover opens; the highlighted index
     follows the filter result. */
  useEffect(() => {
    if (langOpen) {
      setLangQuery('')
      setLangIndex(Math.max(0, LANGUAGES.indexOf(language)))
      const frame = requestAnimationFrame(() => searchRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
    return undefined
  }, [langOpen, language])

  const matches = useMemo(() => {
    const query = langQuery.trim().toLowerCase()
    if (!query) return LANGUAGES
    return LANGUAGES.filter((item) => item.includes(query))
  }, [langQuery])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent)
      setCopied(true)
      window.setTimeout(() => setCopied(false), NOTE_COPY_FEEDBACK_MS)
    } catch {
      setCopied(false)
    }
  }

  const pick = (item: string) => {
    updateAttributes({ language: item })
    setLangOpen(false)
  }

  const anchor = langBtnRef.current?.getBoundingClientRect()
  const popLeft = anchor ? Math.max(8, Math.min(anchor.left, window.innerWidth - 216)) : 8
  const popTop = anchor ? Math.min(anchor.bottom + 6, Math.max(8, window.innerHeight - 300)) : 8

  return (
    <NodeViewWrapper className="note-code" spellCheck={false}>
      <div className="note-code-head" contentEditable={false}>
        <button
          type="button"
          className="note-code-lang"
          ref={langBtnRef}
          aria-haspopup="listbox"
          aria-expanded={langOpen}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setLangOpen((open) => !open)}
          title="Change language"
        >
          {language}
          <ChevronDown className="h-3 w-3" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="note-code-copy"
          onClick={() => void copy()}
          title={copied ? 'Copied' : 'Copy code'}
          contentEditable={false}
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre>
        <NodeViewContent<'code'> as="code" />
      </pre>
      {langOpen && (
        <div
          className="note-code-langpop"
          ref={popRef}
          role="listbox"
          aria-label="Code language"
          contentEditable={false}
          style={{ left: popLeft, top: popTop }}
        >
          <input
            ref={searchRef}
            className="note-code-langpop-search"
            value={langQuery}
            onChange={(event) => setLangQuery(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setLangIndex((index) => Math.min(index + 1, matches.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setLangIndex((index) => Math.max(index - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                const pickItem = matches[Math.min(langIndex, matches.length - 1)]
                if (pickItem) pick(pickItem)
              } else if (event.key === 'Tab') {
                event.preventDefault()
                const pickItem = matches[Math.min(langIndex, matches.length - 1)]
                if (pickItem) pick(pickItem)
              }
            }}
            placeholder="Filter languages…"
            aria-label="Filter languages"
            spellCheck={false}
          />
          <div className="note-code-langpop-list">
            {matches.map((item, index) => (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={item === language}
                className={`note-code-langpop-item${item === language ? 'is-active' : ''}${index === Math.min(langIndex, matches.length - 1) ? 'is-pointed' : ''}`}
                onMouseEnter={() => setLangIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(item)}
              >
                {item}
                {item === language && (
                  <Check className="note-code-langpop-check" strokeWidth={2.2} />
                )}
              </button>
            ))}
            {matches.length === 0 && (
              <p className="note-code-langpop-empty">No language matches “{langQuery}”.</p>
            )}
          </div>
        </div>
      )}
    </NodeViewWrapper>
  )
}

export const VaultCodeBlock = CodeBlock.extend({
  addOptions() {
    // Explicit options (same style as SimpleTable): Enter NEVER spawns a
    // paragraph outside the block — triple-Enter and Arrow-Down exits are
    // off (leave via the arrows / a click below, like Notion).
    return {
      languageClassPrefix: 'language-',
      exitOnTripleEnter: false,
      exitOnArrowDown: false,
      exitOnArrowUp: false,
      defaultLanguage: null,
      enableTabIndentation: false,
      tabSize: 2,
      HTMLAttributes: {},
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})
