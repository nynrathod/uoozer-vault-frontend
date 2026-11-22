import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hourglass, Image as ImageIcon, Lightbulb, Smile, Sun, X } from 'lucide-react'
import { ROUTES } from '@lib/constants'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useUIStore } from '@/stores/uiStore'
import { templateById } from '../data/pageStyles'
import { useNoteKeyboard } from '../hooks/useNoteKeyboard'
import { useNoteLifecycle } from '../hooks/useNoteLifecycle'
import { useNotesView } from '../hooks/useNotesView'
import { NoteEditorProvider, NoteEditorSurface } from '../editor/NoteEditorProvider'
import { onUiEvent } from '../editor/uiEvents'
import { useActiveNote } from '../store/selectors'
import { useNotesStore } from '../store/notesStore'
import { countWords } from '../utils/document'
import { AskAssistant } from './editor/AskAssistant'
import { BlockHandle } from './editor/BlockHandle'
import { BlockSelection } from './editor/BlockSelection'
import { EmojiPicker } from './editor/EmojiPicker'
import { EmojiPopover } from './editor/EmojiPopover'
import { MentionPicker } from './editor/MentionPicker'
import { MobileFormatBar } from './editor/MobileFormatBar'
import { SelectionBubble } from './editor/SelectionBubble'
import { SlashMenu } from './editor/SlashMenu'
import {
  JournalFoot,
  NotepadSquiggle,
  NotepadTray,
  PlayfulDock,
  SafeFoot,
  SafeRibbon,
  useSafeVeil,
  WriterDock,
  WriterTopStrip,
} from './kinds/NoteKindChrome'
import { NoteCover } from './NoteCover'
import { NoteFooter } from './layout/NoteFooter'
import { NoteHeader } from './layout/NoteHeader'
import { NotePageStyleMenu } from './layout/NotePageStyleMenu'
import { NoteTagRow } from './layout/NoteTagRow'
import { TrashDialog } from './TrashDialog'
import { NotesFirstRun, NotesNoSelection, NotesViewEmpty } from './states/NotesEmptyStates'
import type { NoteKind, NoteRecord } from '../types'

/* ============================================================================
 * NOTES WORKSPACE — the module's only top-level screen: the note canvas next
 * to the app's ONE sidebar. The project has a single sidebar (the shell's
 * Sidebar) and on /notes its Notes section IS the notes tree
 * (components/NotesSidebarNav — same file path the shell already imports).
 * This screen renders NO sidebar, NO list pane, NO trash pane — the old
 * NotesListPane is deleted; navigation lives only in the shell sidebar and
 * trash lives only in components/TrashDialog (Notion's pattern). On mobile
 * the shell sidebar becomes the drawer (Header hamburger / back button) —
 * one sidebar everywhere, nothing that can conflict with Files.
 * ==========================================================================*/

const COVER_KINDS_BADGE: NoteKind[] = ['playful', 'journal', 'capsule', 'stickyBoard']

const KIND_FALLBACK_ICON: Partial<Record<NoteKind, typeof Lightbulb>> = {
  playful: Lightbulb,
  journal: Sun,
  capsule: Hourglass,
}

export function NotesWorkspace() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const view = useNotesView()
  useNoteKeyboard()
  const { notice, dismissNotice } = useNoteLifecycle()

  const note = useActiveNote()
  const notes = useNotesStore((state) => state.notes)
  const hydrated = useNotesStore((state) => state.hydrated)
  const focusMode = useNotesStore((state) => state.focusMode)
  const saveError = useNotesStore((state) => state.saveError)
  const loadError = useNotesStore((state) => state.loadError)
  const setTagFilter = useNotesStore((state) => state.setTagFilter)

  const sidebarOpen = useUIStore((state) => state.sidebarOpen)

  const [styleOpen, setStyleOpen] = useState(false)

  useEffect(() => {
    if (view !== 'trash') return
    useNotesStore.getState().setTrashOpen(true)
    navigate(ROUTES.NOTES, { replace: true })
  }, [view, navigate])

  // /burn and /lock slash commands open the page-style panel.
  useEffect(
    () =>
      onUiEvent((event) => {
        if (event.type === 'style.open') setStyleOpen(true)
      }),
    []
  )

  const create = () => {
    useNotesStore.getState().createNote()
    navigate(ROUTES.NOTES)
  }

  const createFromTemplate = (templateId: string) => {
    useNotesStore.getState().createNote(templateById(templateId))
    navigate(ROUTES.NOTES)
  }

  const firstRun = hydrated && notes.length === 0

  return (
    <div className={focusMode ? 'note-focus' : 'note-lite flex h-full min-h-0'}>
      <section className="note-lite-main">
        {note ? (
          <NoteScreen
            note={note}
            focusMode={focusMode}
            isMobile={isMobile}
            styleOpen={styleOpen}
            setStyleOpen={setStyleOpen}
            onExpandSidebar={
              !isMobile && !sidebarOpen
                ? () => useUIStore.getState().setSidebarOpen(true)
                : undefined
            }
            onExitMobileEditor={() => useUIStore.getState().setMobileMenuOpen(true)}
            onWriterExit={() => useNotesStore.getState().setNoteKind(note.id, 'paper')}
            onOpenTag={(tag) => {
              setTagFilter(tag)
              navigate(ROUTES.NOTES)
            }}
          >
            {(loadError || notice || saveError) && (
              <div className="bg-secondary/70 text-foreground border-border/60 flex items-start gap-2 border-b px-4 py-2 text-[12px]">
                <p className="min-w-0 flex-1">{notice || saveError || loadError}</p>
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={dismissNotice}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </NoteScreen>
        ) : firstRun ? (
          <NotesFirstRun onCreateFromTemplate={createFromTemplate} />
        ) : !hydrated ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="note-ai-dots" aria-label="Loading notes">
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : notes.some((item) => !item.trashed) ? (
          <NotesNoSelection
            onOpen={(id) => {
              useNotesStore.getState().setActive(id)
            }}
            onCreateFromTemplate={createFromTemplate}
          />
        ) : (
          <NotesViewEmpty view={view} onCreate={create} />
        )}
      </section>

      <TrashDialog />
    </div>
  )
}

/* ── The note screen: header + kind canvas + editor + kind chrome ────────── */

function NoteScreen({
  note,
  focusMode,
  isMobile,
  styleOpen,
  setStyleOpen,
  onExpandSidebar,
  onExitMobileEditor,
  onWriterExit,
  onOpenTag,
  children,
}: {
  note: NoteRecord
  focusMode: boolean
  isMobile: boolean
  styleOpen: boolean
  setStyleOpen: (open: boolean) => void
  onExpandSidebar?: () => void
  onExitMobileEditor: () => void
  onWriterExit: () => void
  onOpenTag: (tag: string) => void
  children?: ReactNode
}) {
  const kind = note.pageStyle.kind
  const veil = useSafeVeil(kind === 'safe')
  const assistantOpen = useNotesStore((state) => state.assistant.open)
  const showLiteHeader = !focusMode && kind !== 'writer' && kind !== 'safe' && !isMobile
  const FallbackIcon = KIND_FALLBACK_ICON[kind] ?? null

  /* Emoji icon picking (page icon) — one shared popover, anchored to the
     tile. No window.prompt anywhere in the module. */
  const [iconPicker, setIconPicker] = useState(false)
  const iconAnchorRef = useRef<HTMLElement | null>(null)
  const pickIcon = (element: HTMLElement | null) => {
    iconAnchorRef.current = element
    setIconPicker(true)
  }
  const setIcon = (icon: string | null) => useNotesStore.getState().setIcon(note.id, icon)

  /* Cover actions — "Add cover" APPLIES a preset right away (the button can
     never feel dead) and opens the style menu to change it; a set cover
     shows Notion's Change cover / Remove pair on hover. The row exists for
     EVERY editable kind (it was paper-only before, which made "Add cover"
     look broken on the other screens). */
  const applyDefaultCover = () => {
    useNotesStore.getState().setPageStyle(note.id, { cover: 'sunrise' })
    setStyleOpen(true)
  }
  const removeCover = () => useNotesStore.getState().setPageStyle(note.id, { cover: null })

  /* Notion's quiet "Add icon · Add cover" row — shown above the title on
     every kind that renders a page body (not focus mode). */
  const showPageActions = !focusMode && kind !== 'writer' && kind !== 'safe' && kind !== 'notepad'
  const pageActions = showPageActions ? (
    <div className="note-page-actions">
      {!note.icon && (
        <button
          type="button"
          className="note-page-action"
          onClick={(event) => pickIcon(event.currentTarget)}
        >
          <Smile className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
          Add icon
        </button>
      )}
      {!note.pageStyle.cover && (
        <button type="button" className="note-page-action" onClick={applyDefaultCover}>
          <ImageIcon className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
          Add cover
        </button>
      )}
    </div>
  ) : null

  const titleBlock = (
    <>
      {/* Kinds with covers use the round badge; paper uses the 44px tile. */}
      {COVER_KINDS_BADGE.includes(kind) ? (
        <div
          className="note-icon-badge"
          role="button"
          tabIndex={0}
          title="Change icon"
          onClick={(event) => pickIcon(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') pickIcon(event.currentTarget)
          }}
        >
          {note.icon ??
            (FallbackIcon ? (
              <FallbackIcon className="h-[26px] w-[26px]" strokeWidth={1.6} aria-hidden="true" />
            ) : null)}
        </div>
      ) : (
        <span
          className="note-lite-icontile"
          role="button"
          tabIndex={0}
          title="Change icon"
          onClick={(event) => pickIcon(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') pickIcon(event.currentTarget)
          }}
        >
          {note.icon ??
            (FallbackIcon ? (
              <FallbackIcon className="h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
            ) : (
              '•'
            ))}
        </span>
      )}
    </>
  )

  const canvasAttrs = {
    'data-background': note.pageStyle.background,
    'data-font': note.pageStyle.font,
    'data-textsize': note.pageStyle.textSize,
    'data-fullwidth': String(note.pageStyle.fullWidth),
    'data-kind': kind,
    ...(note.pageStyle.cover ? { 'data-cover': note.pageStyle.cover } : {}),
  }

  const columnClass =
    kind === 'writer'
      ? 'mx-auto w-full max-w-[640px] px-6 pt-24 sm:px-10'
      : kind === 'safe'
        ? 'mx-auto w-full max-w-[700px] px-6 pt-16 sm:px-10'
        : COVER_KINDS_BADGE.includes(kind)
          ? 'mx-auto w-full max-w-[720px] px-8 sm:px-16'
          : kind === 'notepad'
            ? 'note-pad-body'
            : 'note-page mx-auto w-full max-w-[700px] px-6 pt-7 sm:px-10 sm:pt-7'

  const metaRow = (
    <>
      {!focusMode && kind !== 'notepad' && (
        <NoteTagRow
          tags={note.tags}
          onChange={(tags) => useNotesStore.getState().setTags(note.id, tags)}
          onOpen={onOpenTag}
        />
      )}
    </>
  )

  /* Cover — for EVERY kind once it is set (this is what made "Add cover"
     look broken before: only four kinds ever rendered it). Hover shows
     Notion's Change cover · Remove controls. */
  const coverBlock = note.pageStyle.cover ? (
    <div className="note-cover-holder">
      <div className="note-cover-frame">
        <NoteCover value={note.pageStyle.cover} />
        {COVER_KINDS_BADGE.includes(kind) && (
          <span className="note-cover-badge">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Only you can read this
          </span>
        )}
        <div className="note-cover-actions">
          <button type="button" className="note-cover-action" onClick={() => setStyleOpen(true)}>
            Change cover
          </button>
          <button type="button" className="note-cover-action" onClick={removeCover}>
            Remove
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {showLiteHeader && (
        <NoteHeader
          note={note}
          view="all"
          focusMode={focusMode}
          isMobile={isMobile}
          onExitMobileEditor={onExitMobileEditor}
          onOpenStyle={() => setStyleOpen(true)}
          onExpandSidebar={onExpandSidebar}
        />
      )}
      {children}
      <NoteEditorProvider
        noteId={note.id}
        content={note.content}
        onChange={(id, content) => useNotesStore.getState().setContent(id, content)}
      >
        <div
          className={`note-canvas min-h-0 flex-1 overflow-y-auto ${veil.veiled && !veil.peeking ? 'note-safe-veiled' : ''} ${veil.peeking ? 'note-safe-peek' : ''}`}
          {...canvasAttrs}
        >
          {kind === 'safe' && <SafeRibbon />}
          {kind === 'writer' && !focusMode && <WriterTopStrip onExit={onWriterExit} />}

          {coverBlock}

          {COVER_KINDS_BADGE.includes(kind) ? (
            <div className="note-card">
              <div className="relative px-8 pb-6 sm:px-16">
                <div style={{ marginTop: '-34px' }}>{titleBlock}</div>
                <TitleInput note={note} />
                {kind === 'journal' && (
                  <p className="note-journal-meta">Journal · {formatDate(note.updatedAt)}</p>
                )}
                {kind === 'capsule' && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="note-capsule-kindpill">
                      <Hourglass className="h-[13px] w-[13px]" aria-hidden="true" />
                      Time capsule
                    </span>
                  </div>
                )}
                {metaRow}
                {pageActions}
                <NoteEditorSurface />
              </div>
            </div>
          ) : kind === 'notepad' ? (
            <div className="note-pad">
              <div className="note-pad-rings" aria-hidden="true" />
              <div className="note-pad-ruled flex-1">
                <span className="note-pad-margin" aria-hidden="true" />
                <span className="note-pad-badge">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  Only you can read this
                </span>
                <div className={columnClass}>
                  <TitleInput note={note} />
                  <NotepadSquiggle />
                  <p className="note-pad-meta">{formatDate(note.updatedAt)}</p>
                  {metaRow}
                  <NoteEditorSurface />
                </div>
                <p className="note-pad-foot">
                  <span>
                    {countWords(note.plainText).words} words · sealed when you close the pad
                  </span>
                  <span className="flex items-center">
                    <span className="note-pad-foot-dot" />
                    End-to-end encrypted
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <div className={columnClass}>
              {kind !== 'writer' && kind !== 'safe' && (
                <div className="note-lite-titleblock">
                  {titleBlock}
                  <TitleInput note={note} />
                </div>
              )}
              {kind === 'writer' && (
                <p className="note-writer-date">{formatDate(note.updatedAt)}</p>
              )}
              {(kind === 'writer' || kind === 'safe') && <TitleInput note={note} />}
              {kind === 'safe' && (
                <div className="mt-3 flex items-center gap-2">
                  {note.pageStyle.burnAfter !== 'off' && (
                    <span className="note-safe-burn">
                      <svg
                        className="h-[13px] w-[13px]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="13" r="8" />
                        <path d="M12 9v4l2 2M9 2h6" />
                      </svg>
                      Burns in {note.pageStyle.burnAfter}
                    </span>
                  )}
                </div>
              )}
              {metaRow}
              {pageActions}
              <NoteEditorSurface />
            </div>
          )}

          <SlashMenu />
          <EmojiPicker />
          <MentionPicker />
          <SelectionBubble />
          <BlockHandle />
          <BlockSelection />
          {kind === 'notepad' && <NotepadTray />}
          {kind === 'writer' && <WriterDock note={note} />}
          {kind === 'playful' && !isMobile && <PlayfulDock />}
          <NotePageStyleMenu
            noteId={note.id}
            open={styleOpen}
            onClose={() => setStyleOpen(false)}
            onPickIcon={(element) => pickIcon(element)}
          />
          <EmojiPopover
            open={iconPicker}
            onClose={() => setIconPicker(false)}
            anchorEl={iconAnchorRef.current}
            label="Change page icon"
            onSelect={(char) => setIcon(char)}
            onRemove={() => setIcon(null)}
          />
        </div>

        {kind === 'safe' && <SafeFoot />}
        {kind === 'journal' && <JournalFoot note={note} />}
        {(kind === 'paper' || kind === 'stickyBoard') && (
          <NoteFooter note={note} focusMode={focusMode} />
        )}

        {isMobile && !focusMode && <MobileFormatBar />}
        {assistantOpen && <AskAssistant />}
      </NoteEditorProvider>
    </>
  )
}

function TitleInput({ note }: { note: NoteRecord }) {
  return (
    <input
      value={note.title}
      aria-label="Note title"
      placeholder="Untitled"
      onChange={(event) => useNotesStore.getState().setTitle(note.id, event.target.value)}
      className={`placeholder:text-muted-foreground/40 ${
        COVER_KINDS_BADGE.includes(note.pageStyle.kind) || note.pageStyle.kind === 'notepad'
          ? 'note-title-input mt-3 block w-full bg-transparent outline-none'
          : 'note-lite-title-input note-title-input'
      }`}
    />
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
