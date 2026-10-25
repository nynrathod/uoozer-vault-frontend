import { useEffect } from 'react'
import { sessionLock } from '@services/auth/tokenManager'

/** Mount once inside the authenticated App shell. */
export function useSessionLock() {
  useEffect(() => {
    sessionLock.enforceOnBoot()
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'focus']
    let last = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - last > 60_000) {
        last = now
        sessionLock.touch()
      }
    }
    events.forEach((e) => window.addEventListener(e, onActivity))
    return () => events.forEach((e) => window.removeEventListener(e, onActivity))
  }, [])
}
