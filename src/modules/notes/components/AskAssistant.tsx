import { useState } from 'react'
import { ArrowUp, Copy, Lock, RefreshCw, Sparkles, X } from 'lucide-react'
import { countWords } from '../document'
import { useNoteEditor } from '../editor/NoteEditorProvider'
import { useNotesStore } from '../store/notesStore'

export function AskAssistant() {
  const editor = useNoteEditor()
  const assistant = useNotesStore((state) => state.assistant)
  const closeAssistant = useNotesStore((state) => state.closeAssistant)
  const setAssistantPrompt = useNotesStore((state) => state.setAssistantPrompt)
  const runAssistant = useNotesStore((state) => state.runAssistant)
  const tryAssistantAgain = useNotesStore((state) => state.tryAssistantAgain)
  const [copyError, setCopyError] = useState<string | null>(null)
  const words = countWords(assistant.sourceText).words

  if (!assistant.open) return null

  const insert = () => {
    if (!editor || !assistant.bullets?.length) return
    const content = {
      type: 'bulletList',
      content: assistant.bullets.map((line) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: line }] }],
      })),
    }
    const at =
      assistant.scope === 'selection' ? editor.state.selection.to : editor.state.doc.content.size
    editor.chain().focus().insertContentAt(at, content).run()
    closeAssistant()
  }

  const copy = async () => {
    if (!assistant.bullets?.length) return
    try {
      await navigator.clipboard.writeText(assistant.bullets.map((line) => `• ${line}`).join('\n'))
      setCopyError(null)
    } catch {
      setCopyError('Clipboard permission was denied.')
    }
  }

  return (
    <div className="note-ai">
      <div className="note-ai-card">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="text-primary h-4 w-4" />
          <p className="text-foreground text-[13px] font-semibold">Summary</p>
          <span className="text-muted-foreground text-[12px]">
            from this {assistant.scope === 'selection' ? 'selection' : 'note'}
          </span>
          <button
            type="button"
            className="text-muted-foreground hover:bg-accent hover:text-foreground ml-auto flex h-6 w-6 items-center justify-center rounded-lg transition-colors duration-150"
            onClick={closeAssistant}
            aria-label="Close summary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {assistant.status === 'running' && (
          <p className="text-muted-foreground flex items-center gap-2 text-[13px]">
            Writing a summary
            <span className="note-ai-dots">
              <span />
              <span />
              <span />
            </span>
          </p>
        )}
        {assistant.status === 'error' && (
          <p className="text-destructive text-[13px]">{assistant.error}</p>
        )}
        {assistant.bullets && (
          <ul className="text-foreground/85 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed">
            {assistant.bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {copyError && <p className="text-destructive mt-2 text-[12px]">{copyError}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="bg-primary text-primary-foreground flex h-8 items-center rounded-lg px-3.5 text-[13px] font-medium shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45"
            onClick={insert}
            disabled={!assistant.bullets?.length}
          >
            Insert below
          </button>
          <button
            type="button"
            className="text-foreground hover:bg-accent flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150"
            onClick={() => void copy()}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            type="button"
            className="text-foreground hover:bg-accent flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150"
            onClick={tryAssistantAgain}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1.5 text-[12px] transition-colors duration-150"
            onClick={closeAssistant}
          >
            Discard <kbd className="note-kbd">esc</kbd>
          </button>
        </div>
      </div>

      <form
        className="note-ai-input"
        onSubmit={(event) => {
          event.preventDefault()
          void runAssistant()
        }}
      >
        <Sparkles className="text-primary h-4 w-4 shrink-0" />
        <input
          value={assistant.prompt}
          onChange={(event) => setAssistantPrompt(event.target.value)}
          className="text-foreground min-w-0 flex-1 bg-transparent text-[14px] outline-none"
          aria-label="Summary prompt"
        />
        <span className="note-ai-chip hidden sm:inline-flex">
          {assistant.scope === 'selection' ? 'Selection' : 'This note'} · {words} words
        </span>
        <button type="submit" className="note-ai-send" aria-label="Run summary">
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </form>

      <p className="text-muted-foreground mt-2 flex items-center justify-center gap-1.5 text-center text-[11px]">
        <Lock className="h-3 w-3 shrink-0" />
        Only the text you choose is decrypted for this request. Nothing is stored.
      </p>
    </div>
  )
}
