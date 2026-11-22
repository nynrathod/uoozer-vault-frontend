import { create } from 'zustand'
import type { JSONContent } from '@tiptap/core'
import { NOTES_ACTIVE_KEY, NOTE_SAVE_DELAY_MS, ORDER_STEP } from '../constants'
import { templateStarterDocument } from '../data/seedNotes'
import { localNoteRepository } from '../services/localNoteRepository'
import type { NotesRepository } from '../services/noteRepository'
import { summarizeLocally } from '../utils/summarize'
import { plainTextFromDoc, visibleNotes } from '../utils/document'
import {
  DEFAULT_PAGE_STYLE,
  type AssistantScope,
  type AssistantState,
  type NoteKind,
  type NoteRecord,
  type NoteTemplate,
  type NoteView,
  type PageStyle,
  type SaveStatus,
} from '../types'
import { kindBaseStyle } from '../data/pageStyles'

/* ============================================================================
 * NOTES STORE — the module's single state tree.
 * Actions only: no React, no DOM queries beyond the persistence seams
 * (sessionStorage key). UI state that must survive route changes
 * (focus mode, assistant) lives here; everything else stays local.
 * ==========================================================================*/

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
  /** Trash dialog (Notion pattern: Trash opens a dialog, not a second pane). */
  trashOpen: boolean

  setActive: (id: string | null) => void
  setTagFilter: (tag: string | null) => void
  setFocusMode: (open: boolean) => void
  setTrashOpen: (open: boolean) => void

  createNote: (template?: NoteTemplate, parentNoteId?: string | null) => string
  createChildNote: (parentNoteId: string) => string
  duplicateNote: (id: string) => void
  setNoteParent: (id: string, parentNoteId: string | null) => void
  setTitle: (id: string, title: string) => void
  setIcon: (id: string, icon: string | null) => void
  setTags: (id: string, tags: string[]) => void
  setContent: (id: string, content: JSONContent) => void
  toggleStar: (id: string) => void
  togglePin: (id: string) => void
  setNoteKind: (id: string, kind: NoteKind) => void
  setPageStyle: (id: string, patch: Partial<PageStyle>) => void
  trashNote: (id: string, view: NoteView) => void
  restoreNote: (id: string) => void
  deleteForever: (id: string) => void

  openAssistant: (input?: { scope?: AssistantScope; text?: string; prompt?: string }) => void
  closeAssistant: () => void
  setAssistantPrompt: (prompt: string) => void
  runAssistant: () => Promise<void>
  tryAssistantAgain: () => void
}

let repository: NotesRepository = localNoteRepository

/** Replaces the persistence adapter (used by the backend integration). */
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
      dirtyIds: [
        ...new Set([...useNotesStore.getState().dirtyIds, ...changed.map((note) => note.id)]),
      ],
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

/** Fresh note record from a template (Blank when omitted). */
function buildNote(
  template: NoteTemplate | undefined,
  topOrder: number,
  parentNoteId: string | null
): NoteRecord {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: template && template.id !== 'blank' ? template.label : 'Untitled',
    tags: [],
    starred: false,
    pinned: false,
    trashed: false,
    parentNoteId,
    icon: null,
    folderId: null,
    order: topOrder,
    content: templateStarterDocument(template ?? { ...DEFAULT_TEMPLATES_BLANK }),
    plainText: '',
    createdAt: now,
    updatedAt: now,
    revision: 0,
    sealed: null,
    pageStyle: template ? { ...template.pageStyle } : { ...DEFAULT_PAGE_STYLE },
  }
}

/** The Blank template, for callers that create without arguments. */
const DEFAULT_TEMPLATES_BLANK: NoteTemplate = {
  id: 'blank',
  label: 'Blank',
  description: '',
  pageStyle: DEFAULT_PAGE_STYLE,
  starter: 'blank',
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
  trashOpen: false,

  setActive: (id) => {
    rememberActive(id)
    set({ activeNoteId: id })
  },

  setTagFilter: (tag) => set({ tagFilter: tag }),

  setFocusMode: (focusMode) => set({ focusMode }),

  createNote: (template, parentNoteId = null) => {
    const state = get()
    // New notes land at the very top of the list.
    const topOrder = state.notes.reduce((min, note) => Math.min(min, note.order), 0) - ORDER_STEP
    const note = buildNote(template, topOrder, parentNoteId)
    const nextNotes = [note, ...state.notes]
    rememberActive(note.id)
    set({
      activeNoteId: note.id,
      tagFilter: null,
      focusMode: false,
      ...markDirty(nextNotes, note.id, state.dirtyIds, (item) => item),
    })
    schedulePersist()
    return note.id
  },

  createChildNote: (parentNoteId) => {
    const parent = get().notes.find((note) => note.id === parentNoteId)
    // A child page inherits its parent's look so the two read as one page.
    const template: NoteTemplate = {
      id: 'blank',
      label: 'Untitled',
      description: '',
      pageStyle: parent ? { ...parent.pageStyle } : { ...DEFAULT_PAGE_STYLE },
      starter: 'blank',
    }
    return get().createNote(template, parentNoteId)
  },

  /** Copy of one note right below the original (Notion's Duplicate). */
  duplicateNote: (id) => {
    const state = get()
    const source = state.notes.find((note) => note.id === id)
    if (!source) return
    const now = new Date().toISOString()
    const copy: NoteRecord = {
      ...source,
      id: crypto.randomUUID(),
      title: source.title ? `${source.title} copy` : 'Untitled',
      pinned: false,
      order: source.order - ORDER_STEP / 2,
      createdAt: now,
      updatedAt: now,
      revision: 0,
      sealed: null,
    }
    set(markDirty([copy, ...state.notes], copy.id, state.dirtyIds, (note) => note))
    schedulePersist()
  },

  /**
   * Moves a note under another parent (sidebar “Move”). Guarded: a note
   * can never move under itself or one of its own descendants.
   */
  setNoteParent: (id, parentNoteId) => {
    const state = get()
    if (parentNoteId === id) return
    if (parentNoteId) {
      // Walk the proposed parent's ancestry; hitting the moved note = cycle.
      let cursor: string | null = parentNoteId
      for (let guard = 0; cursor && guard < 100; guard += 1) {
        if (cursor === id) return
        cursor = state.notes.find((note) => note.id === cursor)?.parentNoteId ?? null
      }
    }
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        parentNoteId,
        updatedAt: new Date().toISOString(),
      }))
    )
    schedulePersist()
  },

  setIcon: (id, icon) => {
    const state = get()
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        icon,
        updatedAt: new Date().toISOString(),
      }))
    )
    schedulePersist()
  },

  setNoteKind: (id, kind) => {
    const state = get()
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        // Kind defaults fill the gaps; explicit user choices survive.
        pageStyle: { ...kindBaseStyle(kind), ...note.pageStyle, kind },
        updatedAt: new Date().toISOString(),
      }))
    )
    schedulePersist()
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

  setPageStyle: (id, patch) => {
    const state = get()
    set(
      markDirty(state.notes, id, state.dirtyIds, (note) => ({
        ...note,
        pageStyle: { ...note.pageStyle, ...patch },
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

  setTrashOpen: (trashOpen) => set({ trashOpen }),

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
