export type NoteUiEvent =
  | { type: 'assistant.open'; text?: string }
  | { type: 'notify'; tone: 'error' | 'info'; message: string }

type Listener = (event: NoteUiEvent) => void

const listeners = new Set<Listener>()

/** Editor modules talk to the page through this bus, so nodes never import the store. */
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
