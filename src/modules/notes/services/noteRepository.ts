import type { NoteRecord } from '../types'

export interface NotesLoadResult {
  notes: NoteRecord[]
  error: string | null
}

export interface NotesRepository {
  /** Mirrors GET /notes. Adapters seal nothing — they return sealed
   *  envelopes and the store opens them with the notes cipher. */
  load(): Promise<NotesLoadResult>

  /** Optional fast path for synchronous caches. The localStorage adapter
   *  provides it so the first paint never waits; an HTTP adapter simply
   *  omits it and the store bootstraps asynchronously. */
  loadSync?(): NotesLoadResult

  /**
   * Mirrors a batch upsert + delete:
   *   · `changed`  — dirty records with their revision already bumped
   *   · `removed`  — permanent deletions (ids)
   *   · `snapshot` — the full in-memory state, for cache-first adapters
   *                 that want to write through
   */
  persist(changed: NoteRecord[], removed: string[], snapshot: NoteRecord[]): Promise<void>
}
