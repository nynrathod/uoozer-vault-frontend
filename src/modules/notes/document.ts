import type { JSONContent } from '@tiptap/core'
import { EMPTY_DOCUMENT } from './constants'
import type { NoteRecord, NoteView } from './types'

export function emptyDocument(): JSONContent {
  return structuredClone(EMPTY_DOCUMENT)
}

export function plainTextFromDoc(doc: JSONContent | null | undefined): string {
  const parts: string[] = []
  const walk = (node?: JSONContent) => {
    if (!node) return
    if (node.type === 'text' && node.text) parts.push(node.text)
    const label = node.attrs?.label
    const caption = node.attrs?.caption
    const fileName = node.attrs?.fileName
    const title = node.attrs?.title
    if (typeof label === 'string') parts.push(label)
    if (typeof caption === 'string') parts.push(caption)
    if (typeof fileName === 'string') parts.push(fileName)
    if (typeof title === 'string') parts.push(title)
    node.content?.forEach(walk)
  }
  walk(doc ?? undefined)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export function countWords(text: string): { words: number; minutes: number } {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const minutes = words === 0 ? 0 : Math.max(1, Math.round(words / 200))
  return { words, minutes }
}

/**
 * Single source of truth for list ordering: pinned notes first, then the
 * stable `order` value ascending — new and restored notes take the top slot.
 * Every list and view reads this through visibleNotes(), so the app can
 * never disagree with itself.
 */
function compareForDisplay(a: NoteRecord, b: NoteRecord): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return a.order - b.order
}

export function sortNotesByDisplay(notes: NoteRecord[]): NoteRecord[] {
  return [...notes].sort(compareForDisplay)
}

/**
 * Gives every note a stable order value the first time older saved data
 * (written before `order` existed) is loaded. Falls back to "most recently
 * updated first", which is what the list used to show.
 */
export function withStableOrder(notes: NoteRecord[]): NoteRecord[] {
  if (notes.every((note) => Number.isFinite(note.order))) return notes
  return [...notes]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((note, index) => ({ ...note, order: index * 10 }))
}

export function visibleNotes(
  notes: NoteRecord[],
  view: NoteView,
  tag: string | null,
  query: string
): NoteRecord[] {
  const q = query.trim().toLowerCase()
  return notes
    .filter((note) => {
      if (view === 'trash') {
        if (!note.trashed) return false
      } else if (note.trashed) return false
      if (view === 'starred' && !note.starred) return false
      if (view === 'pinned' && !note.pinned) return false
      if (tag && !note.tags.includes(tag)) return false
      if (!q) return true
      return `${note.title} ${note.plainText} ${note.tags.join(' ')}`.toLowerCase().includes(q)
    })
    .sort(compareForDisplay)
}

export function noteCounts(notes: NoteRecord[]) {
  const live = notes.filter((note) => !note.trashed)
  const tags = new Map<string, number>()
  for (const note of live) {
    for (const tag of note.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1)
  }
  return {
    all: live.length,
    starred: live.filter((note) => note.starred).length,
    pinned: live.filter((note) => note.pinned).length,
    trash: notes.length - live.length,
    tags: [...tags.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export function viewFromPath(pathname: string): NoteView {
  if (pathname.endsWith('/trash')) return 'trash'
  if (pathname.endsWith('/starred')) return 'starred'
  if (pathname.endsWith('/pinned')) return 'pinned'
  return 'all'
}

/** Drops session-only video URLs before the document is written to disk. */
export function prepareNotesForStorage(notes: NoteRecord[]): NoteRecord[] {
  const json = JSON.stringify(notes, (key, value) => {
    if (key === 'src' && typeof value === 'string' && value.startsWith('blob:')) return ''
    return value
  })
  return JSON.parse(json) as NoteRecord[]
}
