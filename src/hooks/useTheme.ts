import { useEffect, useState, useCallback } from 'react'

type ThemeVariant = 'default' | 'uoozer' | 'obsidian' | 'slate' | 'forest'
type ColorScheme = 'light' | 'dark' | 'system'

interface ThemeState {
  variant: ThemeVariant
  scheme: ColorScheme
  resolvedTheme: 'light' | 'dark'
}

const STORAGE_KEY = 'uoozer-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialState(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const scheme = parsed.scheme || 'system'
      const variant = parsed.variant || 'default'
      // The index.html script already applied this to the DOM,
      // so we just sync our React state to match the DOM.
      const resolvedTheme = scheme === 'system' ? getSystemTheme() : scheme
      return { variant, scheme, resolvedTheme }
    }
  } catch {}
  return { variant: 'default', scheme: 'system', resolvedTheme: getSystemTheme() }
}

function applyThemeToDOM(state: ThemeState, disableTransitions: boolean) {
  const html = document.documentElement
  const resolved = state.scheme === 'system' ? getSystemTheme() : state.scheme

  if (disableTransitions) {
    html.classList.add('theme-switching')
  }

  html.setAttribute('data-theme', state.variant)

  if (resolved === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }

  if (disableTransitions) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        html.classList.remove('theme-switching')
      })
    })
  }

  return { ...state, resolvedTheme: resolved }
}

export function useTheme() {
  const [state, setState] = useState<ThemeState>(getInitialState)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')

    const listener = () => {
      setState((prev) => {
        if (prev.scheme !== 'system') return prev
        return applyThemeToDOM({ ...prev, scheme: 'system' }, false)
      })
    }

    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  const setVariant = useCallback((variant: ThemeVariant) => {
    setState((prev) => {
      const next = { ...prev, variant }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ variant: next.variant, scheme: next.scheme })
      )
      // Only disable transitions on explicit user click
      return applyThemeToDOM(next, true)
    })
  }, [])

  const setScheme = useCallback((scheme: ColorScheme) => {
    setState((prev) => {
      const next = { ...prev, scheme }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ variant: next.variant, scheme: next.scheme })
      )
      return applyThemeToDOM(next, true)
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
      return applyThemeToDOM(next, true)
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
