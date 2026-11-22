import type { NoteKind, NoteTemplate, PageBackground, PageStyle } from '../types'
import { DEFAULT_PAGE_STYLE } from '../types'

export const PAGE_BACKGROUND_OPTIONS: {
  id: PageBackground
  label: string
}[] = [
  { id: 'default', label: 'Default' },
  { id: 'sand', label: 'Sand' },
  { id: 'mist', label: 'Mist' },
  { id: 'rose', label: 'Rose' },
  { id: 'mint', label: 'Mint' },
  { id: 'sky', label: 'Sky' },
  { id: 'lilac', label: 'Lilac' },
  { id: 'night', label: 'Night' },
]

/** Suggested pairing shown under each style card ("Defaults by kind"). */
export const PAGE_BACKGROUND_KINDS: Record<PageBackground, string> = {
  default: 'Everything else',
  sand: 'Journal',
  mist: 'Meeting',
  rose: 'Personal',
  mint: 'Health, habits',
  sky: 'Ideas, projects',
  lilac: 'Playful',
  night: 'Private, safe mode',
}

/* ── Note kinds (the nine screens) ────────────────────────────────────────── */

export interface NoteKindSpec {
  id: NoteKind
  label: string
  description: string
  /** Defaults applied when the kind is chosen (still editable after). */
  defaults: Partial<PageStyle>
  /** Tint used by the picker preview card. */
  previewTint: PageBackground
}

export const NOTE_KIND_OPTIONS: readonly NoteKindSpec[] = [
  {
    id: 'paper',
    label: 'Paper',
    description: 'The classic editor',
    defaults: {},
    previewTint: 'default',
  },
  {
    id: 'writer',
    label: 'Writer',
    description: 'Focus column, date, bottom dock',
    defaults: { font: 'serif' },
    previewTint: 'default',
  },
  {
    id: 'notepad',
    label: 'Notepad',
    description: 'Cozy desk, pen tray, ruled pad',
    defaults: {},
    previewTint: 'sand',
  },
  {
    id: 'safe',
    label: 'Safe',
    description: 'Blurs when you switch away, auto-locks',
    defaults: { background: 'night', locked: true, burnAfter: '24h' },
    previewTint: 'night',
  },
  {
    id: 'playful',
    label: 'Playful',
    description: 'Cover, big icon, sticky colors',
    defaults: { background: 'lilac', cover: 'waves' },
    previewTint: 'lilac',
  },
  {
    id: 'journal',
    label: 'Journal',
    description: 'Mood and a daily prompt',
    defaults: { background: 'sand', cover: 'sunrise', font: 'serif' },
    previewTint: 'sand',
  },
  {
    id: 'stickyBoard',
    label: 'Sticky board',
    description: 'Free-placed stickies and clusters',
    defaults: {},
    previewTint: 'mist',
  },
  {
    id: 'capsule',
    label: 'Time capsule',
    description: 'Sealed until the date you choose',
    defaults: { background: 'night', cover: 'moon' },
    previewTint: 'night',
  },
]

/** Base style for a kind (kind defaults over the module default). */
export function kindBaseStyle(kind: NoteKind): PageStyle {
  const spec = NOTE_KIND_OPTIONS.find((option) => option.id === kind)
  return { ...DEFAULT_PAGE_STYLE, ...(spec?.defaults ?? {}), kind }
}

/** Journal/Playful/Capsule headings display in Nunito, Notepad in Caveat. */
export const KIND_DISPLAY_FONT: Partial<Record<NoteKind, string>> = {
  playful: "'Nunito',sans-serif",
  journal: "'Nunito',sans-serif",
  capsule: "'Nunito',sans-serif",
  notepad: "'Caveat',cursive",
}

/* ── New-note templates (Notes-Home-Empty sheet · chips + start-from grid) ── */

export const NOTE_TEMPLATES: readonly NoteTemplate[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'Start from an empty page',
    pageStyle: { ...DEFAULT_PAGE_STYLE },
    starter: 'blank',
  },
  {
    id: 'journal',
    label: 'Journal',
    description: 'Mood and a daily prompt',
    pageStyle: { ...kindBaseStyle('journal') },
    starter: 'daily',
  },
  {
    id: 'meeting',
    label: 'Meeting',
    description: 'Agenda, notes, actions',
    pageStyle: { ...DEFAULT_PAGE_STYLE, background: 'mist' },
    starter: 'meeting',
  },
  {
    id: 'todo',
    label: 'To-do',
    description: 'A checklist that tracks itself',
    pageStyle: { ...DEFAULT_PAGE_STYLE },
    starter: 'todo',
  },
  {
    id: 'project',
    label: 'Project',
    description: 'Roadmap with sub-pages',
    pageStyle: { ...DEFAULT_PAGE_STYLE, background: 'sky' },
    starter: 'project',
  },
  {
    id: 'private',
    label: 'Private',
    description: 'Safe mode, burns after reading',
    pageStyle: { ...kindBaseStyle('safe') },
    starter: 'blank',
  },
  {
    id: 'notepad',
    label: 'Notepad',
    description: 'Cozy pad on a desk',
    pageStyle: { ...kindBaseStyle('notepad') },
    starter: 'blank',
  },
  {
    id: 'playful',
    label: 'Playful',
    description: 'Cover, icon and color',
    pageStyle: { ...kindBaseStyle('playful') },
    starter: 'blank',
  },
  {
    id: 'board',
    label: 'Sticky board',
    description: 'A free-form wall of stickies',
    pageStyle: { ...kindBaseStyle('stickyBoard') },
    starter: 'blank',
  },
] as const

/** Template lookup by id (unknown → Blank). */
export function templateById(id: string): NoteTemplate {
  return NOTE_TEMPLATES.find((template) => template.id === id) ?? NOTE_TEMPLATES[0]
}
