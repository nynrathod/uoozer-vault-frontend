import { useEffect } from 'react'
import { useUIStore } from '@stores/uiStore'

/**
 * Keyboard shortcuts reference — ⌘/ opens it from the account menu or the
 * global listener. It lists only shortcuts that are actually wired in this
 * build; "⌘ becomes Ctrl on Windows" is stated on the sheet itself.
 *
 * Dialog, tray — EXACT elevation: radius 14 · 0 16px 48px rgba(17,24,39,.16)
 * + 1px rgba(17,24,39,.06) ring. Key chips are the sheet's .k style
 * (12/500 · #F1F3F7 · #374151 · radius 6 · padding 1px 7px · min-width 24).
 */

const SHORTCUTS: { keys: string; label: string; hint: string }[] = [
  { keys: '⌘K', label: 'Search', hint: 'Files and folders' },
  { keys: '⌘N', label: 'New note', hint: 'Creates a note and opens Notes' },
  { keys: '⌘⇧F', label: 'Focus mode', hint: 'Full-screen note editing' },
  { keys: '⌘⇧L', label: 'Lock now', hint: 'Requires your password again' },
  { keys: '⌘/', label: 'All shortcuts', hint: 'This dialog' },
  { keys: 'Esc', label: 'Close or exit', hint: 'Closes the open overlay' },
]

const NOTE_SHORTCUTS: { keys: string; label: string; hint: string }[] = [
  { keys: '/', label: 'Insert a block', hint: 'Slash menu inside a note' },
]

export function ShortcutsDialog() {
  const open = useUIStore((s) => s.shortcutsOpen)
  const setOpen = useUIStore((s) => s.setShortcutsOpen)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const Row = ({ keys, label, hint }: { keys: string; label: string; hint: string }) => (
    <div className="hover:bg-hover-surface flex items-center gap-3 rounded-sm px-2.5 py-1.5">
      <span className="uv-kbd">{keys}</span>
      <span className="text-gray-ui flex-1 text-[13.5px]">{label}</span>
      <span className="text-muted-foreground hidden text-[12px] sm:block">{hint}</span>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/20 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-popover animate-scale-in w-full max-w-[380px] rounded-2xl p-2 shadow-dialog outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="flex items-baseline justify-between px-2.5 pt-2 pb-1">
          <p className="text-ink text-[14px] font-semibold">Keyboard</p>
          <p className="text-muted-foreground text-[12px]">⌘ becomes Ctrl on Windows</p>
        </div>

        <div className="mt-1 space-y-0.5">
          {SHORTCUTS.map((s) => (
            <Row key={s.keys} {...s} />
          ))}
        </div>

        <p className="text-muted-foreground mt-3 px-2.5 pt-1 text-[12px] leading-4 font-medium">
          Inside a note
        </p>
        <div className="mt-1 space-y-0.5">
          {NOTE_SHORTCUTS.map((s) => (
            <Row key={s.keys} {...s} />
          ))}
        </div>
      </div>
    </div>
  )
}
