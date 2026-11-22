import type { JSONContent } from '@tiptap/core'

/**
 * Envelope for a note encrypted on this device. The ciphertext and nonce are
 * base64 and the algorithm tag travels with the blob so future ciphers can
 * coexist with old data. The note id is bound INTO the plaintext before
 * sealing, which makes a swapped blob fail to open.
 */
export interface SealedNoteBlob {
  version: 1
  algorithm: 'xchacha20-poly1305'
  ciphertext: string
  nonce: string
}

/** Background tints. Values live in notes.css (§1) as --page-bg-<id>. */
export type PageBackground =
  'default' | 'sand' | 'mist' | 'rose' | 'mint' | 'sky' | 'lilac' | 'night'

export type PageFont = 'sans' | 'serif' | 'mono'
export type PageTextSize = 'small' | 'default' | 'large'

export type NoteKind =
  'paper' | 'writer' | 'notepad' | 'safe' | 'playful' | 'journal' | 'stickyBoard' | 'capsule'

/** Burn-afterREADING horizon for the whole note. `off` = keep forever. */
export type BurnAfter = 'off' | '24h' | '7d' | '30d'

export interface PageStyle {
  /** Which note screen this page presents (paper is the default editor). */
  kind: NoteKind
  background: PageBackground
  font: PageFont
  textSize: PageTextSize
  /** Let the writing column use the full canvas width. */
  fullWidth: boolean
  /** Ask for the vault password before the note opens. */
  locked: boolean
  /** Auto-destroy the note after the horizon passes. */
  burnAfter: BurnAfter
  /** Cover above the title — a preset id (see data/covers.ts) or a hex band. */
  cover: string | null
}

export const DEFAULT_PAGE_STYLE: PageStyle = {
  kind: 'paper',
  background: 'default',
  font: 'sans',
  textSize: 'default',
  fullWidth: false,
  locked: false,
  burnAfter: 'off',
  cover: null,
}

/**
 * Legacy per-note tints (Keep-style) kept ONLY to read old records; the
 * repository migrates them into `pageStyle.background` on load.
 */
export type NoteTint = 'gray' | 'amber' | 'green' | 'blue' | 'purple' | 'pink' | 'red'

/** Maps a legacy tint onto the closest page-style background. */
const TINT_TO_BACKGROUND: Record<NoteTint, PageBackground> = {
  gray: 'mist',
  amber: 'sand',
  green: 'mint',
  blue: 'sky',
  purple: 'lilac',
  pink: 'rose',
  red: 'rose',
}

export function migrateTint(tint: NoteTint | null | undefined): PageBackground {
  return tint ? (TINT_TO_BACKGROUND[tint] ?? 'default') : 'default'
}

/**
 * Shape of records written before page styles existed: the tint lived on the
 * note itself and every other field was optional. Repositories read raw JSON
 * through this type, then migrate it into a full NoteRecord.
 */
export type LegacyNoteRecord = Partial<NoteRecord> & { tint?: unknown }

/* ── The note record ──────────────────────────────────────────────────────── */

export interface NoteRecord {
  id: string
  title: string
  tags: string[]
  starred: boolean
  pinned: boolean
  trashed: boolean
  /** Parent note when this note is a child page (sidebar tree + breadcrumb). */
  parentNoteId: string | null
  /** Page icon — an emoji glyph shown in the sidebar and above the title. */
  icon: string | null
  folderId: string | null
  order: number
  content: JSONContent
  plainText: string
  createdAt: string
  updatedAt: string
  revision: number
  sealed: SealedNoteBlob | null
  pageStyle: PageStyle
}

/* ── Views, save states, assistant ────────────────────────────────────────── */

export type NoteView = 'all' | 'starred' | 'pinned' | 'trash'
export type SaveStatus = 'saved' | 'saving' | 'error'
export type AssistantScope = 'note' | 'selection'

export interface AssistantState {
  open: boolean
  prompt: string
  scope: AssistantScope
  sourceText: string
  bullets: string[] | null
  error: string | null
  status: 'idle' | 'running' | 'ready' | 'error'
  spin: number
}

/* ── Templates (Notes-Home-Empty sheet) ──────────────────────────────────── */

export interface NoteTemplate {
  id: string
  label: string
  description: string
  /** Page style the template starts from. */
  pageStyle: PageStyle
  /** First block written into the new note's document. */
  starter: 'blank' | 'todo' | 'daily' | 'meeting' | 'project'
}
