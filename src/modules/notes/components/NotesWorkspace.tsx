import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  Loader2,
  Maximize2,
  MoreHorizontal,
  Palette,
  Pin,
  Sparkles,
  Star,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { ROUTES } from '@lib/constants'
import { cn } from '@lib/utils'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { noteUiBus } from '../bus'
import { countWords, viewFromPath, visibleNotes } from '../document'
import { formatNoteTime } from '../formatNoteTime'
import { NoteEditorProvider, NoteEditorSurface } from '../editor/NoteEditorProvider'
import { flushNotes, useNotesStore } from '../store/notesStore'
import { NOTE_TINTS, type SaveStatus } from '../types'
import { AskAssistant } from './AskAssistant'
import { BlockHandle } from './BlockHandle'
import { EmojiPicker } from './EmojiPicker'
import { NotesList } from './NotesList'
import { SelectionBubble } from './SelectionBubble'
import { SlashMenu } from './SlashMenu'
import { TableHandles } from './TableHandles'

export function NotesWorkspace() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isMobile = useIsMobile()
  const view = viewFromPath(pathname)
  const notes = useNotesStore((state) => state.notes)
  const activeNoteId = useNotesStore((state) => state.activeNoteId)
  const tagFilter = useNotesStore((state) => state.tagFilter)
  const focusMode = useNotesStore((state) => state.focusMode)
  const saveStatus = useNotesStore((state) => state.saveStatus)
  const saveError = useNotesStore((state) => state.saveError)
  const loadError = useNotesStore((state) => state.loadError)
  const assistantOpen = useNotesStore((state) => state.assistant.open)
  const setActive = useNotesStore((state) => state.setActive)
  const setTagFilter = useNotesStore((state) => state.setTagFilter)
  const setFocusMode = useNotesStore((state) => state.setFocusMode)
  const closeAssistant = useNotesStore((state) => state.closeAssistant)
  const [mobileEditor, setMobileEditor] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const note = notes.find((item) => item.id === activeNoteId) ?? null

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

  useEffect(
    () =>
      noteUiBus.subscribe((event) => {
        if (event.type === 'assistant.open') {
          useNotesStore.getState().openAssistant(event.text ? { scope: 'selection', text: event.text } : undefined)
        }
        if (event.type === 'notify') setNotice(event.message)
      }),
    []
  )

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (view !== 'all' && tagFilter) setTagFilter(null)
  }, [view, tagFilter, setTagFilter])

  useEffect(() => {
    const visible = visibleNotes(notes, view, view === 'all' ? tagFilter : null, '')
    if (activeNoteId && visible.some((item) => item.id === activeNoteId)) return
    setActive(visible[0]?.id ?? null)
  }, [notes, view, tagFilter, activeNoteId, setActive])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (useNotesStore.getState().assistant.open) {
        closeAssistant()
        return
      }
      if (useNotesStore.getState().focusMode) setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeAssistant, setFocusMode])

  const create = () => {
    useNotesStore.getState().createNote()
    navigate(ROUTES.NOTES)
    setMobileEditor(true)
  }

  const showList = !focusMode && (!isMobile || !mobileEditor)
  const showNote = focusMode || !isMobile || mobileEditor
  const words = countWords(note?.plainText ?? '')

  return (
    <div className={focusMode ? 'note-focus' : 'flex h-full min-h-0'}>
      {showList && <NotesList view={view} onCreate={create} />}
      {showNote && (
        <section className="flex min-w-0 flex-1 flex-col">
          {note ? (
            <>
              <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-3 sm:px-4">
                {focusMode ? (
                  <button
                    type="button"
                    className="border-border/70 bg-card text-foreground flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium shadow-xs transition-colors duration-150 hover:bg-accent"
                    onClick={() => setFocusMode(false)}
                  >
                    <ChevronLeft className="text-muted-foreground h-3.5 w-3.5" />
                    Exit focus
                    <kbd className="note-kbd">esc</kbd>
                  </button>
                ) : (
                  <>
                    {isMobile && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors duration-150"
                        onClick={() => setMobileEditor(false)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Notes
                      </button>
                    )}
                    {!isMobile && (
                      <p className="text-muted-foreground min-w-0 truncate text-[13px]">
                        Notes
                        <span className="text-muted-foreground/40 px-1.5">/</span>
                        <span className="text-foreground font-medium">{note.title || 'Untitled'}</span>
                      </p>
                    )}
                  </>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <p className="text-muted-foreground hidden text-[12px] tabular-nums lg:block">
                    Edited {formatNoteTime(note.updatedAt)}
                  </p>
                  <SaveState status={saveStatus} error={saveError} />
                  {!focusMode && (
                    <button
                      type="button"
                      title={note.starred ? 'Unstar' : 'Star'}
                      className={cn(
                        'text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg p-2 transition-colors duration-150',
                        note.starred && 'text-[hsl(var(--warning))] hover:text-[hsl(var(--warning))]'
                      )}
                      onClick={() => useNotesStore.getState().toggleStar(note.id)}
                    >
                      <Star className={cn('h-4 w-4', note.starred && 'fill-current')} />
                    </button>
                  )}
                  {!focusMode && (
                    <button
                      type="button"
                      title="Focus mode"
                      className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg p-2 transition-colors duration-150"
                      onClick={() => setFocusMode(true)}
                    >
                      <Maximize2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  )}
                  {!focusMode && (
                    <button
                      type="button"
                      className="bg-primary/10 text-primary hover:bg-primary/15 ml-1 flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors duration-150"
                      onClick={() => useNotesStore.getState().openAssistant()}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Ask AI
                    </button>
                  )}
                  {!focusMode && (
                    <div className="relative">
                      <button
                        type="button"
                        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg p-2 transition-colors duration-150"
                        aria-label="Note actions"
                        onClick={() => setMenuOpen((open) => !open)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuOpen && (
                        <>
                          <div className="fixed inset-0 z-[39]" onClick={() => setMenuOpen(false)} />
                          <div className="note-pop right-0 w-48">
                            <button
                              type="button"
                              className="note-pop-item"
                              onClick={() => {
                                setFocusMode(true)
                                setMenuOpen(false)
                              }}
                            >
                              <Maximize2 className="h-3.5 w-3.5" /> Focus mode
                            </button>
                            <button
                              type="button"
                              className="note-pop-item"
                              onClick={() => {
                                useNotesStore.getState().togglePin(note.id)
                                setMenuOpen(false)
                              }}
                            >
                              <Pin className="h-3.5 w-3.5" /> {note.pinned ? 'Unpin' : 'Pin'}
                            </button>
                            <span className="note-pop-sep" />
                            <div className="px-2 pb-1.5 pt-1.5">
                              <p className="text-muted-foreground flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-semibold">
                                <Palette className="h-3 w-3" /> Note color
                              </p>
                              <div className="flex items-center gap-1.5 px-1 pb-1">
                                <button
                                  type="button"
                                  title="Default"
                                  aria-label="Default note color"
                                  className={cn('note-tint-dot is-default', !note.tint && 'is-active')}
                                  onClick={() => useNotesStore.getState().setTint(note.id, null)}
                                />
                                {NOTE_TINTS.map((tint) => (
                                  <button
                                    key={tint}
                                    type="button"
                                    title={tint.charAt(0).toUpperCase() + tint.slice(1)}
                                    aria-label={`${tint} note color`}
                                    className={cn('note-tint-dot', `note-tint-${tint}`, note.tint === tint && 'is-active')}
                                    onClick={() => useNotesStore.getState().setTint(note.id, tint)}
                                  />
                                ))}
                              </div>
                            </div>
                            <span className="note-pop-sep" />
                            <button
                              type="button"
                              className="note-pop-item note-pop-danger"
                              onClick={() => {
                                useNotesStore.getState().trashNote(note.id, view)
                                setMenuOpen(false)
                                setMobileEditor(false)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Move to trash
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </header>

              {(loadError || notice || saveError) && (
                <div className="bg-secondary/70 text-foreground flex items-start gap-2 border-b border-border/60 px-4 py-2 text-[12px]">
                  <p className="min-w-0 flex-1">{notice || saveError || loadError}</p>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setNotice(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <NoteEditorProvider
                noteId={note.id}
                content={note.content}
                onChange={(id, content) => useNotesStore.getState().setContent(id, content)}
              >
                <div
                  className={cn(
                    'note-canvas min-h-0 flex-1 overflow-y-auto',
                    note.tint && `note-tint-${note.tint}`
                  )}
                >
                  <div className="note-page mx-auto w-full max-w-[780px] px-6 pt-9 sm:px-10 sm:pt-12">
                    <input
                      value={note.title}
                      aria-label="Note title"
                      placeholder="Untitled"
                      onChange={(event) => useNotesStore.getState().setTitle(note.id, event.target.value)}
                      className="placeholder:text-muted-foreground/40 text-foreground w-full bg-transparent text-[2.25rem] leading-[1.15] font-bold tracking-tight outline-none"
                    />
                    {!focusMode && (
                      <TagRow
                        tags={note.tags}
                        onChange={(tags) => useNotesStore.getState().setTags(note.id, tags)}
                        onOpen={(tag) => {
                          setTagFilter(tag)
                          navigate(ROUTES.NOTES)
                        }}
                      />
                    )}
                    <NoteEditorSurface />
                    <SlashMenu />
                    <EmojiPicker />
                    <SelectionBubble />
                    <BlockHandle />
                    <TableHandles />
                  </div>
                </div>

                <footer
                  className={cn(
                    'text-muted-foreground flex h-9 shrink-0 items-center justify-between border-t px-4 text-[11px] tabular-nums',
                    focusMode ? 'border-transparent px-6' : 'border-border/60'
                  )}
                >
                  <span>
                    {words.words} words{words.minutes > 0 ? ` · ${words.minutes} min read` : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
                    End-to-end encrypted
                  </span>
                </footer>

                {assistantOpen && <AskAssistant />}
              </NoteEditorProvider>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="bg-secondary text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
                <StickyNote className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <p className="text-muted-foreground text-[13px]">
                {view === 'trash' ? 'Nothing in the trash.' : 'No note in this view.'}
              </p>
              <button
                type="button"
                className="bg-primary text-primary-foreground h-9 rounded-lg px-4 text-[13px] font-medium shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.98]"
                onClick={create}
              >
                New note
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function SaveState({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'saving') {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 px-2 text-[12px] tabular-nums">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    )
  }
  if (status === 'error') {
    return (
      <button
        type="button"
        className="text-destructive hover:bg-destructive/10 rounded-lg px-2 py-1 text-[12px] font-medium transition-colors duration-150"
        onClick={() => flushNotes()}
      >
        {error ? 'Retry save' : 'Not saved'}
      </button>
    )
  }
  return (
    <span className="flex items-center gap-1 px-2 text-[12px] font-medium text-[hsl(var(--success))]">
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Saved
    </span>
  )
}

function TagRow({
  tags,
  onChange,
  onOpen,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  onOpen: (tag: string) => void
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const next = draft.trim().replace(/^#/, '').toLowerCase()
    if (!next || tags.includes(next)) {
      setDraft('')
      return
    }
    onChange([...tags, next])
    setDraft('')
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="bg-secondary/80 text-foreground/75 flex items-center gap-0.5 rounded-full py-0.5 pl-2.5 pr-1 text-[12px] font-medium transition-colors duration-150 hover:bg-accent"
        >
          <button type="button" className="hover:text-primary transition-colors" onClick={() => onOpen(tag)}>
            #{tag}
          </button>
          <button
            type="button"
            className="text-muted-foreground/60 hover:text-destructive flex h-4 w-4 items-center justify-center rounded-full transition-colors"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(tags.filter((item) => item !== tag))}
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          }
        }}
        onBlur={add}
        placeholder="Add tag"
        aria-label="Add tag"
        className="placeholder:text-muted-foreground/50 w-24 rounded-full bg-transparent px-2 py-0.5 text-[12px] outline-none transition-[width] duration-150 focus:w-32"
      />
    </div>
  )
}
