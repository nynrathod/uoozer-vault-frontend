import { useEffect } from 'react'
import { useUIStore } from '@stores/uiStore'

/**
 * Keyboard shortcuts reference — ⌘/ opens it from the account menu or the
 * global listener. It lists only shortcuts that are actually wired in this
 * build; "⌘ becomes Ctrl on Windows" is stated on the sheet itself.
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
    <div className="hover:bg-hover-surface flex items-center gap-4 rounded-[6px] px-3 py-2">
      <span className="bg-active-surface text-ink flex h-7 min-w-14 items-center justify-center rounded-[6px] px-2 text-[12px] font-medium tabular-nums">
        {keys}
      </span>
      <span className="text-body-text flex-1 text-[13px] font-medium">{label}</span>
      <span className="text-muted-foreground hidden text-[12px] sm:block">{hint}</span>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/20 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-popover animate-scale-in w-full max-w-[380px] rounded-[10px] p-2 shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="flex items-baseline justify-between px-3 pt-2 pb-1">
          <p className="text-ink text-[14px] font-semibold">Keyboard</p>
          <p className="text-muted-foreground text-[12px]">⌘ becomes Ctrl on Windows</p>
        </div>

        <div className="mt-1 space-y-0.5">
          {SHORTCUTS.map((s) => (
            <Row key={s.keys} {...s} />
          ))}
        </div>

        <p className="text-muted-foreground mt-3 px-3 pt-1 text-[12px] leading-4 font-medium">
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
