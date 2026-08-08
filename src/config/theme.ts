export type Theme = 'light' | 'dark' | 'system'

export const THEME_CONFIG = {
  storageKey: 'vault:theme',
  default: 'system' as Theme,
  themes: ['light', 'dark', 'system'] as Theme[],
} as const

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return getSystemTheme()
  return theme
}
