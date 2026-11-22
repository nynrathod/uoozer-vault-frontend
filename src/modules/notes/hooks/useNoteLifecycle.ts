import { useCallback, useEffect, useState } from 'react'
import { flushNotes, useNotesStore } from '../store/notesStore'
import { noteUiBus } from '../bus'
import { NOTE_NOTICE_MS } from '../constants'

export function useNoteLifecycle() {
  const [notice, setNotice] = useState<string | null>(null)

  // ── Persistence lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    const flush = () => flushNotes()
    window.addEventListener('beforeunload', flush)
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushNotes()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      flushNotes()
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  // ── Page-level bus → store / notices ────────────────────────────────────
  useEffect(
    () =>
      noteUiBus.subscribe((event) => {
        if (event.type === 'assistant.open') {
          useNotesStore
            .getState()
            .openAssistant(
              event.text
                ? { scope: 'selection', text: event.text, prompt: event.prompt }
                : event.prompt
                  ? { prompt: event.prompt }
                  : undefined
            )
        }
        if (event.type === 'notify') setNotice(event.message)
        if (event.type === 'note.open') {
          const store = useNotesStore.getState()
          const existing = event.noteId
            ? store.notes.find((note) => note.id === event.noteId && !note.trashed)
            : undefined
          if (existing) {
            store.setActive(existing.id)
            return
          }
          // Child page without an id yet: open (or create) by exact title.
          const byTitle = event.label
            ? store.notes.find((note) => !note.trashed && note.title === event.label)
            : undefined
          if (byTitle) store.setActive(byTitle.id)
          else if (event.label) {
            // The child-page block lives inside the open note, so a fresh
            // child is created UNDER the active note — never as a loose root.
            const parentId = store.activeNoteId
            if (parentId) store.createChildNote(parentId)
            else store.createNote()
            const created = useNotesStore.getState().activeNoteId
            if (created) store.setTitle(created, event.label)
          }
        }
      }),
    []
  )

  // ── Notice auto-dismiss ──────────────────────────────────────────────────
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), NOTE_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const dismissNotice = useCallback(() => setNotice(null), [])

  return { notice, dismissNotice }
}
