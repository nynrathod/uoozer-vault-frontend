import { useEffect, useState } from 'react'
import {
  Bold,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListTodo,
  Lock,
  Pencil,
  Sparkles,
} from 'lucide-react'
import { useNoteEditor } from '../../editor/NoteEditorProvider'
import { chooseImage } from '../../editor/commands'
import { noteUiBus } from '../../bus'
import { useNotesStore } from '../../store/notesStore'
import { BURN_AFTER_MS } from '../../constants'
import { countWords } from '../../utils/document'
import type { NoteRecord } from '../../types'
import type { ReactNode } from 'react'

function useLockCountdown(note: NoteRecord): string | null {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (note.pageStyle.burnAfter === 'off') return
    const timer = setInterval(() => setTick((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [note.pageStyle.burnAfter, note.updatedAt])
  if (note.pageStyle.burnAfter === 'off') return null
  const horizon = BURN_AFTER_MS[note.pageStyle.burnAfter]
  const left = Math.max(0, horizon - (Date.now() - Date.parse(note.updatedAt)))
  const minutes = Math.floor(left / 60000)
  const seconds = Math.floor((left % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/* ── Writer (Note-C) ─────────────────────────────────────────────────────── */

export function WriterTopStrip({ onExit }: { onExit: () => void }) {
  return (
    <>
      <div className="note-writer-top">
        <Lock className="h-[13px] w-[13px]" aria-hidden="true" />
        Private note · saved on this device
      </div>
      <button type="button" className="note-writer-exit" onClick={onExit}>
        Exit focus
        <span className="note-kbd-esc">esc</span>
      </button>
    </>
  )
}

export function WriterDock({ note }: { note: NoteRecord }) {
  const editor = useNoteEditor()
  const locksIn = useLockCountdown(note)
  const words = countWords(note.plainText)
  const dockButton = (
    aria: string,
    run: () => void,
    icon?: ReactNode,
    className?: string,
    label?: string
  ) => (
    <button
      key={aria}
      type="button"
      aria-label={aria}
      title={aria}
      className={className}
      onPointerDown={(event) => {
        event.preventDefault()
        run()
      }}
    >
      {icon ?? label}
    </button>
  )

  return (
    <>
      <span className="note-writer-words">{words.words} words</span>
      <div className="note-writer-dock">
        <div className="note-writer-dock-bar">
          {dockButton(
            'Bold',
            () => editor?.chain().focus().toggleBold().run(),
            <Bold className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          )}
          {dockButton(
            'Italic',
            () => editor?.chain().focus().toggleItalic().run(),
            <Italic className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          {dockButton(
            'Heading',
            () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
            undefined,
            'is-h1',
            'H1'
          )}
          {dockButton(
            'Bulleted list',
            () => editor?.chain().focus().toggleBulletList().run(),
            <List className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          {dockButton(
            'Checklist',
            () => editor?.chain().focus().toggleTaskList().run(),
            <ListTodo className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          {dockButton(
            'Link',
            () => editor?.chain().focus().toggleLink({ href: '' }).run(),
            <Link2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          {editor
            ? dockButton(
                'Add image or file',
                () => chooseImage(editor),
                <ImageIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              )
            : null}
          <span className="note-writer-dock-split" />
          {dockButton(
            'Ask AI',
            () => noteUiBus.emit({ type: 'assistant.open' }),
            <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />,
            'is-ai'
          )}
          <span className="note-writer-dock-split" />
          <span className="note-writer-locks">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {locksIn ? `Locks in ${locksIn}` : 'Private'}
          </span>
        </div>
      </div>
    </>
  )
}

/* ── Notepad (Note-D) ────────────────────────────────────────────────────── */

export function NotepadTray() {
  const editor = useNoteEditor()
  const trayButton = (aria: string, run: () => void, icon: ReactNode, extra?: string) => (
    <button
      key={aria}
      type="button"
      aria-label={aria}
      title={aria}
      className={extra}
      onPointerDown={(event) => {
        event.preventDefault()
        run()
      }}
    >
      {icon}
    </button>
  )
  return (
    <div className="note-pad-tray">
      {trayButton(
        'Write',
        () => editor?.chain().focus().run(),
        <Pencil className="h-[17px] w-[17px]" strokeWidth={1.6} aria-hidden="true" />,
        'is-active'
      )}
      {trayButton(
        'Highlighter',
        () => editor?.chain().focus().toggleHighlight().run(),
        <Highlighter className="h-[17px] w-[17px]" strokeWidth={1.6} aria-hidden="true" />
      )}
      {trayButton(
        'Checklist',
        () => editor?.chain().focus().toggleTaskList().run(),
        <ListTodo className="h-[17px] w-[17px]" strokeWidth={1.6} aria-hidden="true" />
      )}
      {editor
        ? trayButton(
            'Add image',
            () => chooseImage(editor),
            <ImageIcon className="h-[17px] w-[17px]" strokeWidth={1.6} aria-hidden="true" />
          )
        : null}
      <span className="note-pad-tray-split" />
      {trayButton(
        'Ask AI',
        () => noteUiBus.emit({ type: 'assistant.open' }),
        <Sparkles className="h-[17px] w-[17px]" strokeWidth={1.6} aria-hidden="true" />,
        'is-ai'
      )}
    </div>
  )
}

/** The blue squiggle under the handwritten title (Note-D). */
export function NotepadSquiggle() {
  return (
    <svg
      className="note-pad-squiggle"
      width="230"
      height="12"
      viewBox="0 0 230 12"
      aria-hidden="true"
    >
      <path
        d="M2 7c20-6 36 6 56 0s36-6 56 0 36 6 56 0 36-4 56 0"
        fill="none"
        stroke="#2563EB"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ── Safe (Note-E) ───────────────────────────────────────────────────────── */

export function SafeRibbon() {
  return (
    <div className="note-safe-ribbon">
      <span className="note-safe-shield">
        <svg
          className="h-[17px] w-[17px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </span>
      <span className="note-safe-title">Safe mode</span>
      <span className="note-safe-split" />
      <span className="note-safe-pill">Previews hidden</span>
      <span className="note-safe-pill">Blurs when you switch away</span>
      <span className="note-safe-pill">Clipboard clears in 30s</span>
      <span className="note-safe-pill">
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
        Auto-lock 4:32
      </span>
      <span className="note-safe-on">
        On
        <span className="note-safe-toggle" />
      </span>
    </div>
  )
}

export function SafeFoot() {
  return (
    <div className="note-safe-foot">
      <span className="flex items-center">
        <span className="note-safe-foot-dot" />
        Sealed on this device
      </span>
      <span className="flex items-center gap-2">
        Veil on · hold<span className="note-safe-kbd">⌥</span>to peek
      </span>
      <span>Deleted from every device when it burns</span>
    </div>
  )
}

/** Blurs the writing surface when the window loses focus; ⌥ peeks. */
export function useSafeVeil(enabled: boolean): { veiled: boolean; peeking: boolean } {
  const [veiled, setVeiled] = useState(false)
  const [peeking, setPeeking] = useState(false)
  useEffect(() => {
    if (!enabled) {
      setVeiled(false)
      return
    }
    const onHide = () => setVeiled(document.visibilityState === 'hidden' || !document.hasFocus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setPeeking(event.type === 'keydown')
    }
    onHide()
    window.addEventListener('focus', onHide)
    window.addEventListener('blur', onHide)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('focus', onHide)
      window.removeEventListener('blur', onHide)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [enabled])
  return { veiled: enabled && veiled, peeking }
}

/* ── Playful (Note-F) ────────────────────────────────────────────────────── */

export function PlayfulDock() {
  const editor = useNoteEditor()
  return (
    <div className="note-playful-dock">
      <div className="note-playful-dock-bar">
        <button
          type="button"
          aria-label="Bold"
          title="Bold"
          onPointerDown={(event) => {
            event.preventDefault()
            editor?.chain().focus().toggleBold().run()
          }}
          data-tone="blue"
        >
          <Bold className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Highlight"
          title="Highlight"
          onPointerDown={(event) => {
            event.preventDefault()
            editor?.chain().focus().toggleHighlight().run()
          }}
          data-tone="yellow"
        >
          <Highlighter className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Checklist"
          title="Checklist"
          onPointerDown={(event) => {
            event.preventDefault()
            editor?.chain().focus().toggleTaskList().run()
          }}
          data-tone="green"
        >
          <ListTodo className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
        {editor && (
          <button
            type="button"
            aria-label="Add image"
            title="Add image"
            onPointerDown={(event) => {
              event.preventDefault()
              chooseImage(editor)
            }}
            data-tone="pink"
          >
            <ImageIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
        <span className="note-writer-dock-split" />
        <button
          type="button"
          className="is-ai"
          onPointerDown={(event) => {
            event.preventDefault()
            noteUiBus.emit({ type: 'assistant.open' })
          }}
        >
          <Sparkles className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden="true" />
          Ask AI
        </button>
      </div>
    </div>
  )
}

/* ── Journal (Note-G) ────────────────────────────────────────────────────── */

export function JournalFoot({ note }: { note: NoteRecord }) {
  const words = countWords(note.plainText)
  return (
    <div className="note-journal-foot">
      <span>{words.words} words · saved on this device</span>
      <span className="note-journal-release">Release deletes it from every device</span>
      <button
        type="button"
        className="note-journal-letgo"
        onClick={() => useNotesStore.getState().trashNote(note.id, 'all')}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2" />
        </svg>
        Let it go
      </button>
      <button
        type="button"
        className="note-journal-keep"
        onClick={() => useNotesStore.getState().togglePin(note.id)}
      >
        Keep note
      </button>
    </div>
  )
}

/* ── Time capsule (Note-I) — the capsule BLOCK was removed from the module,
   so the seal-a-capsule footer is gone with it. The capsule page kind
   itself remains as pure chrome. ───────────────────────────────────────── */
