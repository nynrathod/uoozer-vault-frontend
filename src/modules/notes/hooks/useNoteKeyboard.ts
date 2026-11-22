import { useEffect } from 'react'
import { useNotesStore } from '../store/notesStore'

export function useNoteKeyboard() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const state = useNotesStore.getState()
      if (state.assistant.open) {
        state.closeAssistant()
        return
      }
      if (state.focusMode) state.setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
