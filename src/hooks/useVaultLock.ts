import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionLock } from '@services/auth/tokenManager'
import { useAuthStore } from '@stores/authStore'
import { ROUTES } from '@lib/constants'

/**
 * Locks the vault without signing out.
 *
 * `sessionLock.lock()` wipes the device key and every wrapped DEK from
 * IndexedDB, so the vault cannot be decrypted on this device again until the
 * password is re-entered (keys are derived on this device — we cannot reset
 * what we cannot read). We then drop the in-memory DEK and the session flag
 * and send the user to the login screen.
 */
export function useVaultLock() {
  const navigate = useNavigate()

  return useCallback(async () => {
    await sessionLock.lock()
    try {
      localStorage.removeItem('vault:has_session')
    } catch {
      /* storage may be unavailable */
    }
    const auth = useAuthStore.getState()
    auth.setDek(null)
    auth.setCryptoReady(false)
    auth.setAuthenticated(false)
    navigate(ROUTES.LOGIN, { replace: true })
  }, [navigate])
}
