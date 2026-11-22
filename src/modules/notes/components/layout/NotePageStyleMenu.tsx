import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, Lock, Palette, Smile, Trash2 } from 'lucide-react'
import { cn } from '@lib/utils'
import { useNotesStore } from '../../store/notesStore'
import { NOTE_KIND_OPTIONS, PAGE_BACKGROUND_OPTIONS } from '../../data/pageStyles'
import { COVER_PRESETS } from '../../data/covers'
import { BURN_OPTIONS, PAGE_FONTS, PAGE_TEXT_SIZES } from '../../validation'
import type { BurnAfter, NoteKind, PageBackground, PageFont, PageTextSize } from '../../types'

const TINT_HEX: Record<PageBackground, string> = {
  default: '#ffffff',
  sand: '#fbf6ec',
  mist: '#f3f5f9',
  rose: '#fdf1f4',
  mint: '#eef8f2',
  sky: '#eef4fd',
  lilac: '#f4f1ff',
  night: '#0d1220',
}

export function NotePageStyleMenu({
  noteId,
  open,
  onClose,
  onPickIcon,
}: {
  noteId: string
  open: boolean
  onClose: () => void
  /** Anchors the shared emoji picker on the Icon tile (replaces prompt). */
  onPickIcon?: (element: HTMLElement | null) => void
}) {
  const note = useNotesStore((state) => state.notes.find((item) => item.id === noteId) ?? null)
  const setPageStyle = useNotesStore((state) => state.setPageStyle)
  const setNoteKind = useNotesStore((state) => state.setNoteKind)
  const setIcon = useNotesStore((state) => state.setIcon)
  const rootRef = useRef<HTMLDivElement>(null)
  const iconTileRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || !note) return null
  const style = note.pageStyle

  const row = 'flex min-h-[42px] items-center gap-2.5 text-[13.5px]'
  const action =
    'text-blue-ink hover:bg-tint rounded-sm px-1.5 py-0.5 text-[13px] font-medium transition-colors'

  /* PORTAL to document.body — the panel is a top-level sheet. Inside the
     note canvas it used to inherit the canvas as its positioning context,
     and the later-defined `.note-pop` rules won the cascade, pushing it
     below the scroll fold: "Change cover" (and /burn) looked dead. From
     body, the fixed `.note-pop.note-style-panel` placement always lands
     on screen, above every canvas layer. */
  return createPortal(
    <div
      ref={rootRef}
      className="note-pop note-style-panel max-h-[calc(100vh-64px)] w-[340px] overflow-y-auto rounded-xl p-3.5"
      role="dialog"
      aria-label="Page style"
    >
      {/* ── Kind: the nine screens ── */}
      <p className="text-muted-foreground px-0.5 pb-2 text-[12px] font-medium">Kind</p>
      <div className="grid grid-cols-2 gap-2 px-0.5 pb-1">
        {NOTE_KIND_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            title={option.description}
            className={cn(
              'rounded-[10px] p-1.5 text-left transition-shadow',
              style.kind === option.id
                ? 'shadow-[0_0_0_2px_#2563eb]'
                : 'shadow-[inset_0_0_0_1px_rgba(17,24,39,.08)] hover:shadow-[0_0_0_1px_rgba(17,24,39,.14)]'
            )}
            style={{ background: TINT_HEX[option.previewTint] }}
            onClick={() => setNoteKind(note.id, option.id as NoteKind)}
          >
            <span className="block h-[44px] overflow-hidden rounded-md">
              <span
                className="block h-[14px] w-full"
                style={{
                  background:
                    option.id === 'journal'
                      ? '#f3e3bc'
                      : option.id === 'playful' || option.id === 'capsule'
                        ? '#c9dbfa'
                        : 'transparent',
                }}
              />
              <span
                className="mt-2.5 block h-[7px] w-[55%] rounded-[3px]"
                style={{
                  background: option.previewTint === 'night' ? '#f3f4f8' : '#111827',
                  opacity: 0.75,
                  marginInline: 'auto auto 0',
                }}
              />
              <span
                className="mt-[7px] block h-[6px] w-[88%] rounded-[3px]"
                style={{
                  background: option.previewTint === 'night' ? '#f3f4f8' : '#111827',
                  opacity: 0.28,
                  marginInline: 'auto auto 0',
                }}
              />
              <span
                className="mt-[7px] block h-[6px] w-[60%] rounded-[3px]"
                style={{
                  background: option.previewTint === 'night' ? '#f3f4f8' : '#111827',
                  opacity: 0.28,
                  marginInline: 'auto auto 0',
                }}
              />
            </span>
            <span
              className="mt-1.5 block text-[12px] font-medium"
              style={{ color: option.previewTint === 'night' ? '#f3f4f8' : '#111827' }}
            >
              {option.label}
            </span>
          </button>
        ))}
      </div>

      <span className="note-pop-sep" />

      {/* Icon */}
      <div className={row}>
        <span
          ref={iconTileRef}
          className="bg-headsup-tint text-headsup flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[10px] text-[16px]"
          title="Change icon"
          onClick={(event) => {
            if (onPickIcon) onPickIcon(event.currentTarget)
          }}
        >
          {note.icon ?? <Smile className="h-[18px] w-[18px]" strokeWidth={1.6} />}
        </span>
        <span className="flex-1">Icon</span>
        <button type="button" className={action} onClick={() => iconTileRef.current?.click()}>
          Change
        </button>
        {note.icon && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground px-1 text-[13px]"
            onClick={() => setIcon(note.id, null)}
          >
            Remove
          </button>
        )}
      </div>

      {/* Cover */}
      <div className={row}>
        <span className="bg-tint text-primary flex h-[34px] w-[34px] items-center justify-center rounded-lg">
          <ImageIcon className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <span className="flex-1">Cover</span>
        {style.cover && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground px-1 text-[13px]"
            onClick={() => setPageStyle(note.id, { cover: null })}
          >
            Remove
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 px-0.5 pb-1">
        {COVER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            aria-label={`${preset.label} cover`}
            className={cn(
              'h-[30px] w-[46px] overflow-hidden rounded-md transition-shadow',
              style.cover === preset.id
                ? 'shadow-[0_0_0_2px_#2563eb]'
                : 'shadow-[inset_0_0_0_1px_rgba(17,24,39,.14)]'
            )}
            onClick={() => setPageStyle(note.id, { cover: preset.id })}
          >
            <svg
              viewBox={`0 0 ${preset.id === 'circles' ? 120 : 100} ${preset.height}`}
              className="h-full w-full"
              preserveAspectRatio="none"
            >
              <rect width="120" height={preset.height} fill={preset.bg} />
              {preset.shapes
                .slice(0, 2)
                .map((shape, index) =>
                  shape.t === 'circle' ? (
                    <circle
                      key={index}
                      cx={shape.cx / 10}
                      cy={shape.cy / 2}
                      r={shape.r / 4}
                      fill={shape.fill}
                    />
                  ) : shape.t === 'rect' ? (
                    <rect
                      key={index}
                      x={shape.x / 10}
                      y={shape.y / 2}
                      width={shape.w / 10}
                      height={shape.h / 2}
                      rx={shape.rx}
                      fill={shape.fill}
                      opacity={shape.o}
                    />
                  ) : (
                    <path key={index} d={shape.d} fill={shape.fill} opacity={shape.o} />
                  )
                )}
            </svg>
          </button>
        ))}
        <button
          type="button"
          title="Solid color band"
          aria-label="Solid color cover"
          className={cn(
            'h-[30px] w-[46px] overflow-hidden rounded-md bg-[#DCE8FB] transition-shadow',
            style.cover && style.cover.startsWith('#')
              ? 'shadow-[0_0_0_2px_#2563eb]'
              : 'shadow-[inset_0_0_0_1px_rgba(17,24,39,.14)]'
          )}
          onClick={() => setPageStyle(note.id, { cover: '#DCE8FB' })}
        />
      </div>

      <span className="note-pop-sep" />

      {/* Background tints */}
      <p className="text-muted-foreground px-0.5 pt-1 pb-2 text-[12px] font-medium">Background</p>
      <div className="flex flex-wrap gap-2 px-0.5 pb-1">
        {PAGE_BACKGROUND_OPTIONS.map((background) => (
          <button
            key={background.id}
            type="button"
            title={`${background.label} — ${background.id === 'default' ? 'default' : background.id}`}
            aria-label={`${background.label} background`}
            className={cn(
              'note-style-swatch',
              background.id !== 'default' && `note-style-swatch-${background.id}`,
              background.id === 'default' && 'bg-card shadow-[inset_0_0_0_1px_hsl(var(--border))]',
              style.background === background.id && 'is-active'
            )}
            onClick={() => setPageStyle(note.id, { background: background.id as PageBackground })}
          />
        ))}
      </div>

      {/* Font */}
      <div className={`${row} mt-2`}>
        <span className="flex-1">Font</span>
        <div className="note-seg" role="radiogroup" aria-label="Page font">
          {PAGE_FONTS.map((font) => (
            <button
              key={font}
              type="button"
              role="radio"
              aria-checked={style.font === font}
              className={cn('note-seg-btn', style.font === font && 'is-active')}
              onClick={() => setPageStyle(note.id, { font: font as PageFont })}
            >
              {font.charAt(0).toUpperCase() + font.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Text size */}
      <div className={row}>
        <span className="flex-1">Text size</span>
        <div className="note-seg" role="radiogroup" aria-label="Text size">
          {PAGE_TEXT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={style.textSize === size}
              className={cn('note-seg-btn', style.textSize === size && 'is-active')}
              onClick={() => setPageStyle(note.id, { textSize: size as PageTextSize })}
            >
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Full width */}
      <button
        type="button"
        className={`${row} w-full`}
        onClick={() => setPageStyle(note.id, { fullWidth: !style.fullWidth })}
      >
        <span className="flex-1 text-left">Full width</span>
        <span className={cn('note-switch', style.fullWidth && 'is-on')} aria-hidden="true">
          <span className="note-switch-knob" />
        </span>
      </button>

      {/* Lock this page */}
      <button
        type="button"
        className={`${row} w-full`}
        onClick={() => setPageStyle(note.id, { locked: !style.locked })}
      >
        <span className="flex-1 text-left">
          Lock this page
          <span className="text-muted-foreground mt-0.5 block text-[12px]">
            Asks for your password to open
          </span>
        </span>
        <span className={cn('note-switch', style.locked && 'is-on')} aria-hidden="true">
          <span className="note-switch-knob" />
        </span>
      </button>

      {/* Burn after */}
      <div className={row}>
        <span className="flex-1">Burn after</span>
        <div className="note-seg" role="radiogroup" aria-label="Burn after">
          {BURN_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={style.burnAfter === option}
              className={cn('note-seg-btn', style.burnAfter === option && 'is-active')}
              onClick={() => setPageStyle(note.id, { burnAfter: option as BurnAfter })}
            >
              {option === 'off' ? 'Off' : option}
            </button>
          ))}
        </div>
      </div>

      <span className="note-pop-sep" />

      <p className="text-muted-foreground flex items-start gap-1.5 px-0.5 pb-1 text-[11.5px] leading-[17px]">
        <Palette className="mt-0.5 h-3 w-3 shrink-0" />
        One editor, many looks. Tint a page, or set a default per kind of note. The editor itself
        never changes.
      </p>
      {style.locked && (
        <p className="text-muted-foreground flex items-center gap-1.5 px-0.5 pb-1 text-[11.5px]">
          <Lock className="h-3 w-3 shrink-0" /> This page will ask for your password once the notes
          backend lands.
        </p>
      )}
      {(style.burnAfter !== 'off' || note.trashed) && (
        <button
          type="button"
          className="note-pop-item note-pop-danger mt-1 w-full"
          onClick={() => {
            useNotesStore.getState().trashNote(note.id, 'all')
            onClose()
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete this note now
        </button>
      )}
    </div>,
    document.body
  )
}
