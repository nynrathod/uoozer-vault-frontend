import { FileText, StickyNote } from 'lucide-react'
import { NOTE_TEMPLATES } from '../../data/pageStyles'
import { useNotesStore } from '../../store/notesStore'
import { formatNoteTime } from '../../utils/formatNoteTime'
import { sortNotesByDisplay } from '../../utils/document'
import type { NoteView } from '../../types'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function NotesFirstRun({
  onCreateFromTemplate,
}: {
  onCreateFromTemplate: (id: string) => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-0 px-6 text-center">
      <div className="bg-headsup-tint text-headsup flex h-12 w-12 items-center justify-center rounded-[14px]">
        <StickyNote className="h-6 w-6" strokeWidth={1.6} />
      </div>
      <h2 className="text-foreground mt-[18px] text-2xl leading-8 font-semibold tracking-tight">
        Write your first note
      </h2>
      <p className="text-gray-strong mt-1.5 max-w-[300px] text-[14px] leading-[22px]">
        Everything is encrypted on this device. Press / inside a note for blocks.
      </p>
      <button
        type="button"
        className="note-pill-btn mt-5 h-[38px] px-4"
        onClick={() => onCreateFromTemplate('blank')}
      >
        New note <kbd className="uv-kbd ml-1.5">⌘N</kbd>
      </button>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {NOTE_TEMPLATES.filter((template) => template.id !== 'private').map((template) => (
          <button
            key={template.id}
            type="button"
            className="note-chip"
            onClick={() => onCreateFromTemplate(template.id)}
          >
            {template.label}
          </button>
        ))}
      </div>
      <p className="text-blue-ink mt-[22px] cursor-default text-[13px] font-medium">
        Import Markdown, Notion or Evernote
      </p>
    </div>
  )
}

export function NotesNoSelection({
  onOpen,
  onCreateFromTemplate,
}: {
  onOpen: (id: string) => void
  onCreateFromTemplate: (id: string) => void
}) {
  const notes = useNotesStore((state) => state.notes)
  const live = sortNotesByDisplay(notes.filter((note) => !note.trashed))
  const recent = live.slice(0, 5)
  const starters = NOTE_TEMPLATES.filter((template) =>
    ['journal', 'meeting', 'project', 'private'].includes(template.id)
  )

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-8 py-10">
      <h2 className="text-foreground text-[28px] leading-9 font-semibold tracking-tight">
        {greeting()}
      </h2>
      <p className="text-muted-foreground mt-1.5 text-[13.5px]">
        {live.length} {live.length === 1 ? 'note' : 'notes'} · all encrypted
      </p>

      <p className="note-group-label mt-6">Recent</p>
      <div>
        {recent.map((note) => (
          <button
            key={note.id}
            type="button"
            className="hover:bg-accent flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left transition-colors"
            onClick={() => onOpen(note.id)}
          >
            <FileText
              className="text-muted-foreground h-[17px] w-[17px] shrink-0"
              strokeWidth={1.6}
            />
            <span className="text-foreground min-w-0 flex-1 truncate text-[14px] font-medium">
              {note.title || 'Untitled'}
            </span>
            <span className="text-muted-foreground shrink-0 text-[12.5px]">
              {formatNoteTime(note.updatedAt)}
            </span>
          </button>
        ))}
      </div>

      <p className="note-group-label mt-6">Start from</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {starters.map((template) => (
          <button
            key={template.id}
            type="button"
            className="bg-secondary/60 hover:bg-accent h-14 rounded-[10px] px-3 py-2.5 text-left transition-colors"
            onClick={() => onCreateFromTemplate(template.id)}
          >
            <span className="text-foreground block text-[13.5px] font-medium">
              {template.label}
            </span>
            <span className="text-gray-strong block text-[12px]">{template.description}</span>
          </button>
        ))}
      </div>

      <p className="text-muted-foreground mt-[22px] text-[12.5px]">
        Tip: type / on an empty line to insert any block.
      </p>
    </div>
  )
}

export function NotesViewEmpty({ view, onCreate }: { view: NoteView; onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="bg-secondary text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
        <StickyNote className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <p className="text-muted-foreground text-[13px]">
        {view === 'trash' ? 'Nothing in the trash.' : 'No note in this view.'}
      </p>
      {view !== 'trash' && (
        <button type="button" className="note-pill-btn h-9" onClick={onCreate}>
          New note
        </button>
      )}
    </div>
  )
}
