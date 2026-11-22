import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  CornerUpLeft,
  FileText,
  Hourglass,
  Lightbulb,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCw,
  StickyNote,
  Sun,
  Trash2,
  Type,
  Search,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { useUIStore } from '@/stores/uiStore'
import { useNotesView } from '../hooks/useNotesView'
import { buildNoteTree, type NoteTreeNode } from '../utils/noteTree'
import { noteCounts } from '../utils/document'
import { searchNotes } from '../utils/searchNotes'
import { useNotesStore } from '../store/notesStore'
import { EmojiPopover } from './editor/EmojiPopover'
import type { NoteKind, NoteRecord, NoteView } from '../types'

/** The sheet shows 2 children + "Show 3 more" under Project Ideas. */
const TREE_PREVIEW = 2
/** Top-level pages preview before "View more" (Notion's page-list cap). */
const ROOT_PREVIEW = 6
const EXPANDED_KEY = 'uoozer.notes.tree.expanded'
const PINNED_PREVIEW = 3

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

export function NotesSidebarNav({ open }: { open: boolean }) {
  const navigate = useNavigate()
  const view = useNotesView()
  const notes = useNotesStore((state) => state.notes)
  const activeNoteId = useNotesStore((state) => state.activeNoteId)
  const tagFilter = useNotesStore((state) => state.tagFilter)

  const [expanded, setExpanded] = useState<Record<string, boolean>>(readExpanded)
  const [showMore, setShowMore] = useState<Record<string, boolean>>({})
  const [showAllRoot, setShowAllRoot] = useState(false)
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
  /* Quick search over titles AND note content (searchNotes.ts) — the same
     matcher the shell ⌘K dialog consumes, so the two never drift apart. */
  const [filter, setFilter] = useState('')

  const counts = useMemo(() => noteCounts(notes), [notes])
  const tree = useMemo(() => buildNoteTree(notes), [notes])
  const pinned = useMemo(
    () => notes.filter((note) => note.pinned && !note.trashed).slice(0, PINNED_PREVIEW),
    [notes]
  )

  /* Starred / Pinned views prune the tree to matching notes (children keep
     a parent alive); All = the full tree. Trash is a dialog now, not a view.
     A quick-search filter prunes the same way — matches in BODY CONTENT
     keep their ancestor path so the result stays reachable in the tree. */
  const filterHits = useMemo(() => {
    const raw = filter.trim()
    if (!raw) return null
    return new Set(searchNotes(raw, notes).map((hit) => hit.noteId))
  }, [filter, notes])
  const visibleTree = useMemo(() => {
    const keepNode = (node: NoteTreeNode): boolean => {
      if (filterHits) return filterHits.has(node.note.id)
      if (view === 'all' || view === 'trash') return true
      return view === 'starred' ? node.note.starred : node.note.pinned
    }
    const walk = (nodes: NoteTreeNode[]): NoteTreeNode[] =>
      nodes
        .map((node) => ({ ...node, children: walk(node.children) }))
        .filter((node) => keepNode(node) || node.children.length > 0)
    return walk(tree)
  }, [tree, view, filterHits])
  const isOpen = (node: NoteTreeNode): boolean =>
    filterHits !== null ? true : (expanded[node.note.id] ?? node.children.length > 0)

  const toggleExpanded = (id: string) => {
    setExpanded((state) => {
      const next = { ...state, [id]: !(state[id] ?? true) }
      writeExpanded(next)
      return next
    })
  }

  const expandParents = (id: string) => {
    const chain: Record<string, boolean> = {}
    const walk = (nodes: NoteTreeNode[]): boolean => {
      let found = false
      for (const node of nodes) {
        const hit = node.note.id === id || walk(node.children)
        if (hit) {
          chain[node.note.id] = true
          found = true
        }
      }
      return found
    }
    walk(tree)
    if (Object.keys(chain).length > 0) {
      setExpanded((state) => {
        const next = { ...state, ...chain }
        writeExpanded(next)
        return next
      })
    }
  }

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const openNote = (id: string) => {
    useNotesStore.getState().setActive(id)
    // Opening from the mobile drawer closes it (no-op on desktop).
    useUIStore.getState().setMobileMenuOpen(false)
  }

  const createRootNote = () => {
    useNotesStore.getState().createNote()
    useNotesStore.getState().setTagFilter(null)
    navigate(ROUTES.NOTES)
    useUIStore.getState().setMobileMenuOpen(false)
  }

  const createChild = (parentId: string) => {
    useNotesStore.getState().createChildNote(parentId)
    useNotesStore.getState().setTagFilter(null)
    navigate(ROUTES.NOTES)
    expandParents(parentId)
    setExpanded((state) => ({ ...state, [parentId]: true }))
    useUIStore.getState().setMobileMenuOpen(false)
  }

  const gotoView = (next: Exclude<NoteView, 'trash'>) => {
    useNotesStore.getState().setTagFilter(null)
    navigate(
      next === 'starred'
        ? ROUTES.NOTES_STARRED
        : next === 'pinned'
          ? ROUTES.NOTES_PINNED
          : ROUTES.NOTES
    )
    useUIStore.getState().setMobileMenuOpen(false)
    setViewMenuOpen(false)
  }

  /** Trash is a dialog (Notion pattern) — no route, no second pane. */
  const openTrash = () => {
    useNotesStore.getState().setTrashOpen(true)
    useUIStore.getState().setMobileMenuOpen(false)
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

  /* Escape / outside click closes the portal menus. */
  const menuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!rowMenu && !moveMenu) return
    const close = () => {
      setRowMenu(null)
      setMoveMenu(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onDown = (event: MouseEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      close()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [rowMenu, moveMenu])

  /* ── One recursive tree row ────────────────────────────────────────────── */

  const renderRow = (node: NoteTreeNode): ReactNode => {
    const { note, children, depth } = node
    const expandedNow = isOpen(node)
    /* While a quick-search filter is active NOTHING may be hidden behind
       preview caps — the 3rd+ child or the 7th+ root result used to sit
       behind "Show more", which made search look broken (matches the
       user typed for were on screen's cutting room floor). Searching
       shows every hit at once. */
    const searching = filterHits !== null
    const previewCount = searching
      ? children.length
      : showMore[note.id]
        ? children.length
        : Math.min(children.length, TREE_PREVIEW)
    const isActive = note.id === activeNoteId
    const hasKids = children.length > 0

    return (
      <div key={note.id}>
        {renamingId === note.id && open ? (
          <div className="nsb-row" style={{ '--nsb-depth': depth } as CSSProperties}>
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
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            title={note.title || 'Untitled'}
            aria-current={isActive || undefined}
            className={cn('nsb-row group/row w-full text-left', isActive && 'is-active')}
            style={open ? ({ '--nsb-depth': depth } as CSSProperties) : undefined}
            onClick={() => openNote(note.id)}
          >
            {open && hasKids && (
              <span
                role="button"
                tabIndex={-1}
                aria-label={expandedNow ? 'Collapse' : 'Expand'}
                className={cn('nsb-twist', expandedNow && 'is-open')}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleExpanded(note.id)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    toggleExpanded(note.id)
                  }
                }}
              >
                <ChevronRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
              </span>
            )}
            <RowIcon note={note} />
            {open && (
              <>
                <span className="min-w-0 flex-1 truncate text-left">
                  {note.title || 'Untitled'}
                </span>
                <span className="nsb-acts">
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label="Note actions"
                    className="nsb-act"
                    onClick={(event) => {
                      event.stopPropagation()
                      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                      setRowMenu({ note, x: rect.left, y: rect.bottom + 4 })
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                        setRowMenu({ note, x: rect.left, y: rect.bottom + 4 })
                      }
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label="Add a child page"
                    className="nsb-act"
                    onClick={(event) => {
                      event.stopPropagation()
                      createChild(note.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        createChild(note.id)
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </span>
              </>
            )}
          </button>
        )}

        {open && expandedNow && children.slice(0, previewCount).map((child) => renderRow(child))}
        {open &&
          expandedNow &&
          !searching &&
          children.length > TREE_PREVIEW &&
          !showMore[note.id] && (
            <button
              type="button"
              className="nsb-row nsb-more w-full text-left"
              style={{ '--nsb-depth': depth + 1 } as CSSProperties}
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
    const item =
      'hover:bg-hover-surface text-ink flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors duration-120'
    return createPortal(
      <div
        ref={menuRef}
        className="bg-card border-border/70 shadow-menu w-[184px] rounded-lg border p-1"
        style={{
          position: 'fixed',
          left: Math.min(x, window.innerWidth - 196),
          top: Math.min(y, window.innerHeight - 260),
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
          <span className="min-w-0 flex-1">Move under page</span>
          <ChevronRight className="h-3 w-3" strokeWidth={1.75} />
        </button>
        <span className="bg-border/60 my-1 block h-px" />
        <button
          type="button"
          className={cn(item, 'text-destructive hover:bg-destructive/10')}
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
    const item =
      'hover:bg-hover-surface text-ink flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors duration-120'
    return createPortal(
      <div
        ref={menuRef}
        className="bg-card border-border/70 shadow-menu max-h-[280px] w-[210px] overflow-y-auto rounded-lg border p-1"
        style={{
          position: 'fixed',
          left: Math.min(x, window.innerWidth - 222),
          top: Math.min(y, window.innerHeight - 300),
          zIndex: 70,
        }}
        role="menu"
        aria-label="Move under page"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={item}
          onClick={() => {
            useNotesStore.getState().setNoteParent(note.id, null)
            setMoveMenu(null)
          }}
        >
          <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={1.6} /> Top level
        </button>
        <span className="bg-border/60 my-1 block h-px" />
        {targets.length === 0 && (
          <p className="text-muted-foreground px-2 py-1 text-[12px]">No other pages</p>
        )}
        {targets.slice(0, 40).map((target) => (
          <button
            key={target.id}
            type="button"
            className={item}
            onClick={() => {
              useNotesStore.getState().setNoteParent(note.id, target.id)
              setMoveMenu(null)
            }}
          >
            <RowIcon note={target} size={14} />
            <span className="min-w-0 flex-1 truncate">{target.title || 'Untitled'}</span>
          </button>
        ))}
      </div>,
      document.body
    )
  }

  /* ── Collapsed rail: icons only (Notion-style) ─────────────────────────── */

  if (!open) {
    return (
      <div className="nsb nsb-rail mt-4 items-center gap-px">
        <button
          type="button"
          title="New note (⌘N)"
          aria-label="New note"
          onClick={createRootNote}
          className="nsb-row justify-center"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
        {pinned.map((note) => (
          <button
            key={note.id}
            type="button"
            title={note.title || 'Untitled'}
            aria-label={note.title || 'Untitled'}
            onClick={() => openNote(note.id)}
            className="nsb-row justify-center"
          >
            <RowIcon note={note} />
          </button>
        ))}
        {visibleTree.map((node) => renderRow(node))}
        <button
          type="button"
          title="Trash"
          aria-label="Trash"
          onClick={openTrash}
          className="nsb-row mt-1 justify-center"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
        </button>
        {renderRowMenu()}
        {renderMoveMenu()}
      </div>
    )
  }

  /* ── Expanded section ──────────────────────────────────────────────────── */

  return (
    <div className="nsb">
      <div className="nsb-fixed">
        <button type="button" className="nsb-row mt-px w-full text-left" onClick={createRootNote}>
          <Plus className="h-4 w-4 flex-none" strokeWidth={1.6} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">New note</span>
          <span className="nsb-kbd">⌘N</span>
        </button>

        <div className="nsb-search">
          <Search className="nsb-search-icon" strokeWidth={1.6} aria-hidden="true" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search notes…"
            aria-label="Search notes"
            spellCheck={false}
          />
          {filter && (
            <button
              type="button"
              className="nsb-search-clear"
              aria-label="Clear search"
              onClick={() => setFilter('')}
            >
              ×
            </button>
          )}
        </div>

        {pinned.length > 0 && (
          <>
            <div className="nsb-label">Pinned</div>
            {pinned.map((note) => (
              <button
                key={note.id}
                type="button"
                className={cn('nsb-row w-full text-left', note.id === activeNoteId && 'is-active')}
                onClick={() => openNote(note.id)}
              >
                <RowIcon note={note} />
                <span className="min-w-0 flex-1 truncate text-left">
                  {note.title || 'Untitled'}
                </span>
              </button>
            ))}
          </>
        )}

        <div className="nsb-label">
          <span className="min-w-0 flex-1">Notes</span>
          <button
            type="button"
            onClick={() => setViewMenuOpen((open) => !open)}
            className="hover:text-ink flex flex-none items-center gap-0.5 text-[12px] transition-colors duration-120"
            aria-expanded={viewMenuOpen}
            aria-label="Switch notes view"
          >
            {view === 'starred' ? 'Starred' : view === 'pinned' ? 'Pinned' : 'All'}
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', viewMenuOpen && 'rotate-180')}
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </button>
        </div>
        {viewMenuOpen && (
          <>
            <button
              type="button"
              aria-label="Close view menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setViewMenuOpen(false)}
            />
            <div className="bg-card border-border/70 shadow-menu relative z-50 mb-1 ml-2 w-[120px] rounded-lg border p-1">
              {(['all', 'starred', 'pinned'] as Exclude<NoteView, 'trash'>[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    'hover:bg-hover-surface flex w-full items-center rounded-sm px-2 py-1.5 text-left text-[13px] capitalize transition-colors duration-120',
                    view === option ? 'text-ink font-medium' : 'text-gray-strong'
                  )}
                  onClick={() => gotoView(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="nsb-tree" role="tree" aria-label="Notes pages">
        {filterHits
          ? visibleTree.map((node) => renderRow(node))
          : (showAllRoot ? visibleTree : visibleTree.slice(0, ROOT_PREVIEW)).map((node) =>
              renderRow(node)
            )}
        {!filterHits && visibleTree.length > ROOT_PREVIEW && !showAllRoot && (
          <button
            type="button"
            className="nsb-row nsb-more w-full text-left"
            onClick={() => setShowAllRoot(true)}
          >
            View {visibleTree.length - ROOT_PREVIEW} more
          </button>
        )}
        {!filterHits && visibleTree.length > ROOT_PREVIEW && showAllRoot && (
          <button
            type="button"
            className="nsb-row nsb-more w-full text-left"
            onClick={() => setShowAllRoot(false)}
          >
            View less
          </button>
        )}
        {visibleTree.length === 0 &&
          (filterHits ? (
            <p className="nsb-row nsb-more">No notes match “{filter.trim()}”</p>
          ) : (
            <p className="nsb-row nsb-more">No notes yet</p>
          ))}

        {/* Tags — collapsed by default, per the sheet (dynamic). */}
        {counts.tags.length > 0 && (
          <>
            <button
              type="button"
              className="nsb-label hover:text-ink w-full text-left transition-colors duration-120"
              aria-expanded={tagsOpen}
              onClick={() => setTagsOpen((open) => !open)}
            >
              <ChevronRight
                className={cn('h-3 w-3 flex-none transition-transform', tagsOpen && 'rotate-90')}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 text-left">Tags</span>
              <span className="nsb-kbd">{counts.tags.length}</span>
            </button>
            {tagsOpen && (
              <div className="mb-1 flex flex-col gap-px">
                {counts.tags.map((tag) => {
                  const active = tagFilter === tag.name && view === 'all'
                  return (
                    <button
                      key={tag.name}
                      type="button"
                      title={`#${tag.name}`}
                      className={cn('nsb-row w-full text-left', active && 'is-active')}
                      onClick={() => {
                        useNotesStore.getState().setTagFilter(active ? null : tag.name)
                        navigate(ROUTES.NOTES)
                        useUIStore.getState().setMobileMenuOpen(false)
                      }}
                    >
                      <span className="nsb-tagdash">#</span>
                      <span className="min-w-0 flex-1 truncate text-left">{tag.name}</span>
                      <span className="nsb-kbd">{tag.count}</span>
                      {active && (
                        <span
                          className="bg-primary h-1.5 w-1.5 flex-none rounded-full"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Fixed foot: Trash, pinned to the bottom like the sheet's
         `margin-top:auto` row. It opens the dialog — never a second pane. */}
      <div className="nsb-bottom">
        <button type="button" className="nsb-row w-full text-left" onClick={openTrash}>
          <Trash2 className="h-4 w-4 flex-none" strokeWidth={1.6} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">Trash</span>
          {counts.trash > 0 && <span className="nsb-kbd">{counts.trash}</span>}
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
    </div>
  )
}
