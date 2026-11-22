import { Check, Loader2 } from 'lucide-react'
import { flushNotes } from '../../store/notesStore'
import type { SaveStatus } from '../../types'

export function NoteSaveState({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'saving') {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 px-2 text-[12px] tabular-nums">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    )
  }
  if (status === 'error') {
    return (
      <button
        type="button"
        className="text-destructive hover:bg-destructive/10 rounded-lg px-2 py-1 text-[12px] font-medium transition-colors duration-150"
        onClick={() => void flushNotes()}
      >
        {error ? 'Retry save' : 'Not saved'}
      </button>
    )
  }
  return (
    <span className="flex items-center gap-1 px-2 text-[12px] font-medium text-[hsl(var(--success))]">
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Saved
    </span>
  )
}
