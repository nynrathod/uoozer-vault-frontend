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

/** Background tints a note page can wear. Null keeps the default editor look. */
export type NoteTint = 'gray' | 'amber' | 'green' | 'blue' | 'purple' | 'pink' | 'red'

/** Swatch order for the note color picker (values live in index.css). */
export const NOTE_TINTS: NoteTint[] = ['gray', 'amber', 'green', 'blue', 'purple', 'pink', 'red']

/**
 * One note. `folderId` is reserved for a future link into the vault.
 * `order` is a stable list position (smaller floats to the top); new and
 * restored notes take the top slot. Pinned notes always render above the rest.
 * `revision` increments on every persisted change and doubles as the
 * optimistic-concurrency token for the future API adapter.
 * `sealed` holds the encrypted envelope once the notes cipher is active;
 * until then it stays null and the record lives only on this device.
 * `tint` paints the note page with one of the Keep-style background colors.
 */
export interface NoteRecord {
  id: string
  title: string
  tags: string[]
  starred: boolean
  pinned: boolean
  trashed: boolean
  folderId: string | null
  order: number
  content: JSONContent
  plainText: string
  createdAt: string
  updatedAt: string
  revision: number
  sealed: SealedNoteBlob | null
  tint?: NoteTint | null
}

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
