import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '@lib/constants'
import { viewFromPath, visibleNotes } from '../utils/document'
import { useNotesStore } from '../store/notesStore'
import type { NoteView } from '../types'

export function useNotesView(): NoteView {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const view = viewFromPath(pathname)

  const notes = useNotesStore((state) => state.notes)
  const activeNoteId = useNotesStore((state) => state.activeNoteId)
  const tagFilter = useNotesStore((state) => state.tagFilter)
  const setActive = useNotesStore((state) => state.setActive)
  const setTagFilter = useNotesStore((state) => state.setTagFilter)

  // Tag filters only apply on the All Notes view; leaving it clears them.
  useEffect(() => {
    if (view !== 'all' && tagFilter) setTagFilter(null)
  }, [view, tagFilter, setTagFilter])

  // Keep a valid active note: when the current one leaves the visible set
  // (filtered out, trashed), fall back to the first visible row.
  useEffect(() => {
    const visible = visibleNotes(notes, view, view === 'all' ? tagFilter : null, '')
    if (activeNoteId && visible.some((item) => item.id === activeNoteId)) return
    setActive(visible[0]?.id ?? null)
  }, [notes, view, tagFilter, activeNoteId, setActive])

  // Programmatic navigation helper used by menus and empty states.
  useEffect(() => {
    // Exposed via a module-level ref so components can call goHome()
    notesViewNavigate = navigate
  }, [navigate])

  return view
}

/** Navigate-to-All-Notes handle (set by the hook above). */
let notesViewNavigate: ReturnType<typeof useNavigate> | null = null

export function goNotesHome() {
  notesViewNavigate?.(ROUTES.NOTES)
}
