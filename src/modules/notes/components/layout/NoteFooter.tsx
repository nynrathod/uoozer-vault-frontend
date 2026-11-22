import { Lock } from 'lucide-react'
import { countWords } from '../../utils/document'
import type { NoteRecord } from '../../types'

const KINDS_WITH_OWN_FOOTER = new Set(['writer', 'safe', 'journal', 'capsule', 'notepad'])

export function NoteFooter({ note, focusMode }: { note: NoteRecord; focusMode: boolean }) {
  if (KINDS_WITH_OWN_FOOTER.has(note.pageStyle.kind) || note.pageStyle.kind === 'playful') {
    return null
  }
  const words = countWords(note.plainText)
  return (
    <footer
      className={
        focusMode
          ? 'text-muted-foreground flex h-9 shrink-0 items-center justify-between border-t border-transparent px-6 text-[11px] tabular-nums'
          : 'text-muted-foreground border-border/60 flex h-9 shrink-0 items-center justify-between border-t px-4 text-[11px] tabular-nums'
      }
    >
      <span>{words.words} words · auto-saved</span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
        End-to-end encrypted
        <Lock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
      </span>
    </footer>
  )
}
