import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  CornerUpLeft,
  FileText,
  Folder,
  Hourglass,
  Lightbulb,
  MoreHorizontal,
  PanelLeft,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
  Sun,
  Trash2,
  Type,
} from 'lucide-react'
import { ROUTES } from '@lib/constants'
import { useNotesView } from '../../hooks/useNotesView'
import { buildNoteTree, filterNoteTree, type NoteTreeNode } from '../../utils/noteTree'
import { noteCounts } from '../../utils/document'
import { useNotesStore } from '../../store/notesStore'
import { EmojiPopover } from '../editor/EmojiPopover'
import type { NoteKind, NoteRecord, NoteView } from '../../types'

const TREE_PREVIEW = 4
const EXPANDED_KEY = 'uoozer.notes.tree.expanded'

/** Fallback glyph per kind (the sheet gives every note its own icon). */
const KIND_ICON: Partial<Record<NoteKind, typeof FileText>> = {
  writer: RefreshCw,
  journal: Sun,
  notepad: StickyNote,
  playful: Lightbulb,
  capsule: Hourglass,
  stickyBoard: StickyNote,
}

function RowIcon({ note, size = 16 }: { note: NoteRecord; size?: number }) {
  const Icon = KIND_ICON[note.pageStyle.kind] ?? FileText
  return note.icon ? (
    <span
      className="flex-none leading-none"
      style={{ width: size, fontSize: Math.max(12, size - 2) }}
      aria-hidden="true"
    >
      {note.icon}
    </span>
  ) : (
    <Icon style={{ width: size, height: size, strokeWidth: 1.6 }} aria-hidden="true" />
  )
}

/** Expanded subtree ids, remembered across sessions. */
function readExpanded(): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(EXPANDED_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function writeExpanded(state: Record<string, boolean>) {
  try {
    sessionStorage.setItem(EXPANDED_KEY, JSON.stringify(state))
  } catch {
    /* storage can be blocked */
  }
}

interface RowMenuState {
  note: NoteRecord
  x: number
  y: number
}

interface MoveMenuState {
  note: NoteRecord
  x: number
  y: number
}

export function NotesTreeSidebar({ onCollapse }: { onCollapse?: () => void }) {
  const navigate = useNavigate()
  const view = useNotesView()
  const notes = useNotesStore((state) => state.notes)
  const activeNoteId = useNotesStore((state) => state.activeNoteId)
  const tagFilter = useNotesStore((state) => state.tagFilter)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(readExpanded)
  const [showMore, setShowMore] = useState<Record<string, boolean>>({})
  const [tagsOpen, setTagsOpen] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null)
  const [moveMenu, setMoveMenu] = useState<MoveMenuState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [iconPicker, setIconPicker] = useState<{
    note: NoteRecord
    anchor: HTMLElement | null
  } | null>(null)

  const searchRef = useRef<HTMLInputElement | null>(null)

  const counts = useMemo(() => noteCounts(notes), [notes])
  const tree = useMemo(() => buildNoteTree(notes), [notes])

  /* View (all / starred / pinned) prunes the tree to matching notes. */
  const viewFiltered = useMemo(() => {
    if (view === 'all') return tree
    const keep = (note: NoteRecord) =>
      view === 'starred' ? note.starred : view === 'pinned' ? note.pinned : true
    const walk = (nodes: NoteTreeNode[]): NoteTreeNode[] =>
      nodes
        .map((node) => ({ ...node, children: walk(node.children) }))
        .filter((node) => keep(node.note) || node.children.length > 0)
    return walk(tree)
  }, [tree, view])

  const filtered = useMemo(() => filterNoteTree(viewFiltered, query), [viewFiltered, query])

  /* Search forces matching branches open; collapsed state from storage. */
  const isOpen = (node: NoteTreeNode): boolean => {
    if (query.trim()) return Boolean(node.hasMatch)
    return expanded[node.note.id] ?? node.children.length > 0
  }

  const toggleExpanded = (id: string) => {
    setExpanded((state) => {
      const next = { ...state, [id]: !(state[id] ?? true) }
      writeExpanded(next)
      return next
    })
  }

  const pinned = useMemo(
    () => notes.filter((note) => note.pinned && !note.trashed).slice(0, 3),
    [notes]
  )

  // ⌘K focuses search, ⌘N creates a note (Lite sheet shortcuts).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearching(true)
        window.setTimeout(() => searchRef.current?.focus(), 0)
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        createRootNote()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!rowMenu && !moveMenu) return
    const close = () => {
      setRowMenu(null)
      setMoveMenu(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [rowMenu, moveMenu])

  const openNote = (id: string) => {
    useNotesStore.getState().setActive(id)
    window.dispatchEvent(new Event('note:selected'))
  }

  const createRootNote = () => {
    useNotesStore.getState().createNote()
    useNotesStore.getState().setTagFilter(null)
    navigate(ROUTES.NOTES)
    window.dispatchEvent(new Event('note:selected'))
  }

  const createChild = (parentId: string) => {
    useNotesStore.getState().createChildNote(parentId)
    useNotesStore.getState().setTagFilter(null)
    navigate(ROUTES.NOTES)
    setExpanded((state) => {
      const next = { ...state, [parentId]: true }
      writeExpanded(next)
      return next
    })
    window.dispatchEvent(new Event('note:selected'))
  }

  const gotoView = (next: NoteView) => {
    useNotesStore.getState().setTagFilter(null)
    navigate(
      next === 'trash'
        ? ROUTES.NOTES_TRASH
        : next === 'starred'
          ? ROUTES.NOTES_STARRED
          : next === 'pinned'
            ? ROUTES.NOTES_PINNED
            : ROUTES.NOTES
    )
    setViewMenuOpen(false)
  }

  const startRename = (note: NoteRecord) => {
    setRenamingId(note.id)
    setRenameValue(note.title)
    setRowMenu(null)
  }

  const commitRename = () => {
    if (renamingId) {
      const title = renameValue.trim()
      if (title) useNotesStore.getState().setTitle(renamingId, title)
    }
    setRenamingId(null)
  }

  /** Candidate parents for "Move under page": every live note that is not
   *  the moved note itself nor one of its descendants. */
  const moveTargets = (note: NoteRecord): NoteRecord[] => {
    const excluded = new Set<string>([note.id])
    const mark = (parentId: string | null) => {
      if (!parentId) return
      excluded.add(parentId)
      for (const child of notes) if (child.parentNoteId === parentId) mark(child.id)
    }
    mark(note.id)
    return notes.filter((candidate) => !candidate.trashed && !excluded.has(candidate.id))
  }

  /* ── One recursive row ─────────────────────────────────────────────────── */
  const renderRow = (node: NoteTreeNode): ReactNode => {
    const { note, children, depth } = node
    const open = isOpen(node)
    const previewCount = showMore[note.id]
      ? children.length
      : Math.min(children.length, TREE_PREVIEW)
    const indent = 8 + depth * 18
    const isActive = note.id === activeNoteId

    return (
      <div key={note.id}>
        {renamingId === note.id ? (
          <div className="note-lite-row" style={{ paddingLeft: indent }}>
            <RowIcon note={note} />
            <input
              autoFocus
              value={renameValue}
              aria-label="Rename note"
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') commitRename()
                if (event.key === 'Escape') setRenamingId(null)
              }}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            className={`note-lite-row ${isActive ? 'is-active' : ''}`}
            style={{ paddingLeft: indent }}
            onClick={() => openNote(note.id)}
          >
            {/* Chevron slot — always reserved so icons align down the tree. */}
            <span
              className="note-lite-chevron"
              role={children.length > 0 ? 'button' : undefined}
              tabIndex={children.length > 0 ? -1 : undefined}
              aria-label={children.length > 0 ? (open ? 'Collapse' : 'Expand') : undefined}
              aria-hidden={children.length === 0}
              onClick={
                children.length > 0
                  ? (event) => {
                      event.stopPropagation()
                      toggleExpanded(note.id)
                    }
                  : undefined
              }
              onKeyDown={
                children.length > 0
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleExpanded(note.id)
                      }
                    }
                  : undefined
              }
            >
              {children.length > 0 && (
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
                  strokeWidth={1.75}
                />
              )}
            </span>
            <RowIcon note={note} />
            <span className="flex-1">{note.title || 'Untitled'}</span>
            <span className="note-lite-row-actions">
              <button
                type="button"
                aria-label="Note actions"
                onClick={(event) => {
                  event.stopPropagation()
                  const rect = event.currentTarget.getBoundingClientRect()
                  setRowMenu({ note, x: rect.left, y: rect.bottom + 4 })
                }}
              >
                <MoreHorizontal className="h-4 w-4" strokeWidth={2.2} />
              </button>
              <button
                type="button"
                aria-label="Add a child page"
                onClick={(event) => {
                  event.stopPropagation()
                  createChild(note.id)
                }}
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </span>
          </button>
        )}

        {open && children.slice(0, previewCount).map((child) => renderRow(child))}
        {open && children.length > TREE_PREVIEW && !showMore[note.id] && (
          <button
            type="button"
            className="note-lite-row note-lite-more"
            style={{ paddingLeft: indent + 22 }}
            onClick={() => setShowMore((state) => ({ ...state, [note.id]: true }))}
          >
            Show {children.length - TREE_PREVIEW} more
          </button>
        )}
      </div>
    )
  }

  /* ── Row ⋯ menu (portal, fixed) ────────────────────────────────────────── */
  const renderRowMenu = () => {
    if (!rowMenu) return null
    const { note, x, y } = rowMenu
    const item = 'note-pop-item'
    return createPortal(
      <div
        className="note-pop w-[184px] p-1"
        style={{
          position: 'fixed',
          left: Math.min(x, window.innerWidth - 196),
          top: y,
          zIndex: 70,
        }}
        role="menu"
        aria-label="Note actions"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={item}
          onClick={() => {
            openNote(note.id)
            setRowMenu(null)
          }}
        >
          <FileText className="h-3.5 w-3.5" strokeWidth={1.6} /> Open
        </button>
        <button type="button" className={item} onClick={() => startRename(note)}>
          <PencilLine className="h-3.5 w-3.5" strokeWidth={1.6} /> Rename
        </button>
        <button
          type="button"
          className={item}
          onClick={() => {
            createChild(note.id)
            setRowMenu(null)
          }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.6} /> Add child page
        </button>
        <button
          type="button"
          className={item}
          onClick={(event) => {
            // A fixed marker at the button's rect anchors the emoji popover
            // even after this menu unmounts.
            const rect = event.currentTarget.getBoundingClientRect()
            const marker = document.createElement('span')
            marker.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.bottom}px;width:1px;height:1px;pointer-events:none;`
            document.body.appendChild(marker)
            setIconPicker({ note, anchor: marker })
            setRowMenu(null)
          }}
        >
          <Type className="h-3.5 w-3.5" strokeWidth={1.6} /> Change icon
        </button>
        <button
          type="button"
          className={item}
          onClick={() => {
            useNotesStore.getState().duplicateNote(note.id)
            setRowMenu(null)
          }}
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={1.6} /> Duplicate
        </button>
        <button
          type="button"
          className={item}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            setMoveMenu({ note, x: rect.right + 6, y: rect.top })
            setRowMenu(null)
          }}
        >
          <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
          <span className="flex-1">Move under page</span>
          <ChevronRight className="note-pop-chevron h-3 w-3" strokeWidth={1.75} />
        </button>
        <span className="note-pop-sep" />
        <button
          type="button"
          className="note-pop-item note-pop-danger"
          onClick={() => {
            useNotesStore.getState().trashNote(note.id, view)
            setRowMenu(null)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} /> Move to trash
        </button>
      </div>,
      document.body
    )
  }

  const renderMoveMenu = () => {
    if (!moveMenu) return null
    const { note, x, y } = moveMenu
    const targets = moveTargets(note)
    return createPortal(
      <div
        className="note-pop max-h-[280px] w-[210px] overflow-y-auto p-1"
        style={{
          position: 'fixed',
          left: Math.min(x, window.innerWidth - 222),
          top: y,
          zIndex: 70,
        }}
        role="menu"
        aria-label="Move under page"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="note-pop-item"
          onClick={() => {
            useNotesStore.getState().setNoteParent(note.id, null)
            setMoveMenu(null)
          }}
        >
          <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={1.6} /> Top level
        </button>
        <span className="note-pop-sep" />
        {targets.length === 0 && (
          <p className="note-pop-empty px-2 py-1 text-[12px]">No other pages</p>
        )}
        {targets.slice(0, 40).map((target) => (
          <button
            key={target.id}
            type="button"
            className="note-pop-item"
            onClick={() => {
              useNotesStore.getState().setNoteParent(note.id, target.id)
              setMoveMenu(null)
            }}
          >
            <RowIcon note={target} size={14} />
            <span className="flex-1 truncate">{target.title || 'Untitled'}</span>
          </button>
        ))}
      </div>,
      document.body
    )
  }

  const rows = (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Pinned — the sheet keeps it above the tree. */}
      {pinned.length > 0 && (
        <>
          <p className="note-lite-label">Pinned</p>
          <div className="flex flex-col gap-px">
            {pinned.map((note) => (
              <button
                key={note.id}
                type="button"
                className={`note-lite-row ${note.id === activeNoteId ? 'is-active' : ''}`}
                onClick={() => openNote(note.id)}
              >
                <RowIcon note={note} />
                <span>{note.title || 'Untitled'}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Notes label with the "All ⌄" view switcher. */}
      <p className="note-lite-label">
        <span className="flex-1">Notes</span>
        <span className="note-lite-label-side">
          <button
            type="button"
            onClick={() => setViewMenuOpen((open) => !open)}
            className="flex items-center gap-0.5"
          >
            {view === 'trash'
              ? 'Trash'
              : view === 'starred'
                ? 'Starred'
                : view === 'pinned'
                  ? 'Pinned'
                  : 'All'}
            <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
          </button>
        </span>
      </p>
      {viewMenuOpen && (
        <div className="note-pop mb-1 w-[120px] p-1">
          {(['all', 'starred', 'pinned'] as NoteView[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`note-lite-row capitalize ${view === option ? 'is-active' : ''}`}
              onClick={() => gotoView(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {searching && (
        <div className="mb-1 flex h-[30px] items-center gap-2 rounded-md bg-[hsl(var(--accent))] px-2">
          <Search className="h-3.5 w-3.5 flex-none text-[#8a93a3]" />
          <input
            ref={searchRef}
            value={query}
            placeholder="Search notes…"
            onChange={(event) => setQuery(event.target.value)}
            onBlur={() => !query && setSearching(false)}
            className="w-full bg-transparent text-[13px] outline-none"
          />
        </div>
      )}

      <div className="flex flex-col gap-px">{filtered.map((node) => renderRow(node))}</div>
      {filtered.length === 0 && (
        <p className="note-lite-row" style={{ cursor: 'default' }}>
          <span>{query.trim() ? 'No notes match.' : 'No notes yet.'}</span>
        </p>
      )}

      {/* Tags — collapsed by default, per the sheet. */}
      <p className="note-lite-label" onClick={() => setTagsOpen((open) => !open)}>
        <ChevronRight
          className={`mr-1 h-3 w-3 transition-transform ${tagsOpen ? 'rotate-90' : ''}`}
          strokeWidth={1.75}
        />
        <span className="flex-1">Tags</span>
      </p>
      {tagsOpen && (
        <div className="flex flex-col gap-px">
          {counts.tags.map((tag) => (
            <button
              key={tag.name}
              type="button"
              className={`note-lite-row ${tagFilter === tag.name ? 'is-active' : ''}`}
              onClick={() => {
                useNotesStore.getState().setTagFilter(tagFilter === tag.name ? null : tag.name)
                navigate(ROUTES.NOTES)
              }}
            >
              <span className="flex-1">#{tag.name}</span>
              <span className="note-lite-kbd">{tag.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <aside className="note-lite-aside">
      {/* Workspace identity row. */}
      <div className="note-lite-ws">
        <span className="note-lite-ws-badge">U</span>
        <span className="note-lite-ws-name">Personal</span>
        <ChevronsUpDown
          className="h-3.5 w-3.5 text-[#8a93a3]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        {onCollapse && (
          <button
            type="button"
            className="note-lite-collapse"
            aria-label="Collapse sidebar"
            onClick={onCollapse}
          >
            <PanelLeft className="h-4 w-4" strokeWidth={1.6} />
          </button>
        )}
      </div>

      {/* Files / Notes. */}
      <div className="note-lite-group">
        <button type="button" className="note-lite-row" onClick={() => navigate(ROUTES.VAULT)}>
          <Folder className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
          <span className="flex-1">Files</span>
        </button>
        <div className="note-lite-row is-open" role="status">
          <StickyNote className="is-lead h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
          <span className="flex-1">Notes</span>
        </div>
      </div>

      {/* Search / New note. */}
      <div className="note-lite-group">
        <button
          type="button"
          className="note-lite-row"
          onClick={() => {
            setSearching((state) => !state)
            window.setTimeout(() => searchRef.current?.focus(), 0)
          }}
        >
          <Search className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
          <span className="flex-1">Search</span>
          <span className="note-lite-kbd">⌘K</span>
        </button>
        <button type="button" className="note-lite-row" onClick={createRootNote}>
          <Plus className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
          <span className="flex-1">New note</span>
          <span className="note-lite-kbd">⌘N</span>
        </button>
      </div>

      {rows}

      {/* Trash + account at the bottom. */}
      <div className="note-lite-trash note-lite-group">
        <button
          type="button"
          className={`note-lite-row ${view === 'trash' ? 'is-active' : ''}`}
          onClick={() => gotoView('trash')}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
          <span className="flex-1">Trash</span>
          {counts.trash > 0 && <span className="note-lite-kbd">{counts.trash}</span>}
        </button>
        <button type="button" className="note-lite-account" aria-label="Account menu">
          <span className="note-lite-account-avatar">N</span>
          <span className="note-lite-account-mail">nayan@uoozer.com</span>
          <ChevronDown
            className="h-3.5 w-3.5 rotate-180 text-[#8a93a3]"
            strokeWidth={1.6}
            aria-hidden="true"
          />
        </button>
      </div>

      {renderRowMenu()}
      {renderMoveMenu()}
      <EmojiPopover
        open={iconPicker !== null}
        onClose={() => setIconPicker(null)}
        anchorEl={iconPicker?.anchor ?? null}
        label="Change icon"
        onSelect={(char) => {
          if (iconPicker) useNotesStore.getState().setIcon(iconPicker.note.id, char)
        }}
        onRemove={() => {
          if (iconPicker) useNotesStore.getState().setIcon(iconPicker.note.id, null)
        }}
      />
    </aside>
  )
}
