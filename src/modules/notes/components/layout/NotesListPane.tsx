import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Inbox,
  Pin as PinIcon,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Settings as SettingsIcon,
  Star,
  StickyNote as StickyNoteIcon,
  Trash2,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { formatNoteTime } from '../../utils/formatNoteTime'
import { useNotesStore } from '../../store/notesStore'
import { useVisibleNotes } from '../../store/selectors'
import type { NoteRecord, NoteView } from '../../types'

const SECTION_LABEL: Record<NoteView, string> = {
  all: 'Notes',
  starred: 'Starred',
  pinned: 'Pinned',
  trash: 'Trash',
}

export function NotesListPane({
  view,
  onCreate,
  isMobile,
}: {
  view: NoteView
  onCreate: () => void
  isMobile: boolean
}) {
  const navigate = useNavigate()
  const activeNoteId = useNotesStore((state) => state.activeNoteId)
  const setActive = useNotesStore((state) => state.setActive)
  const restoreNote = useNotesStore((state) => state.restoreNote)
  const deleteForever = useNotesStore((state) => state.deleteForever)
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const visible = useVisibleNotes(view, query)
  const grouped = view === 'all' && !query
  const pinned = grouped ? visible.filter((note) => note.pinned) : []
  const rest = grouped ? visible.filter((note) => !note.pinned) : visible

  const openNote = (note: NoteRecord) => {
    setActive(note.id)
    if (isMobile) window.dispatchEvent(new CustomEvent('note:selected'))
  }

  const emptyCopy = query
    ? 'No notes match that search.'
    : view === 'trash'
      ? 'Nothing in the trash.'
      : view === 'starred'
        ? 'No starred notes yet.'
        : view === 'pinned'
          ? 'No pinned notes yet.'
          : 'No notes yet.'

  return (
    <aside className="bg-sidebar border-border/60 relative flex h-full w-full shrink-0 flex-col border-r md:w-[300px]">
      {/* Search + New note (hidden on mobile — the FAB replaces them) */}
      {!isMobile && (
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground/50 pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              className="placeholder:text-muted-foreground/60 bg-secondary/70 focus:border-primary/40 focus:bg-card h-9 w-full rounded-lg border border-transparent pr-3 pl-8 text-[13px] transition-all duration-150 outline-none"
            />
          </div>
          <button
            type="button"
            title="New note (⌘N)"
            onClick={onCreate}
            aria-label="New note"
            className="bg-primary text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm transition-all duration-150 hover:shadow-md active:scale-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      )}

      {/* Mobile heading (E-Mobile: large title + avatar + search bar) */}
      {isMobile && (
        <div className="px-5 pt-6">
          <div className="flex items-center gap-3">
            <h1 className="note-mobile-title">{SECTION_LABEL[view]}</h1>
            <span className="note-mobile-avatar" aria-hidden="true">
              N
            </span>
          </div>
          <div className="relative mt-4">
            <Search className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes..."
              aria-label="Search notes"
              className="bg-secondary/70 placeholder:text-muted-foreground/60 h-11 w-full rounded-[14px] border border-transparent pr-4 pl-11 text-[15px] outline-none"
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-4 md:px-2">
        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            {query ? (
              <SearchX className="text-muted-foreground/40 h-5 w-5" strokeWidth={1.75} />
            ) : (
              <Inbox className="text-muted-foreground/40 h-5 w-5" strokeWidth={1.75} />
            )}
            <p className="text-muted-foreground text-[13px]">{emptyCopy}</p>
          </div>
        )}

        {pinned.length > 0 && (
          <section className="mb-2">
            <SectionLabel>Pinned</SectionLabel>
            {pinned.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                active={note.id === activeNoteId}
                onSelect={() => openNote(note)}
              />
            ))}
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <SectionLabel>{grouped ? 'Notes' : SECTION_LABEL[view]}</SectionLabel>
            {rest.map((note) => (
              <div key={note.id}>
                <NoteRow
                  note={note}
                  active={note.id === activeNoteId}
                  onSelect={() => openNote(note)}
                />
                {view === 'trash' && note.id === activeNoteId && (
                  <div className="mt-0.5 mb-1.5 flex items-center gap-1.5 pl-3">
                    <button
                      type="button"
                      className="text-primary hover:bg-primary/10 flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium transition-colors duration-150"
                      onClick={() => restoreNote(note.id)}
                    >
                      <RotateCcw className="h-3 w-3" /> Restore
                    </button>
                    {pendingDelete === note.id ? (
                      <button
                        type="button"
                        className="text-destructive hover:bg-destructive/10 rounded-md px-2 py-1 text-[12px] font-medium transition-colors duration-150"
                        onClick={() => deleteForever(note.id)}
                      >
                        Delete forever
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center gap-1 rounded-md px-2 py-1 text-[12px] transition-colors duration-150"
                        onClick={() => setPendingDelete(note.id)}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </div>

      {/* Mobile bottom tab bar (E-Mobile: All Notes · Pinned · Trash · Settings) */}
      {isMobile && (
        <nav className="note-mobile-nav" aria-label="Notes sections">
          <button
            type="button"
            className={view === 'all' ? 'is-on' : ''}
            onClick={() => navigate(ROUTES.NOTES)}
          >
            <StickyNoteIcon className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
            All Notes
          </button>
          <button
            type="button"
            className={view === 'pinned' ? 'is-on' : ''}
            onClick={() => navigate(ROUTES.NOTES_PINNED)}
          >
            <PinIcon className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
            Pinned
          </button>
          <button
            type="button"
            className={view === 'trash' ? 'is-on' : ''}
            onClick={() => navigate(ROUTES.NOTES_TRASH)}
          >
            <Trash2 className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
            Trash
          </button>
          <button type="button" onClick={() => navigate('/settings')}>
            <SettingsIcon className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
            Settings
          </button>
        </nav>
      )}

      {/* Mobile FAB (E-Mobile: 56 · radius 18 · brand shadow) */}
      {isMobile && (
        <button
          type="button"
          className="note-mobile-fab"
          onClick={() => {
            onCreate()
            navigate(ROUTES.NOTES)
          }}
          aria-label="New note"
        >
          <Plus className="h-6 w-6" strokeWidth={2} />
        </button>
      )}
    </aside>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground/60 px-2 pt-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase md:text-[10px]">
      {children}
    </p>
  )
}

function NoteRow({
  note,
  active,
  onSelect,
}: {
  note: NoteRecord
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'note-row group relative mb-0.5 flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors duration-150',
        active ? 'bg-primary/10' : 'hover:bg-accent/70'
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            'note-row-title truncate text-[13px] font-semibold',
            active ? 'text-primary' : 'text-foreground'
          )}
        >
          {note.title || 'Untitled'}
        </span>
        {note.starred && (
          <Star className="h-3 w-3 shrink-0 fill-current text-[hsl(var(--warning))]" />
        )}
        <span className="note-row-time text-muted-foreground/80 ml-auto shrink-0 pl-1 text-[11px] tabular-nums">
          {formatNoteTime(note.updatedAt)}
        </span>
      </span>
      <span className="note-row-desc text-muted-foreground mt-1 line-clamp-2 text-[12px] leading-[1.45]">
        {note.plainText || 'Empty note'}
      </span>
    </button>
  )
}
