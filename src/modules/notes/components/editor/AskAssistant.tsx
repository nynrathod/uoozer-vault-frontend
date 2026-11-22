import { useState } from 'react'
import { ArrowUp, Copy, Lock, RefreshCw, Sparkles, X } from 'lucide-react'
import { AI_PROMPT_PRESETS } from '../../constants'
import { countWords } from '../../utils/document'
import { useNoteEditor } from '../../editor/NoteEditorProvider'
import { useNotesStore } from '../../store/notesStore'

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

  const applyPreset = (preset: string) => {
    setAssistantPrompt(
      preset === 'Summarize' ? 'Summarize this note in three bullets' : `${preset} this note`
    )
  }

  return (
    <div className="note-ai">
      <div className="note-ai-inner">
        <div className="note-ai-card">
          <div className="note-ai-head">
            <Sparkles className="text-primary h-[15px] w-[15px]" />
            <p className="text-foreground text-[13px] font-semibold">Summary</p>
            <p className="text-muted-foreground text-[12px]">
              from this {assistant.scope === 'selection' ? 'selection' : 'note'}
            </p>
            <button
              type="button"
              className="note-icon-btn ml-auto"
              onClick={closeAssistant}
              aria-label="Close summary"
            >
              <X className="h-[15px] w-[15px]" />
            </button>
          </div>

          {assistant.status === 'running' && (
            <p className="text-muted-foreground flex items-center gap-2 px-4 pb-3 text-[13px]">
              Writing a summary
              <span className="note-ai-dots">
                <span />
                <span />
                <span />
              </span>
            </p>
          )}
          {assistant.status === 'error' && (
            <p className="text-destructive px-4 pb-3 text-[13px]">{assistant.error}</p>
          )}
          {assistant.bullets && (
            <ul className="note-ai-bullets">
              {assistant.bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {copyError && <p className="text-destructive px-4 pb-2 text-[12px]">{copyError}</p>}

          <div className="note-ai-foot">
            <button
              type="button"
              className="note-pill-btn h-[30px] px-3"
              onClick={insert}
              disabled={!assistant.bullets?.length}
            >
              Insert below
            </button>
            <button
              type="button"
              className="text-gray-strong hover:bg-accent flex h-[30px] items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-150"
              onClick={() => void copy()}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            <button
              type="button"
              className="text-gray-strong hover:bg-accent flex h-[30px] items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-150"
              onClick={tryAssistantAgain}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-2 text-[13px] font-medium"
              onClick={closeAssistant}
            >
              Discard <kbd className="note-kbd">esc</kbd>
            </button>
          </div>
        </div>

        <form
          className="note-ai-composer"
          onSubmit={(event) => {
            event.preventDefault()
            void runAssistant()
          }}
        >
          <Sparkles className="text-primary h-[17px] w-[17px] shrink-0" />
          <input
            value={assistant.prompt}
            onChange={(event) => setAssistantPrompt(event.target.value)}
            aria-label="Summary prompt"
            placeholder="Ask about this note…"
          />
          <span className="note-ai-chip hidden sm:inline-flex">
            <Lock className="h-3 w-3" />
            {assistant.scope === 'selection' ? 'Selection' : 'This note'} · {words} words
          </span>
          <button type="submit" className="note-ai-send" aria-label="Run summary">
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </form>

        <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
          {AI_PROMPT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="note-chip"
              onClick={() => applyPreset(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <p className="note-ai-privacy">
          <Lock className="h-3 w-3 shrink-0" />
          Only the text you choose to send is decrypted for this request. Nothing is stored.
        </p>
      </div>
    </div>
  )
}
