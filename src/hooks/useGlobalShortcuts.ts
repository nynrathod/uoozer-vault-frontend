import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@stores/uiStore'
import { useNotesStore } from '@/modules/notes/store/notesStore'
import { useVaultLock } from '@hooks/useVaultLock'
import { ROUTES } from '@lib/constants'

/**
 * Global keyboard shortcuts (Components sheet · Keyboard):
 * "Everything is reachable without a mouse. ⌘ becomes Ctrl on Windows."
 *
 * Registered here — and working:
 *   ⌘K   Search             (opens the search overlay)
 *   ⌘N   New note           (creates a real note and opens Notes)
 *   ⌘⇧F  Focus mode         (enters the real notes focus mode)
 *   ⌘/   All shortcuts      (opens the shortcuts dialog)
 *   ⌘⇧L  Lock now           (wipes device keys, requires the password again)
 *   Esc  Close or exit      (closes the open overlay)
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate()
  const lockVault = useVaultLock()

  useEffect(() => {
    const isMod = (e: KeyboardEvent) => e.metaKey || e.ctrlKey

    const onKeyDown = (e: KeyboardEvent) => {
      const ui = useUIStore.getState()

      // Esc — close or exit
      if (e.key === 'Escape') {
        if (ui.searchOpen) {
          e.preventDefault()
          ui.setSearchOpen(false)
        } else if (ui.shortcutsOpen) {
          e.preventDefault()
          ui.setShortcutsOpen(false)
        }
        return
      }

      if (!isMod(e)) return

      const key = e.key.toLowerCase()

      // ⌘K — search
      if (key === 'k') {
        e.preventDefault()
        ui.setSearchOpen(true)
        return
      }

      // ⌘/ — all shortcuts
      if (e.key === '/') {
        e.preventDefault()
        ui.setShortcutsOpen(true)
        return
      }

      // ⌘⇧L — lock now
      if (e.shiftKey && key === 'l') {
        e.preventDefault()
        void lockVault()
        return
      }

      // ⌘⇧F — focus mode (notes)
      if (e.shiftKey && key === 'f') {
        e.preventDefault()
        navigate(ROUTES.NOTES)
        useNotesStore.getState().setFocusMode(true)
        return
      }

      // ⌘N — new note
      if (!e.shiftKey && key === 'n') {
        e.preventDefault()
        useNotesStore.getState().createNote()
        navigate(ROUTES.NOTES)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, lockVault])
}
