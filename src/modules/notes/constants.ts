import type { JSONContent } from '@tiptap/core'

/* ============================================================================
 * NOTES MODULE CONSTANTS — one place for every tunable value.
 * ==========================================================================*/

/** localStorage envelope that holds the full notes array. */
export const NOTES_STORAGE_KEY = 'uoozer.notes.documents.v1'

/** sessionStorage key remembering the last open note id. */
export const NOTES_ACTIVE_KEY = 'uoozer.notes.active'

/** Debounce window between the last edit and the persist call (ms). */
export const NOTE_SAVE_DELAY_MS = 650

/** Images larger than this are rejected while notes are device-only (bytes). */
export const NOTE_IMAGE_BYTE_LIMIT = 1_500_000

/** The empty ProseMirror document every new note starts from. */
export const EMPTY_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] } satisfies JSONContent

/** Step used when reindexing manual order so future inserts have room. */
export const ORDER_STEP = 10

/** Slash menu geometry — keep LIST height in sync with .note-slash-list
 *  max-height in notes.css (§5); the width matches the design sheet. */
export const SLASH_MENU_WIDTH = 300
export const SLASH_LIST_HEIGHT = 380

/** Note list pane width on md+ (design: 300px column). */
export const NOTES_LIST_WIDTH = 300

/** Writing column width (design: 700–780px depending on sheet). */
export const NOTE_COLUMN_MAX_WIDTH = 780

/** How long transient notices (bus errors) stay on screen (ms). */
export const NOTE_NOTICE_MS = 4200

/** Secret blocks auto-hide this long after Reveal (ms). */
export const NOTE_SECRET_AUTOHIDE_MS = 10_000

/** Copy feedback for secret/code widgets (ms). */
export const NOTE_COPY_FEEDBACK_MS = 1200

/** Burn-after horizons in milliseconds, keyed by the stored label. */
export const BURN_AFTER_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
} as const

/** AI prompt presets shown under the composer (Blocks-2 · Ask AI). */
export const AI_PROMPT_PRESETS = [
  'Summarize',
  'Continue writing',
  'Fix tone',
  'Translate',
] as const
