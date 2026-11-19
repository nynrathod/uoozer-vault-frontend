import { useState } from 'react'
import { Inbox, Plus, RotateCcw, Search, SearchX, Star, Trash2 } from 'lucide-react'
import { cn } from '@lib/utils'
import { visibleNotes } from '../document'
import type { NoteRecord, NoteView } from '../types'
import { formatNoteTime } from '../formatNoteTime'
import { useNotesStore } from '../store/notesStore'

const SECTION_LABEL: Record<NoteView, string> = {
  all: 'Notes',
  starred: 'Starred',
  pinned: 'Pinned',
  trash: 'Trash',
}

export function NotesList({ view, onCreate }: { view: NoteView; onCreate: () => void }) {
  const notes = useNotesStore((state) => state.notes)
  const activeNoteId = useNotesStore((state) => state.activeNoteId)
  const tagFilter = useNotesStore((state) => state.tagFilter)
  const setActive = useNotesStore((state) => state.setActive)
  const restoreNote = useNotesStore((state) => state.restoreNote)
  const deleteForever = useNotesStore((state) => state.deleteForever)
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const visible = visibleNotes(notes, view, tagFilter, query)
  const grouped = view === 'all' && !query
  const pinned = grouped ? visible.filter((note) => note.pinned) : []
  const rest = grouped ? visible.filter((note) => !note.pinned) : visible

  const rowProps = (note: NoteRecord) => ({
    note,
    active: note.id === activeNoteId,
    onSelect: () => setActive(note.id),
  })

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
    <aside className="bg-sidebar border-border/60 flex h-full w-full shrink-0 flex-col border-r md:w-[300px]">
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
          title="New note"
          onClick={onCreate}
          className="bg-primary text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm transition-all duration-150 hover:shadow-md active:scale-95"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-4">
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
              <NoteRow key={note.id} {...rowProps(note)} />
            ))}
          </section>
        )}

        {rest.length > 0 && (
          <section>
            {grouped ? (
              <SectionLabel>Notes</SectionLabel>
            ) : (
              <SectionLabel>{SECTION_LABEL[view]}</SectionLabel>
            )}
            {rest.map((note) => (
              <div key={note.id}>
                <NoteRow {...rowProps(note)} />
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
    </aside>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground/60 px-2 pt-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase">
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
            'truncate text-[13px] font-semibold',
            active ? 'text-primary' : 'text-foreground'
          )}
        >
          {note.title || 'Untitled'}
        </span>
        {note.starred && (
          <Star className="h-3 w-3 shrink-0 fill-current text-[hsl(var(--warning))]" />
        )}
        <span className="text-muted-foreground/80 ml-auto shrink-0 pl-1 text-[11px] tabular-nums">
          {formatNoteTime(note.updatedAt)}
        </span>
      </span>
      <span className="note-row-desc text-muted-foreground mt-1 line-clamp-2 text-[12px] leading-[1.45]">
        {note.plainText || 'Empty note'}
      </span>
    </button>
  )
}
