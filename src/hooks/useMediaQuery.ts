import { useState, useEffect } from 'react'

/** Tracks whether a CSS media query currently matches. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

/** Convenience hook that returns true when the viewport is ≤ 768 px. */
export function useIsMobile() {
  return useMediaQuery('(max-width: 768px)')
}

/** Convenience hook that returns true when the viewport is ≤ 1024 px. */
export function useIsTablet() {
  return useMediaQuery('(max-width: 1024px)')
}
