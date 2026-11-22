/* Screens */
export { NotesWorkspace } from './components/NotesWorkspace'

/* State (store + persistence seam) */
export { useNotesStore, flushNotes, setNotesRepository } from './store/notesStore'

/* Search — content-aware notes matching for the shell ⌘K dialog and any
   other surface. ONE implementation; import it where results render. */
export { searchNotes, noteMatchesQuery } from './utils/searchNotes'
export type { NoteSearchHit } from './utils/searchNotes'

/* Types for typed consumers (router guards, future share views, tests) */
export type {
  AssistantState,
  BurnAfter,
  NoteRecord,
  NoteTemplate,
  NoteTint,
  NoteView,
  PageBackground,
  PageFont,
  PageStyle,
  PageTextSize,
  SaveStatus,
  SealedNoteBlob,
} from './types'
