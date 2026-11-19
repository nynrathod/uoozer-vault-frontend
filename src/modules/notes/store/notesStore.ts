import { create } from 'zustand'
import { NOTES_ACTIVE_KEY, NOTE_SAVE_DELAY_MS } from '../constants'
import { emptyDocument, plainTextFromDoc, visibleNotes } from '../document'
import { localNotesRepository, type NotesRepository } from '../persistence/localNotesRepository'
import { summarizeLocally } from '../summarize'
import type { AssistantScope, AssistantState, NoteRecord, NoteTint, SaveStatus } from '../types'
import type { JSONContent } from '@tiptap/core'

interface NotesState {
  notes: NoteRecord[]
  activeNoteId: string | null
  tagFilter: string | null
  dirtyIds: string[]
  pendingDeletes: string[]
  hydrated: boolean
  saveStatus: SaveStatus
  saveError: string | null
  loadError: string | null
  lastSavedAt: string | null
  focusMode: boolean
  assistant: AssistantState
  setActive: (id: string | null) => void
  setTagFilter: (tag: string | null) => void
  setFocusMode: (open: boolean) => void
  createNote: () => string
  setTitle: (id: string, title: string) => void
  setTags: (id: string, tags: string[]) => void
  setContent: (id: string, content: JSONContent) => void
  toggleStar: (id: string) => void
  togglePin: (id: string) => void
  setTint: (id: string, tint: NoteTint | null) => void
  trashNote: (id: string, view: NotesViewName) => void
  restoreNote: (id: string) => void
  deleteForever: (id: string) => void
  openAssistant: (input?: { scope?: AssistantScope; text?: string; prompt?: string }) => void
  closeAssistant: () => void
  setAssistantPrompt: (prompt: string) => void
  runAssistant: () => Promise<void>
  tryAssistantAgain: () => void
}

type NotesViewName = 'all' | 'starred' | 'pinned' | 'trash'

/** Step used when reindexing the manual order so future inserts have room. */
const ORDER_STEP = 10

/**
 * Persistence seam. The store only ever talks to this reference; swap it with
 * setNotesRepository() when the API adapter lands.
 */
let repository: NotesRepository = localNotesRepository

/** Replaces the persistence adapter (used by the future backend integration). */
export function setNotesRepository(next: NotesRepository) {
  repository = next
}

const closedAssistant: AssistantState = {
  open: false,
  prompt: 'Summarize this note in three bullets',
  scope: 'note',
  sourceText: '',
  bullets: null,
  error: null,
  status: 'idle',
  spin: 0,
}

function readActive(notes: NoteRecord[]): string | null {
  try {
    const stored = sessionStorage.getItem(NOTES_ACTIVE_KEY)
    if (stored && notes.some((note) => note.id === stored)) return stored
  } catch {
    /* session storage can be blocked */
  }
  return notes.find((note) => !note.trashed)?.id ?? null
}

function rememberActive(id: string | null) {
  try {
    if (id) sessionStorage.setItem(NOTES_ACTIVE_KEY, id)
    else sessionStorage.removeItem(NOTES_ACTIVE_KEY)
  } catch {
    /* ignore */
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false

function schedulePersist() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void flushNotes()
  }, NOTE_SAVE_DELAY_MS)
}

/**
 * Persists every pending change. Debounced by schedulePersist(); also called
 * directly on unload, tab hide and unmount. The repository call starts
 * synchronously, so a synchronous adapter (localStorage) completes before
 * this function returns even though it is awaitable.
 */
export async function flushNotes(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const state = useNotesStore.getState()
  if (flushing) {
    if (state.dirtyIds.length > 0 || state.pendingDeletes.length > 0) schedulePersist()
    return
  }
  if (state.dirtyIds.length === 0 && state.pendingDeletes.length === 0) {
    if (state.saveStatus === 'saving') useNotesStore.setState({ saveStatus: 'saved' })
    return
  }

  flushing = true
  const dirty = new Set(state.dirtyIds)
  const changed = state.notes
    .filter((note) => dirty.has(note.id))
    .map((note) => ({ ...note, revision: note.revision + 1 }))
  const changedById = new Map(changed.map((note) => [note.id, note]))
  const notes = state.notes.map((note) => changedById.get(note.id) ?? note)
  const removed = [...state.pendingDeletes]

  useNotesStore.setState({
    notes,
    dirtyIds: [],
    pendingDeletes: [],
    saveStatus: 'saving',
  })

  try {
    await repository.persist(changed, removed, notes)
    useNotesStore.setState({
      saveStatus: 'saved',
      saveError: null,
      lastSavedAt: new Date().toISOString(),
    })
  } catch (error) {
    const quota = error instanceof DOMException && error.name === 'QuotaExceededError'
    useNotesStore.setState({
      // Re-queue so the next edit (or Retry save) retries the whole batch.
      dirtyIds: [...new Set([...useNotesStore.getState().dirtyIds, ...changed.map((note) => note.id)])],
      pendingDeletes: [...new Set([...useNotesStore.getState().pendingDeletes, ...removed])],
      saveStatus: 'error',
      saveError: quota
        ? 'This browser is out of space for notes. Remove a large image and try again.'
        : 'Notes could not be saved on this device.',
    })
  } finally {
    flushing = false
    const after = useNotesStore.getState()
    if (after.dirtyIds.length > 0 || after.pendingDeletes.length > 0) schedulePersist()
  }
}

function markDirty(
  notes: NoteRecord[],
  id: string,
  dirtyIds: string[],
  patch: (note: NoteRecord) => NoteRecord
) {
  return {
    notes: notes.map((note) => (note.id === id ? patch(note) : note)),
    dirtyIds: dirtyIds.includes(id) ? dirtyIds : [...dirtyIds, id],
    saveStatus: 'saving' as const,
    saveError: null,
  }
}

/**
 * Bootstrap. Synchronous caches seed the store before first paint; async
 * adapters hydrate right after mount with the `hydrated` flag flipped.
 */
const seeded = repository.loadSync?.() ?? { notes: [], error: null }

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: seeded.notes,
  activeNoteId: readActive(seeded.notes),
  tagFilter: null,
  dirtyIds: [],
  pendingDeletes: [],
  hydrated: repository.loadSync !== undefined,
  saveStatus: 'saved',
  saveError: null,
  loadError: seeded.error,
  lastSavedAt: null,
  focusMode: false,
  assistant: closedAssistant,

  setActive: (id) => {
    rememberActive(id)
    set({ activeNoteId: id })
  },
  setTagFilter: (tag) => set({ tagFilter: tag }),
  setFocusMode: (focusMode) => set({ focusMode }),

  createNote: () => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const state = get()
    // New notes land at the very top of the list.
    const topOrder = state.notes.reduce((min, note) => Math.min(min, note.order), 0) - ORDER_STEP
    const note: NoteRecord = {
      id,
      title: 'Untitled',
      tags: [],
      starred: false,
      pinned: false,
      trashed: false,
      folderId: null,
      order: topOrder,
      content: emptyDocument(),
      plainText: '',
      createdAt: now,
      updatedAt: now,
      revision: 0,
      sealed: null,
      tint: null,
    }
    const nextNotes = [note, ...state.notes]
    rememberActive(id)
    // markDirty already returns `notes` (identity patch → same order); a
    // separate key here was dead weight TS flagged as a duplicate.
    set({
      activeNoteId: id,
      tagFilter: null,
      focusMode: false,
      ...markDirty(nextNotes, id, state.dirtyIds, (item) => item),
    })
    schedulePersist()
    return id
  },

  setTitle: (id, title) => {
    const state = get()
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        title,
        updatedAt: new Date().toISOString(),
      }))
    )
    schedulePersist()
  },

  setTags: (id, tags) => {
    const state = get()
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        tags,
        updatedAt: new Date().toISOString(),
      }))
    )
    schedulePersist()
  },

  setContent: (id, content) => {
    const current = get().notes.find((note) => note.id === id)
    if (!current) return
    const plainText = plainTextFromDoc(content)
    if (
      plainText === current.plainText &&
      JSON.stringify(content) === JSON.stringify(current.content)
    ) {
      return
    }
    const state = get()
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        content,
        plainText,
        updatedAt: new Date().toISOString(),
      }))
    )
    schedulePersist()
  },

  toggleStar: (id) => {
    const state = get()
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        starred: !note.starred,
        updatedAt: new Date().toISOString(),
      }))
    )
    schedulePersist()
  },

  togglePin: (id) => {
    const state = get()
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        pinned: !note.pinned,
        updatedAt: new Date().toISOString(),
      }))
    )
    schedulePersist()
  },

  setTint: (id, tint) => {
    const state = get()
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        tint,
        updatedAt: new Date().toISOString(),
      }))
    )
    schedulePersist()
  },

  trashNote: (id, view) => {
    const state = get()
    const nextNotes = state.notes.map((note) =>
      note.id === id
        ? { ...note, trashed: true, pinned: false, updatedAt: new Date().toISOString() }
        : note
    )
    const nextActive =
      state.activeNoteId === id
        ? (visibleNotes(nextNotes, view, state.tagFilter, '')[0]?.id ?? null)
        : state.activeNoteId
    rememberActive(nextActive)
    set({
      ...markDirty(nextNotes, id, state.dirtyIds, (note) => note),
      activeNoteId: nextActive,
    })
    schedulePersist()
  },

  restoreNote: (id) => {
    const state = get()
    const topOrder = state.notes.reduce((min, note) => Math.min(min, note.order), 0) - ORDER_STEP
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        trashed: false,
        order: topOrder,
        updatedAt: new Date().toISOString(),
      }))
    )
    schedulePersist()
  },

  deleteForever: (id) => {
    const state = get()
    const notes = state.notes.filter((note) => note.id !== id)
    const activeNoteId =
      state.activeNoteId === id
        ? (notes.find((note) => note.trashed)?.id ?? null)
        : state.activeNoteId
    rememberActive(activeNoteId)
    set({
      notes,
      activeNoteId,
      dirtyIds: state.dirtyIds.filter((item) => item !== id),
      pendingDeletes: [...new Set([...state.pendingDeletes, id])],
      saveStatus: 'saving',
    })
    void flushNotes()
  },

  openAssistant: (input) => {
    const state = get()
    const note = state.notes.find((item) => item.id === state.activeNoteId)
    const text = input?.text?.trim() || note?.plainText || ''
    const scope = input?.scope ?? (input?.text?.trim() ? 'selection' : 'note')
    const prompt =
      input?.prompt ??
      (scope === 'selection'
        ? 'Summarize this selection in three bullets'
        : 'Summarize this note in three bullets')
    set({
      assistant: {
        open: true,
        prompt,
        scope,
        sourceText: text,
        bullets: null,
        error: null,
        status: 'idle',
        spin: 0,
      },
    })
    void get().runAssistant()
  },

  closeAssistant: () => set({ assistant: { ...get().assistant, open: false, status: 'idle' } }),

  setAssistantPrompt: (prompt) => set({ assistant: { ...get().assistant, prompt } }),

  runAssistant: async () => {
    const spin = get().assistant.spin
    const { sourceText, prompt, open } = get().assistant
    if (!open) return
    set({ assistant: { ...get().assistant, status: 'running', error: null } })
    await new Promise((resolve) => setTimeout(resolve, 140))
    if (!get().assistant.open || get().assistant.spin !== spin) return
    try {
      const bullets = summarizeLocally(sourceText, prompt, spin)
      if (get().assistant.spin !== spin) return
      set({ assistant: { ...get().assistant, bullets, status: 'ready', error: null } })
    } catch (error) {
      set({
        assistant: {
          ...get().assistant,
          bullets: null,
          status: 'error',
          error: error instanceof Error ? error.message : 'Could not write a summary.',
        },
      })
    }
  },

  tryAssistantAgain: () => {
    set({ assistant: { ...get().assistant, spin: get().assistant.spin + 1 } })
    void get().runAssistant()
  },
}))

// Async bootstrap for repositories without a synchronous cache.
if (repository.loadSync === undefined) {
  void (async () => {
    const loaded = await repository.load()
    const state = useNotesStore.getState()
    if (state.hydrated) return
    useNotesStore.setState({
      notes: loaded.notes,
      activeNoteId: readActive(loaded.notes),
      loadError: loaded.error,
      hydrated: true,
    })
  })()
}
