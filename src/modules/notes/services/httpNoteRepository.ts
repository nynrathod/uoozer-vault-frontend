import { apiClient } from '@services/api/client'
import { emptyDocument, plainTextFromDoc, withStableOrder } from '../utils/document'
import { coercePageStyle } from '../validation'
import { noteCipher } from '../encryption/noteCipherPort'
import type { NoteRecord } from '../types'
import type { NotesLoadResult, NotesRepository } from './noteRepository'

interface NoteEnvelope {
  id: string
  sealed: NoteRecord['sealed']
  folderId: string | null
  parentNoteId: string | null
  order: number
  starred: boolean
  pinned: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
  revision: number
}

interface BatchRequest {
  changed: NoteEnvelope[]
  removed: string[]
}

/** Local, non-encrypted companion cache so offline edits still boot fast. */
const MIRROR_KEY = 'uoozer.notes.mirror.v1'

/** Builds the envelope for a note: seal the private parts, keep the rest. */
async function toEnvelope(note: NoteRecord): Promise<NoteEnvelope> {
  const sealed = await noteCipher.seal({
    id: note.id,
    title: note.title,
    tags: note.tags,
    plainText: note.plainText,
    content: note.content,
    pageStyle: note.pageStyle,
    parentNoteId: note.parentNoteId,
    icon: note.icon,
  })
  return {
    id: note.id,
    sealed,
    folderId: note.folderId,
    parentNoteId: note.parentNoteId,
    order: note.order,
    starred: note.starred,
    pinned: note.pinned,
    trashed: note.trashed,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    revision: note.revision,
  }
}

/** Unseal one envelope into a full record. Locked-vault notes fall back to
 *  an empty document rather than failing the whole load. */
async function fromEnvelope(envelope: NoteEnvelope): Promise<NoteRecord> {
  const base = {
    id: envelope.id,
    tags: [] as string[],
    title: 'Locked note',
    plainText: '',
    content: emptyDocument(),
    pageStyle: coercePageStyle(null),
    parentNoteId: envelope.parentNoteId,
    icon: null as string | null,
  }
  let opened = base
  if (envelope.sealed) {
    try {
      const plain = await noteCipher.open(envelope.sealed)
      opened = {
        ...base,
        title: plain.title,
        tags: plain.tags,
        plainText: plain.plainText,
        content: plain.content,
        pageStyle: coercePageStyle(plain.pageStyle),
        parentNoteId: plain.parentNoteId ?? envelope.parentNoteId,
        icon: plain.icon ?? null,
      }
    } catch {
      // Vault locked or key rotated — keep the locked placeholder.
    }
  }
  if (!opened.plainText && opened.content.type === 'doc') {
    opened = { ...opened, plainText: plainTextFromDoc(opened.content) }
  }
  return {
    ...opened,
    starred: envelope.starred,
    pinned: envelope.pinned,
    trashed: envelope.trashed,
    folderId: envelope.folderId,
    parentNoteId: opened.parentNoteId,
    icon: opened.icon,
    order: envelope.order,
    createdAt: envelope.createdAt,
    updatedAt: envelope.updatedAt,
    revision: envelope.revision,
    sealed: envelope.sealed,
  }
}

function readMirror(): NoteRecord[] {
  try {
    const raw = localStorage.getItem(MIRROR_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { notes?: unknown[] }
    const records = (parsed.notes ?? [])
      .map((value) => {
        if (!value || typeof value !== 'object') return null
        const note = value as Partial<NoteRecord>
        if (typeof note.id !== 'string' || typeof note.title !== 'string') return null
        const content = (note.content ?? emptyDocument()) as NoteRecord['content']
        if (content.type !== 'doc') return null
        return {
          ...note,
          tags: Array.isArray(note.tags) ? note.tags : [],
          starred: Boolean(note.starred),
          pinned: Boolean(note.pinned),
          trashed: Boolean(note.trashed),
          folderId: note.folderId ?? null,
          parentNoteId: typeof note.parentNoteId === 'string' ? note.parentNoteId : null,
          icon: typeof note.icon === 'string' ? note.icon : null,
          order: typeof note.order === 'number' ? note.order : Number.NaN,
          content,
          plainText:
            typeof note.plainText === 'string' ? note.plainText : plainTextFromDoc(content),
          createdAt: note.createdAt ?? new Date().toISOString(),
          updatedAt: note.updatedAt ?? new Date().toISOString(),
          revision: typeof note.revision === 'number' ? note.revision : 0,
          sealed: note.sealed ?? null,
          pageStyle: coercePageStyle(note.pageStyle),
        } as NoteRecord
      })
      .filter((note): note is NoteRecord => note !== null)
    return withStableOrder(records)
  } catch {
    return []
  }
}

function writeMirror(notes: NoteRecord[]) {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify({ version: 1, notes }))
  } catch {
    // The mirror is an optimization; quota issues must never surface.
  }
}

export const httpNoteRepository: NotesRepository = {
  async load(): Promise<NotesLoadResult> {
    try {
      const { data } = await apiClient.get<{ notes: NoteEnvelope[] }>('/api/v1/notes')
      const notes = withStableOrder(
        await Promise.all((data.notes ?? []).map((envelope) => fromEnvelope(envelope)))
      )
      writeMirror(notes)
      return { notes, error: null }
    } catch {
      // Offline / backend down: boot from the local mirror, if any.
      return {
        notes: readMirror(),
        error: 'Notes could not be reached. Showing the last copy saved on this device.',
      }
    }
  },

  async persist(changed, removed, snapshot) {
    if (changed.length === 0 && removed.length === 0) return
    const envelopes = await Promise.all(changed.map((note) => toEnvelope(note)))
    const body: BatchRequest = { changed: envelopes, removed }
    // A 409 (revision conflict) reloads the server state; the store
    // reconciles on the next load. Everything else surfaces as a save error.
    await apiClient.post('/api/v1/notes/batch', body)
    writeMirror(snapshot)
  },
}
