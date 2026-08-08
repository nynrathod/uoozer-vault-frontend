import { useEffect, useState, useCallback } from 'react'

type ThemeVariant = 'default' | 'uoozer' | 'obsidian' | 'slate' | 'forest'
type ColorScheme = 'light' | 'dark' | 'system'

interface ThemeState {
  variant: ThemeVariant
  scheme: ColorScheme
  resolvedTheme: 'light' | 'dark'
}

const STORAGE_KEY = 'uoozer-theme'

function getInitialState(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        variant: parsed.variant || 'default',
        scheme: parsed.scheme || 'system',
        resolvedTheme: 'light',
      }
    }
  } catch {}
  return { variant: 'default', scheme: 'system', resolvedTheme: 'light' }
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(state: ThemeState) {
  const html = document.documentElement
  const resolved = state.scheme === 'system' ? getSystemTheme() : state.scheme

  /* Flicker fix: disable transitions during theme change */
  html.classList.add('theme-switching')

  html.setAttribute('data-theme', state.variant)

  if (resolved === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }

  /* Re-enable transitions after paint */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      html.classList.remove('theme-switching')
    })
  })

  return { ...state, resolvedTheme: resolved }
}

export function useTheme() {
  const [state, setState] = useState<ThemeState>(getInitialState)

  useEffect(() => {
    const applied = applyTheme(state)
    setState(applied)

    const listener = () => {
      if (state.scheme === 'system') {
        setState((prev) => {
          const updated = applyTheme({ ...prev, scheme: 'system' })
          return updated
        })
      }
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setVariant = useCallback((variant: ThemeVariant) => {
    setState((prev) => {
      const next = { ...prev, variant }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ variant: next.variant, scheme: next.scheme })
      )
      return applyTheme(next)
    })
  }, [])

  const setScheme = useCallback((scheme: ColorScheme) => {
    setState((prev) => {
      const next = { ...prev, scheme }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ variant: next.variant, scheme: next.scheme })
      )
      return applyTheme(next)
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setState((prev) => {
      const nextScheme = prev.resolvedTheme === 'dark' ? 'light' : 'dark'
      const next = { ...prev, scheme: nextScheme as ColorScheme }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ variant: next.variant, scheme: next.scheme })
      )
      return applyTheme(next)
    })
  }, [])

  return {
    variant: state.variant,
    scheme: state.scheme,
    resolvedTheme: state.resolvedTheme,
    setVariant,
    setScheme,
    toggleTheme,
  }
}
