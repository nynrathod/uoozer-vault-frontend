import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { authService } from '@services/auth/authService'
import { useAuthStore } from '@stores/authStore'
import { tokenManager } from '@services/auth/tokenManager'
import { ROUTES } from '@lib/constants'
import { base64ToBytes, unwrapDek, zeroize } from '@lib/crypto'
import { AuthError, AUTH_ERROR_CODES } from '@/services/auth/error'
import type { LoginCredentials, SignupCredentials } from '@/types/auth'

export function useAuth() {
  const navigate = useNavigate()
  const {
    user,
    isAuthenticated,
    isCryptoReady,
    isLoading,
    setUser,
    setAuthenticated,
    setCryptoState,
    setLoading,
    logout: storeLogout,
  } = useAuthStore()

  const [loginError, setLoginError] = useState<string | null>(null)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    let mounted = true

    const restoreSession = async () => {
      setLoading(true)
      try {
        const restored = await authService.tryRestoreSession()
        if (mounted) {
          setAuthenticated(restored)
          if (restored) {
            const email = tokenManager.getUserEmail()
            if (email) {
              setUser({ id: '', email, createdAt: '', updatedAt: '' })
            }
          }
        }
      } catch {
        if (mounted) setAuthenticated(false)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    restoreSession()

    return () => {
      mounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setLoginError(null)
      setIsLoggingIn(true)

      try {
        console.log('1. Starting login...')

        const result = await authService.login(credentials)
        console.log('2. Login successful', {
          hasMasterKey: !!result.masterKey,
        })

        console.log('3. Setting crypto state...')
        setCryptoState({
          masterKey: result.masterKey,
          dek: null,
        })
        console.log('4. Crypto state set')

        console.log('5. Getting wrapped DEK...')
        const wrappedDekData = await tokenManager.getWrappedDek()
        console.log('6. Wrapped DEK data:', wrappedDekData)

        if (wrappedDekData) {
          console.log('7. Converting wrapped DEK from Base64...')

          const ciphertextBytes = await base64ToBytes(wrappedDekData.wrappedDek)
          console.log('8. Ciphertext converted', {
            length: ciphertextBytes.length,
          })

          const nonceBytes = await base64ToBytes(wrappedDekData.nonce)
          console.log('9. Nonce converted', {
            length: nonceBytes.length,
          })

          const wrappedDek = {
            ciphertext: ciphertextBytes,
            nonce: nonceBytes,
          }
          console.log('10. Wrapped DEK object created')

          console.log('11. Unwrapping DEK...')
          const dek = await unwrapDek(wrappedDek, result.masterKey)
          console.log('12. unwrapDek result:', dek)

          if (!dek) {
            console.error('13. unwrapDek returned null')

            await zeroize(result.masterKey)
            console.log('14. Master key zeroized')

            throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, 401, {
              message: 'Failed to decrypt vault. Please check your password.',
            })
          }

          console.log('15. Setting DEK in auth store...')
          useAuthStore.getState().setDek(dek)
          console.log('16. DEK stored successfully')
        } else {
          console.warn('No wrapped DEK found')
        }
      } catch (error) {
        console.error('Login API Error:', error) // <-- ADD THIS
        const message = error instanceof AuthError ? error.message : 'Login failed'
        setLoginError(message)
        toast.error(message)
        throw error
      } finally {
        setIsLoggingIn(false)
      }
    },
    [navigate, setAuthenticated, setCryptoState, setUser]
  )

  const signup = useCallback(
    async (credentials: SignupCredentials) => {
      setSignupError(null)
      setIsSigningUp(true)

      try {
        const result = await authService.signup(credentials)

        setCryptoState({
          masterKey: result.cryptoBundle.masterKey,
          dek: result.cryptoBundle.dek,
        })

        setUser({ id: '', email: credentials.email, createdAt: '', updatedAt: '' })
        setAuthenticated(true)
        toast.success('Vault created successfully!')

        return {
          recoveryKey: result.recoveryKeyDisplay,
          cryptoBundle: result.cryptoBundle,
        }
      } catch (error) {
        const message = error instanceof AuthError ? error.message : 'Signup failed'
        setSignupError(message)
        toast.error(message)
        throw error
      } finally {
        setIsSigningUp(false)
      }
    },
    [setAuthenticated, setCryptoState, setUser]
  )

  const logout = useCallback(async () => {
    setIsLoggingOut(true)
    try {
      await authService.logout(false)
      await storeLogout()
      toast.success('Signed out successfully')
      navigate(ROUTES.LOGIN)
    } catch {
      await storeLogout()
      navigate(ROUTES.LOGIN)
    } finally {
      setIsLoggingOut(false)
    }
  }, [navigate, storeLogout])

  return {
    user,
    isAuthenticated,
    isCryptoReady,
    isLoading: isLoading || isLoggingIn || isSigningUp,
    isLoggingIn,
    isSigningUp,
    isLoggingOut,
    loginError,
    signupError,

    login,
    signup,
    logout,

    clearLoginError: () => setLoginError(null),
    clearSignupError: () => setSignupError(null),
  }
}
