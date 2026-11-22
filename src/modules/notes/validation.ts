import { BURN_AFTER_MS } from './constants'
import {
  DEFAULT_PAGE_STYLE,
  type BurnAfter,
  type NoteKind,
  type NoteRecord,
  type NoteTint,
  type PageBackground,
  type PageFont,
  type PageStyle,
  type PageTextSize,
} from './types'

export const PAGE_BACKGROUNDS: readonly PageBackground[] = [
  'default',
  'sand',
  'mist',
  'rose',
  'mint',
  'sky',
  'lilac',
  'night',
] as const

export const PAGE_FONTS: readonly PageFont[] = ['sans', 'serif', 'mono'] as const
export const PAGE_TEXT_SIZES: readonly PageTextSize[] = ['small', 'default', 'large'] as const
export const BURN_OPTIONS: readonly BurnAfter[] = ['off', '24h', '7d', '30d'] as const

export const NOTE_KINDS: readonly NoteKind[] = [
  'paper',
  'writer',
  'notepad',
  'safe',
  'playful',
  'journal',
  'stickyBoard',
  'capsule',
] as const

/** Max title length before it is clamped (list rows stay readable). */
export const NOTE_TITLE_MAX = 200

/** Max tags per note, and per-tag length. */
export const NOTE_TAG_MAX_COUNT = 12
export const NOTE_TAG_MAX_LENGTH = 24

export function isPageBackground(value: unknown): value is PageBackground {
  return typeof value === 'string' && (PAGE_BACKGROUNDS as readonly string[]).includes(value)
}

export function isPageFont(value: unknown): value is PageFont {
  return typeof value === 'string' && (PAGE_FONTS as readonly string[]).includes(value)
}

export function isPageTextSize(value: unknown): value is PageTextSize {
  return typeof value === 'string' && (PAGE_TEXT_SIZES as readonly string[]).includes(value)
}

export function isBurnAfter(value: unknown): value is BurnAfter {
  return typeof value === 'string' && (BURN_OPTIONS as readonly string[]).includes(value)
}

export function isNoteKind(value: unknown): value is NoteKind {
  return typeof value === 'string' && (NOTE_KINDS as readonly string[]).includes(value)
}

/** Cover presets live in data/covers.ts; a hex band is also allowed. */
export function isCoverValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (/^#[0-9a-f]{6}$/i.test(value) ||
      ['waves', 'sunrise', 'moon', 'circles', 'hills'].includes(value))
  )
}

/** Clamps a title edit: trimmed, never longer than the cap, never undefined. */
export function sanitizeNoteTitle(raw: string): string {
  return raw.slice(0, NOTE_TITLE_MAX)
}

/**
 * Normalizes a tag being typed into the tag row: lowercase, no leading #,
 * no inner whitespace, length-capped.
 */
export function sanitizeNoteTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, NOTE_TAG_MAX_LENGTH)
}

/** Adds a tag if valid and not already present; returns the next list. */
export function addTag(tags: string[], raw: string): string[] {
  const tag = sanitizeNoteTag(raw)
  if (!tag || tags.includes(tag) || tags.length >= NOTE_TAG_MAX_COUNT) return tags
  return [...tags, tag]
}

/**
 * Coerces anything (loaded JSON, form state) into a valid PageStyle. Unknown
 * or missing members fall back to the defaults, so bad data can never crash
 * the canvas.
 */
export function coercePageStyle(value: unknown): PageStyle {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PAGE_STYLE }
  const raw = value as Partial<PageStyle>
  return {
    kind: isNoteKind(raw.kind) ? raw.kind : DEFAULT_PAGE_STYLE.kind,
    background: isPageBackground(raw.background) ? raw.background : DEFAULT_PAGE_STYLE.background,
    font: isPageFont(raw.font) ? raw.font : DEFAULT_PAGE_STYLE.font,
    textSize: isPageTextSize(raw.textSize) ? raw.textSize : DEFAULT_PAGE_STYLE.textSize,
    fullWidth: Boolean(raw.fullWidth),
    locked: Boolean(raw.locked),
    burnAfter: isBurnAfter(raw.burnAfter) ? raw.burnAfter : DEFAULT_PAGE_STYLE.burnAfter,
    cover: isCoverValue(raw.cover) ? raw.cover : null,
  }
}

/** True while a burn-after note is still within its horizon. */
export function isNoteWithinBurnWindow(note: NoteRecord, now = Date.now()): boolean {
  if (note.pageStyle.burnAfter === 'off') return true
  const horizon = BURN_AFTER_MS[note.pageStyle.burnAfter]
  return now - Date.parse(note.updatedAt) < horizon
}

/** Guard for the legacy tint field on old records. */
export function isNoteTint(value: unknown): value is NoteTint {
  return (
    typeof value === 'string' &&
    ['gray', 'amber', 'green', 'blue', 'purple', 'pink', 'red'].includes(value)
  )
}
