/** Available theme preference values. */
export type Theme = 'light' | 'dark' | 'system'

/** Theme storage key and defaults used at app bootstrap. */
export const THEME_CONFIG = {
  storageKey: 'vault:theme',
  default: 'system' as Theme,
  themes: ['light', 'dark', 'system'] as Theme[],
} as const

/** Returns the OS-level color scheme preference, defaulting to 'dark' in SSR. */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Resolves a theme value to a concrete 'light' or 'dark' string. */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return getSystemTheme()
  return theme
}
