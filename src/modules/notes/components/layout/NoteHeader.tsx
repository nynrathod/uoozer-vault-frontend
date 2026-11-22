import {
  ChevronLeft as ChevronLeftIcon,
  Maximize2,
  MoreHorizontal,
  PanelLeft,
  Sparkles,
  Star,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { flushNotes, useNotesStore } from '../../store/notesStore'
import { countWords } from '../../utils/document'
import { NoteActionsMenu } from './NoteActionsMenu'
import type { NoteRecord, NoteView } from '../../types'

export function NoteHeader({
  note,
  view,
  focusMode,
  isMobile,
  onExitMobileEditor,
  onOpenStyle,
  onExpandSidebar,
}: {
  note: NoteRecord
  view: NoteView
  focusMode: boolean
  isMobile: boolean
  onExitMobileEditor: () => void
  onOpenStyle: () => void
  /** Shown when the tree sidebar is collapsed (Notion's "⌘\\" affordance). */
  onExpandSidebar?: () => void
}) {
  const saveStatus = useNotesStore((state) => state.saveStatus)
  const setFocusMode = useNotesStore((state) => state.setFocusMode)
  const toggleStar = useNotesStore((state) => state.toggleStar)
  const openAssistant = useNotesStore((state) => state.openAssistant)
  const assistantOpen = useNotesStore((state) => state.assistant.open)
  const words = countWords(note.plainText)

  // Focus mode keeps the Final-3 exit pill; the writer kind draws its own
  // "Exit focus · esc" strip inside the canvas, so this bar is skipped there.
  if (focusMode && note.pageStyle.kind !== 'writer') {
    return (
      <header className="border-border/60 flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <button
          type="button"
          className="border-border/70 bg-card text-foreground hover:bg-accent flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium shadow-xs transition-colors duration-150"
          onClick={() => setFocusMode(false)}
        >
          <ChevronLeftIcon className="text-muted-foreground h-3.5 w-3.5" />
          Exit focus
          <kbd className="note-kbd">esc</kbd>
        </button>
        <span className="text-muted-foreground ml-auto text-[12px]">{words.words} words</span>
      </header>
    )
  }

  // Mobile editor back-header (E-Mobile sheet): ‹ Notes · Saved · ⋯.
  if (isMobile) {
    return (
      <header className="note-mobile-edithead">
        <button type="button" className="note-mobile-back" onClick={onExitMobileEditor}>
          <ChevronLeft />
          Notes
        </button>
        {saveStatus === 'saved' ? (
          <span className="note-mobile-saved">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Saved
          </span>
        ) : (
          <span className="note-mobile-saved" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {saveStatus === 'saving' ? 'Saving…' : 'Not saved'}
          </span>
        )}
        <button type="button" className="note-mobile-more" aria-label="More actions">
          <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
        </button>
      </header>
    )
  }

  return (
    <header className="note-lite-header">
      {onExpandSidebar && (
        <button
          type="button"
          className="note-lite-hbtn"
          aria-label="Expand sidebar"
          title="Expand sidebar"
          onClick={onExpandSidebar}
        >
          <PanelLeft className="h-[17px] w-[17px]" strokeWidth={1.6} />
        </button>
      )}
      <span
        className={cn(
          'note-lite-savedot',
          saveStatus === 'saving' && 'is-saving',
          saveStatus === 'error' && 'is-error'
        )}
        title={saveStatus === 'saved' ? 'Saved' : saveStatus}
      />
      <button
        type="button"
        className="note-lite-hbtn is-ai"
        aria-label="Ask AI"
        aria-pressed={assistantOpen}
        onClick={() => openAssistant()}
      >
        <Sparkles className="h-[17px] w-[17px]" strokeWidth={1.6} />
      </button>
      <button
        type="button"
        className={cn('note-lite-hbtn', note.starred && 'is-star')}
        aria-label={note.starred ? 'Unstar note' : 'Star note'}
        title={note.starred ? 'Unstar note' : 'Star note'}
        onClick={() => toggleStar(note.id)}
      >
        <Star
          className={cn('h-[17px] w-[17px]', note.starred && 'fill-current')}
          strokeWidth={1.6}
        />
      </button>
      <button
        type="button"
        className="note-lite-hbtn"
        aria-label="Focus mode"
        title="Focus mode"
        onClick={() => setFocusMode(true)}
      >
        <Maximize2 className="h-[17px] w-[17px]" strokeWidth={1.6} />
      </button>
      <NoteActionsMenu note={note} view={view} onOpenStyle={onOpenStyle} />
    </header>
  )
}

/** Re-exported for the workspace: retry the pending save. */
export function retrySave() {
  void flushNotes()
}

function ChevronLeft() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
