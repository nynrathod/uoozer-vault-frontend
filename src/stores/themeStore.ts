import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Theme, THEME_CONFIG, resolveTheme } from '@config/theme'

interface ThemeState {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

/** Persists the user's theme preference and syncs the `dark`/`light` class on `<html>`. */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: THEME_CONFIG.default,
      resolvedTheme: resolveTheme(THEME_CONFIG.default),
      setTheme: (theme) => {
        const resolved = resolveTheme(theme)
        set({ theme, resolvedTheme: resolved })
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(resolved)
      },
      toggleTheme: () => {
        const current = get().resolvedTheme
        const next = current === 'light' ? 'dark' : 'light'
        get().setTheme(next)
      },
    }),
    {
      name: THEME_CONFIG.storageKey,
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.theme)
          document.documentElement.classList.remove('light', 'dark')
          document.documentElement.classList.add(resolved)
        }
      },
    }
  )
)