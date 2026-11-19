import { NOTES_STORAGE_KEY } from '../constants'
import { emptyDocument, plainTextFromDoc, prepareNotesForStorage, withStableOrder } from '../document'

import { seedNotes } from '../data/seedNotes'
import type { NoteRecord, NoteTint, SealedNoteBlob } from '../types'
import { NOTE_TINTS } from '../types'
import type { JSONContent } from '@tiptap/core'

export interface NotesLoadResult {
  notes: NoteRecord[]
  error: string | null
}

/**
 * Storage boundary for notes. The store never talks to localStorage (or any
 * transport) directly — it calls this interface only. When the notes backend
 * lands, implement the same three methods against the API:
 *
 * - `load()` mirrors `GET /notes` (the adapter seals nothing; it returns the
 *   sealed envelopes and the store opens them with the notes cipher);
 * - `persist()` mirrors a batch upsert + delete (`changed` are the dirty
 *   records with their revision already bumped, `removed` are permanent
 *   deletions, `snapshot` is the full in-memory state for cache-first
 *   adapters that want to write through);
 * - `loadSync()` is an optional fast path for synchronous caches. The
 *   localStorage adapter provides it so the first paint never waits; an HTTP
 *   adapter simply omits it and the store bootstraps asynchronously.
 */
export interface NotesRepository {
  load(): Promise<NotesLoadResult>
  loadSync?(): NotesLoadResult
  persist(changed: NoteRecord[], removed: string[], snapshot: NoteRecord[]): Promise<void>
}

function asSealed(value: unknown): SealedNoteBlob | null {
  if (!value || typeof value !== 'object') return null
  const blob = value as Partial<SealedNoteBlob>
  if (
    blob.version === 1 &&
    typeof blob.ciphertext === 'string' &&
    typeof blob.nonce === 'string'
  ) {
    return { version: 1, algorithm: 'xchacha20-poly1305', ciphertext: blob.ciphertext, nonce: blob.nonce }
  }
  return null
}

function asRecord(value: unknown): NoteRecord | null {
  if (!value || typeof value !== 'object') return null
  const note = value as Partial<NoteRecord>
  if (typeof note.id !== 'string' || typeof note.title !== 'string') return null
  const content = (note.content ?? emptyDocument()) as JSONContent
  if (content.type !== 'doc') return null
  return {
    id: note.id,
    title: note.title,
    tags: Array.isArray(note.tags) ? note.tags.filter((tag) => typeof tag === 'string') : [],
    starred: Boolean(note.starred),
    pinned: Boolean(note.pinned),
    trashed: Boolean(note.trashed),
    folderId: typeof note.folderId === 'string' ? note.folderId : null,
    // NaN marks saved data from before manual ordering existed.
    order: typeof note.order === 'number' && Number.isFinite(note.order) ? note.order : Number.NaN,
    content,
    plainText: typeof note.plainText === 'string' ? note.plainText : plainTextFromDoc(content),
    createdAt: typeof note.createdAt === 'string' ? note.createdAt : new Date().toISOString(),
    updatedAt: typeof note.updatedAt === 'string' ? note.updatedAt : new Date().toISOString(),
    revision: typeof note.revision === 'number' ? note.revision : 0,
    sealed: asSealed(note.sealed),

    // Keep-style page tint; unknown or missing values fall back to default.
    tint: NOTE_TINTS.includes(note.tint as NoteTint) ? (note.tint as NoteTint) : null,
  }
}

function readStored(): NotesLoadResult {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY)
    if (!raw) return { notes: seedNotes(), error: null }
    const parsed = JSON.parse(raw) as { version?: number; notes?: unknown[] }
    if (parsed.version !== 1 || !Array.isArray(parsed.notes)) {
      return {
        notes: seedNotes(),
        error:
          'Saved notes were in an unknown format. Showing the sample workspace. Editing replaces the unreadable copy on this device.',
      }
    }
    const notes = withStableOrder(
      parsed.notes.map(asRecord).filter((note): note is NoteRecord => note !== null)
    )
    return { notes, error: null }
  } catch {
    return {
      notes: seedNotes(),
      error:
        'Saved notes could not be read. Showing the sample workspace. Editing replaces the unreadable copy on this device.',
    }
  }
}

export const localNotesRepository: NotesRepository = {
  loadSync: () => readStored(),

  async load() {
    return readStored()
  },

  async persist(changed, removed, snapshot) {
    if (changed.length === 0 && removed.length === 0) return
    // The snapshot already contains the changed records; removed ids are
    // filtered here so a failed save leaves the previous copy intact.
    const removedIds = new Set(removed)
    const next = prepareNotesForStorage(snapshot.filter((note) => !removedIds.has(note.id)))
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify({ version: 1, notes: next }))
  },
}
