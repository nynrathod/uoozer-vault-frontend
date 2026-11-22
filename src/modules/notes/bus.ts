export type NoteUiEvent =
  | { type: 'assistant.open'; text?: string; prompt?: string }
  | { type: 'notify'; tone: 'error' | 'info'; message: string }
  | { type: 'note.open'; noteId?: string; label?: string }

type Listener = (event: NoteUiEvent) => void

const listeners = new Set<Listener>()

export const noteUiBus = {
  emit(event: NoteUiEvent) {
    listeners.forEach((listener) => listener(event))
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
