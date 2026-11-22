import { NOTES_STORAGE_KEY } from '../constants'
import { demoTourNotes, seedNotes } from '../data/seedNotes'
import {
  emptyDocument,
  plainTextFromDoc,
  prepareNotesForStorage,
  withStableOrder,
} from '../utils/document'
import { coercePageStyle, isNoteTint } from '../validation'
import { migrateTint, type LegacyNoteRecord, type NoteRecord, type SealedNoteBlob } from '../types'
import type { JSONContent } from '@tiptap/core'
import type { NotesLoadResult, NotesRepository } from './noteRepository'

const UNREADABLE_COPY =
  'Saved notes could not be read. Showing the sample workspace. Editing replaces the unreadable copy on this device.'

function asSealed(value: unknown): SealedNoteBlob | null {
  if (!value || typeof value !== 'object') return null
  const blob = value as Partial<SealedNoteBlob>
  if (blob.version === 1 && typeof blob.ciphertext === 'string' && typeof blob.nonce === 'string') {
    return {
      version: 1,
      algorithm: 'xchacha20-poly1305',
      ciphertext: blob.ciphertext,
      nonce: blob.nonce,
    }
  }
  return null
}

function asRecord(value: unknown): NoteRecord | null {
  if (!value || typeof value !== 'object') return null
  // Raw stored JSON — including pre-page-style records that carry `tint`.
  const note = value as LegacyNoteRecord
  if (typeof note.id !== 'string' || typeof note.title !== 'string') return null
  const content = (note.content ?? emptyDocument()) as JSONContent
  if (content.type !== 'doc') return null

  // Page style: modern records carry it; legacy records only carry `tint`
  // (or nothing). coercePageStyle already falls back to defaults, then the
  // tint migration only applies when no explicit background was stored.
  const pageStyle = coercePageStyle(note.pageStyle)
  const migrated: NoteRecord['pageStyle'] =
    pageStyle.background === 'default' && isNoteTint(note.tint)
      ? { ...pageStyle, background: migrateTint(note.tint) }
      : pageStyle

  return {
    id: note.id,
    title: note.title,
    tags: Array.isArray(note.tags) ? note.tags.filter((tag) => typeof tag === 'string') : [],
    starred: Boolean(note.starred),
    pinned: Boolean(note.pinned),
    trashed: Boolean(note.trashed),
    parentNoteId: typeof note.parentNoteId === 'string' ? note.parentNoteId : null,
    icon: typeof note.icon === 'string' ? note.icon : null,
    folderId: typeof note.folderId === 'string' ? note.folderId : null,
    // NaN marks saved data from before manual ordering existed.
    order: typeof note.order === 'number' && Number.isFinite(note.order) ? note.order : Number.NaN,
    content,
    plainText: typeof note.plainText === 'string' ? note.plainText : plainTextFromDoc(content),
    createdAt: typeof note.createdAt === 'string' ? note.createdAt : new Date().toISOString(),
    updatedAt: typeof note.updatedAt === 'string' ? note.updatedAt : new Date().toISOString(),
    revision: typeof note.revision === 'number' ? note.revision : 0,
    sealed: asSealed(note.sealed),
    pageStyle: migrated,
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
        error: 'Saved notes were in an unknown format. ' + UNREADABLE_COPY,
      }
    }
    const notes = withStableOrder(
      parsed.notes.map(asRecord).filter((note): note is NoteRecord => note !== null)
    )
    return { notes: ensureDemoTour(notes), error: null }
  } catch {
    return { notes: seedNotes(), error: UNREADABLE_COPY }
  }
}

/**
 * DEMO TOUR MERGE — the "All modules demo" page must exist in EVERY
 * workspace, including browsers that saved notes before the tour shipped
 * (seeds fully load only when storage is empty, so a saved workspace would
 * never see the page). Adds any missing demo note without touching the
 * notes the user already has; the page is pinned, so it sits at the top of
 * the sidebar the moment the module loads. Deleting it stays possible — it
 * only reappears if the id is gone on a later load.
 */
function ensureDemoTour(notes: NoteRecord[]): NoteRecord[] {
  const present = new Set(notes.map((note) => note.id))
  const missing = demoTourNotes().filter((demo) => !present.has(demo.id))
  return missing.length === 0 ? notes : withStableOrder([...notes, ...missing])
}

export const localNoteRepository: NotesRepository = {
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
