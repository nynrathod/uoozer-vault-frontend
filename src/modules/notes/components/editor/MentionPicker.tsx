import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useNoteEditor } from '../../editor/NoteEditorProvider'
import { onUiEvent } from '../../editor/uiEvents'
import { insertNoteLink } from '../../editor/commands'
import { useNotesStore } from '../../store/notesStore'
import { sortNotesByDisplay } from '../../utils/document'

const PICKER_WIDTH = 300
const PICKER_HEIGHT = 288

export function MentionPicker() {
  const editor = useNoteEditor()
  const notes = useNotesStore((state) => state.notes)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const live = useMemo(() => sortNotesByDisplay(notes.filter((note) => !note.trashed)), [notes])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return live.slice(0, 8)
    return live.filter((note) => (note.title || 'Untitled').toLowerCase().includes(q)).slice(0, 8)
  }, [live, query])

  useEffect(() => {
    if (!editor) return
    return onUiEvent((event) => {
      if (event.type !== 'link.open') return
      try {
        if (editor.isDestroyed) return
        const coords = editor.view.coordsAtPos(editor.state.selection.from)
        setAnchor({ x: coords.left, y: coords.bottom })
        setQuery('')
        setIndex(0)
      } catch {
        // Position unavailable (view gone); skip opening.
      }
    })
  }, [editor])

  useEffect(() => {
    if (!anchor) return
    const close = () => setAnchor(null)
    const onDocDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setAnchor(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setAnchor(null)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        setIndex((current) => (filtered.length ? (current + 1) % filtered.length : 0))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        setIndex((current) =>
          filtered.length ? (current - 1 + filtered.length) % filtered.length : 0
        )
      } else if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        const note = filtered[index]
        if (note && editor) {
          insertNoteLink(editor, note.title || 'Untitled', note.id, note.plainText)
          setAnchor(null)
        }
      }
    }
    document.addEventListener('mousedown', onDocDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [anchor, filtered, index, editor])

  if (!editor || !anchor) return null

  const left = Math.max(8, Math.min(anchor.x, window.innerWidth - PICKER_WIDTH - 8))
  const openUp = anchor.y + PICKER_HEIGHT + 48 > window.innerHeight
  const top = openUp ? Math.max(8, anchor.y - PICKER_HEIGHT - 8) : anchor.y + 8

  const pick = (noteId: string, label: string, excerpt: string) => {
    insertNoteLink(editor, label, noteId, excerpt)
    setAnchor(null)
  }

  return (
    <div
      ref={rootRef}
      className="note-emoji"
      style={{ top, left, width: PICKER_WIDTH }}
      role="dialog"
      aria-label="Link to a note"
    >
      <div className="note-emoji-search">
        <Search className="text-muted-foreground h-3.5 w-3.5" />
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIndex(0)
          }}
          placeholder="Search notes…"
          aria-label="Search notes to link"
          onKeyDown={(event) => event.stopPropagation()}
        />
      </div>
      <div className="note-emoji-groups">
        {filtered.length === 0 && (
          <p className="text-muted-foreground px-1 py-6 text-center text-[12px]">No notes found</p>
        )}
        {filtered.map((note, noteIndex) => (
          <button
            key={note.id}
            type="button"
            className={`note-pop-item ${noteIndex === index ? 'is-active' : ''}`}
            onMouseEnter={() => setIndex(noteIndex)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(note.id, note.title || 'Untitled', note.plainText)}
          >
            <span className="w-4 shrink-0 text-center text-[13px] leading-none" aria-hidden="true">
              {note.icon ?? '📄'}
            </span>
            <span className="min-w-0 flex-1 truncate">{note.title || 'Untitled'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
