export type NoteUiEvent = { type: 'emoji.open' } | { type: 'link.open' } | { type: 'style.open' }

const listeners = new Set<(event: NoteUiEvent) => void>()

export function emitUiEvent(event: NoteUiEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch {
      // A broken listener must never break the editor command that fired it.
    }
  })
}

/** Registers a listener; the returned function unregisters it. */
export function onUiEvent(listener: (event: NoteUiEvent) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
