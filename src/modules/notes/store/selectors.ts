import { useNotesStore } from './notesStore'
import { visibleNotes } from '../utils/document'
import type { NoteRecord, NoteView } from '../types'

/** The note currently open in the editor, or null. */
export function useActiveNote(): NoteRecord | null {
  return useNotesStore(
    (state) => state.notes.find((note) => note.id === state.activeNoteId) ?? null
  )
}

/** The filtered + ordered list for a view/tag/query. */
export function useVisibleNotes(view: NoteView, query: string): NoteRecord[] {
  const notes = useNotesStore((state) => state.notes)
  const tagFilter = useNotesStore((state) => state.tagFilter)
  return visibleNotes(notes, view, view === 'all' ? tagFilter : null, query)
}

/** The active note id, for lightweight subscription. */
export function useActiveNoteId(): string | null {
  return useNotesStore((state) => state.activeNoteId)
}
