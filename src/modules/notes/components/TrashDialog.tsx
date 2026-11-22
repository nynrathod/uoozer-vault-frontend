import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, RotateCcw, Search, SearchX, Trash2, X } from 'lucide-react'
import { cn } from '@lib/utils'
import { useNotesStore } from '../store/notesStore'
import { formatNoteTime } from '../utils/formatNoteTime'
import type { NoteRecord } from '../types'

export function TrashDialog() {
  const open = useNotesStore((state) => state.trashOpen)
  const notes = useNotesStore((state) => state.notes)
  const restoreNote = useNotesStore((state) => state.restoreNote)
  const deleteForever = useNotesStore((state) => state.deleteForever)
  const close = () => useNotesStore.getState().setTrashOpen(false)

  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [pendingEmpty, setPendingEmpty] = useState(false)

  const trashed = useMemo(
    () =>
      notes
        .filter((note) => note.trashed)
        .filter((note) =>
          (note.title || 'Untitled').toLowerCase().includes(query.trim().toLowerCase())
        ),
    [notes, query]
  )

  /* Fresh state each time it opens. */
  useEffect(() => {
    if (open) {
      setQuery('')
      setPendingDelete(null)
      setPendingEmpty(false)
    }
  }, [open])

  /* Escape closes (matches every other notes overlay). */
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const rowAction = 'trashd-btn'
  const confirmForever = (note: NoteRecord) => {
    if (pendingDelete === note.id) {
      deleteForever(note.id)
      setPendingDelete(null)
    } else {
      setPendingDelete(note.id)
    }
  }

  return createPortal(
    <div
      className="trashd-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={panelRef}
        className="trashd-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Trash"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="trashd-head">
          <span className="trashd-title">Trash</span>
          {trashed.length > 0 && <span className="nsb-kbd">{trashed.length}</span>}

          <div className="trashd-search">
            <Search aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPendingDelete(null)
              }}
              placeholder="Search trash"
              aria-label="Search trash"
            />
          </div>

          <button type="button" className="trashd-close" aria-label="Close trash" onClick={close}>
            <X className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>

        <div className="trashd-list">
          {trashed.length === 0 && (
            <div className="trashd-empty">
              {query ? (
                <>
                  <SearchX className="mx-auto mb-2 h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  No trashed notes match that search.
                </>
              ) : (
                'Nothing in the trash.'
              )}
            </div>
          )}

          {trashed.map((note) => (
            <div key={note.id} className="trashd-row">
              <span className="trashd-ic" aria-hidden="true">
                {note.icon ?? <FileText className="h-4 w-4" strokeWidth={1.6} />}
              </span>
              <span className="trashd-main">
                <span className="trashd-t">{note.title || 'Untitled'}</span>
                <span className="trashd-time">Deleted {formatNoteTime(note.updatedAt)}</span>
              </span>
              <button
                type="button"
                className={rowAction}
                onClick={() => {
                  restoreNote(note.id)
                  setPendingDelete(null)
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
                Restore
              </button>
              <button
                type="button"
                className={cn(rowAction, pendingDelete === note.id && 'is-danger')}
                onClick={() => confirmForever(note)}
                onBlur={() => setPendingDelete(null)}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
                {pendingDelete === note.id ? 'Really delete?' : 'Delete'}
              </button>
            </div>
          ))}
        </div>

        {trashed.length > 0 && (
          <div className="trashd-foot">
            <p className="nsb-kbd">Deleted notes can be restored until you empty the trash.</p>
            <button
              type="button"
              className={cn(rowAction, pendingEmpty && 'is-danger')}
              onClick={() => {
                if (pendingEmpty) {
                  for (const note of trashed) deleteForever(note.id)
                  setPendingEmpty(false)
                } else {
                  setPendingEmpty(true)
                }
              }}
              onMouseLeave={() => setPendingEmpty(false)}
            >
              {pendingEmpty ? 'Delete everything?' : 'Empty trash'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
