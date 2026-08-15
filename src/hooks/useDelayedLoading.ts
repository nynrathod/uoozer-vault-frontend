import { useState, useEffect } from 'react'

/**
 * Delays showing a loading state (like a skeleton) to prevent flashing
 * on fast networks. Only returns true if loading takes longer than the delay.
 */
export function useDelayedLoading(isLoading: boolean, delay: number = 300): boolean {
  const [isDelayedLoading, setIsDelayedLoading] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    if (isLoading) {
      // Start a timer. Only show skeleton if loading takes longer than `delay`
      timer = setTimeout(() => {
        setIsDelayedLoading(true)
      }, delay)
    } else {
      // If loading finishes, immediately hide skeleton
      setIsDelayedLoading(false)
    }

    return () => clearTimeout(timer)
  }, [isLoading, delay])

  return isDelayedLoading
}
