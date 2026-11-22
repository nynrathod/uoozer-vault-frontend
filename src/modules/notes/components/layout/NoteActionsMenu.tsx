import { useEffect, useRef, useState } from 'react'
import { Maximize2, Palette, Pin, Trash2 } from 'lucide-react'
import { useNotesStore } from '../../store/notesStore'
import type { NoteRecord, NoteView } from '../../types'

export function NoteActionsMenu({
  note,
  view,
  onOpenStyle,
}: {
  note: NoteRecord
  view: NoteView
  onOpenStyle: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const setFocusMode = useNotesStore((state) => state.setFocusMode)
  const togglePin = useNotesStore((state) => state.togglePin)
  const trashNote = useNotesStore((state) => state.trashNote)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg p-2 transition-colors duration-150"
        aria-label="Note actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontalIcon />
      </button>

      {open && (
        <div className="note-pop right-0 w-48" role="menu">
          <button
            type="button"
            className="note-pop-item"
            role="menuitem"
            onClick={() => {
              setFocusMode(true)
              setOpen(false)
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" /> Focus mode
          </button>
          <button
            type="button"
            className="note-pop-item"
            role="menuitem"
            onClick={() => {
              togglePin(note.id)
              setOpen(false)
            }}
          >
            <Pin className="h-3.5 w-3.5" /> {note.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            className="note-pop-item"
            role="menuitem"
            onClick={() => {
              onOpenStyle()
              setOpen(false)
            }}
          >
            <Palette className="h-3.5 w-3.5" /> Style…
          </button>
          <span className="note-pop-sep" />
          <button
            type="button"
            className="note-pop-item note-pop-danger"
            role="menuitem"
            onClick={() => {
              trashNote(note.id, view)
              setOpen(false)
              window.dispatchEvent(new CustomEvent('note:trashed'))
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Move to trash
          </button>
        </div>
      )}
    </div>
  )
}

function MoreHorizontalIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  )
}
