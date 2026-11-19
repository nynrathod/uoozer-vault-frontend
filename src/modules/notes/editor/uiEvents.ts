/**
 * Tiny typed event pipe between editor extensions (which own no React tree)
 * and overlay components mounted inside NoteEditorProvider (which do).
 *
 * Example: the slash menu's "Emoji" command runs deep inside the editor
 * module registry and cannot render UI itself — it emits 'emoji.open' and
 * the EmojiPicker component listens for it and pops open at the caret.
 */

export type NoteUiEvent = { type: 'emoji.open' }

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
