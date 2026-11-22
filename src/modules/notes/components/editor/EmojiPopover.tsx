import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { EMOJI_GROUPS } from './emojiData'

const CARD_WIDTH = 312
const CARD_MAX_HEIGHT = 296
const EDGE = 8

export interface EmojiPopoverProps {
  open: boolean
  onClose: () => void
  /** Receives the picked emoji character. */
  onSelect: (char: string) => void
  /** Offered when set (e.g. "Remove icon"). */
  onRemove?: () => void
  /** The element to anchor to; centered under it, clamped to the viewport. */
  anchorEl: HTMLElement | null
  /** Label for the dialog (a11y). */
  label?: string
}

export function EmojiPopover({
  open,
  onClose,
  onSelect,
  onRemove,
  anchorEl,
  label = 'Emoji picker',
}: EmojiPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  /* The full grid is heavy (hundreds of buttons). The shell paints on the
     first frame, the grid lands on the next — the panel opens instantly
     instead of freezing the press. */
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!open) {
      setReady(false)
      return
    }
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return EMOJI_GROUPS
    return EMOJI_GROUPS.map((group) => ({
      name: group.name,
      emojis: group.emojis.filter(([, name]) => name.includes(q)),
    })).filter((group) => group.emojis.length > 0)
  }, [query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const onDocDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !anchorEl?.contains(target)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDocDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onClose)
    }
  }, [open, onClose, anchorEl])

  if (!open) return null

  // Position: under the anchor, clamped; flips above when it would overflow.
  let top = 12
  let left = window.innerWidth / 2 - CARD_WIDTH / 2
  const rect = anchorEl?.getBoundingClientRect()
  if (rect) {
    left = Math.max(
      EDGE,
      Math.min(rect.left + rect.width / 2 - CARD_WIDTH / 2, window.innerWidth - CARD_WIDTH - EDGE)
    )
    const openUp = rect.bottom + CARD_MAX_HEIGHT + 96 > window.innerHeight
    top = openUp ? Math.max(EDGE, rect.top - CARD_MAX_HEIGHT - 10) : rect.bottom + 8
  }

  return (
    <div
      ref={rootRef}
      className="note-emoji is-card"
      style={{ top, left, maxHeight: CARD_MAX_HEIGHT }}
      role="dialog"
      aria-label={label}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="note-emoji-search">
        <Search className="text-muted-foreground h-3.5 w-3.5" />
        <input
          autoFocus
          value={query}
          placeholder="Search emoji…"
          aria-label="Search emoji"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="note-emoji-groups">
        {!ready && <p className="text-muted-foreground px-1 py-6 text-center text-[12px]">…</p>}
        {ready && filtered.length === 0 && (
          <p className="text-muted-foreground px-1 py-6 text-center text-[12px]">
            No matching emoji
          </p>
        )}
        {ready &&
          filtered.map((group) => (
            <div key={group.name} className="note-emoji-group">
              <p className="note-emoji-group-title">{group.name}</p>
              <div className="note-emoji-grid">
                {group.emojis.map(([char, name]) => (
                  <button
                    key={`${group.name}-${name}`}
                    type="button"
                    title={name}
                    aria-label={name}
                    className="note-emoji-item"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelect(char)
                      onClose()
                    }}
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
      {onRemove && (
        <button
          type="button"
          className="note-emoji-remove"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onRemove()
            onClose()
          }}
        >
          Remove
        </button>
      )}
    </div>
  )
}
