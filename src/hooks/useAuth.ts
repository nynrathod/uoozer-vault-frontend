import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { authService } from '@services/auth/authService'
import { useAuthStore } from '@stores/authStore'
import { tokenManager } from '@services/auth/tokenManager'
import { ROUTES } from '@lib/constants'
import {
  base64ToBytes,
  unwrapDek,
  zeroize,
  bytesToBase64,
  deriveKeysFromPassword,
  wrapDek,
  generateDek,
} from '@lib/crypto'
import { AuthError, AUTH_ERROR_CODES } from '@/services/auth/error'
import { hexToUint8Array } from '@lib/utils'
import type { LoginCredentials, SignupCredentials } from '@/types/auth'

/** Provides login, signup, recovery, unlock, and logout operations with crypto key management. */
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
    logout: storeLogout,
  } = useAuthStore()

  const [loginError, setLoginError] = useState<string | null>(null)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [isLoggingOut] = useState(false)

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setLoginError(null)
      setIsLoggingIn(true)

      try {
        const result = await authService.login(credentials)

        setCryptoState({ masterKey: result.masterKey, dek: null })

        const keys = await authService.getKeys()
        const wrappedDekData = {
          wrappedDek: keys.wrapped_dek,
          nonce: keys.wrapped_dek_nonce,
        }

        await tokenManager.setWrappedDek(wrappedDekData.wrappedDek, wrappedDekData.nonce)

        if (wrappedDekData && result.masterKey) {
          const ciphertextBytes = await base64ToBytes(wrappedDekData.wrappedDek)
          const nonceBytes = await base64ToBytes(wrappedDekData.nonce)

          const wrappedDek = { ciphertext: ciphertextBytes, nonce: nonceBytes }
          const dek = await unwrapDek(wrappedDek, result.masterKey)

          if (!dek) {
            await zeroize(result.masterKey)
            throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, 401, {
              message: 'Failed to decrypt vault. Please check your password.',
            })
          }

          useAuthStore.getState().setDek(dek)

          // Derive a device-local key so the DEK can be re-wrapped on future refreshes without re-prompting
          const deviceKey = await generateDek()
          const deviceWrappedDek = await wrapDek(dek, deviceKey)
          await tokenManager.setDeviceKey(await bytesToBase64(deviceKey))
          await tokenManager.setDeviceWrappedDek(
            await bytesToBase64(deviceWrappedDek.ciphertext),
            await bytesToBase64(deviceWrappedDek.nonce)
          )
        }

        setUser({
          id: '',
          email: credentials.email,
          fullName: result.tokens.full_name,
          createdAt: '',
          updatedAt: '',
        })
        setAuthenticated(true)
      } catch (error) {
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

  const signup = useCallback(async (credentials: SignupCredentials) => {
    setSignupError(null)
    setIsSigningUp(true)

    try {
      const result = await authService.signup(credentials)
      return {
        recoveryKey: result.recoveryKeyDisplay,
        cryptoBundle: result.cryptoBundle,
      }
    } catch (error) {
      throw error
    } finally {
      setIsSigningUp(false)
    }
  }, [])

  const completeSignup = useCallback(
    async (bundle: any, email: string, fullName: string) => {
      setCryptoState({ masterKey: bundle.masterKey, dek: bundle.dek })

      const deviceKey = await generateDek()
      const deviceWrappedDek = await wrapDek(bundle.dek, deviceKey)
      await tokenManager.setDeviceKey(await bytesToBase64(deviceKey))
      await tokenManager.setDeviceWrappedDek(
        await bytesToBase64(deviceWrappedDek.ciphertext),
        await bytesToBase64(deviceWrappedDek.nonce)
      )

      // Use the fullName parameter passed into the function
      setUser({
        id: '',
        email,
        fullName,
        createdAt: '',
        updatedAt: '',
      })
      setAuthenticated(true)
    },
    [setAuthenticated, setCryptoState, setUser]
  )

  const verifyRecoveryKey = useCallback(async (email: string, recoveryKeyDisplay: string) => {
    setSignupError(null)
    setIsSigningUp(true)

    try {
      await authService.ensureCryptoReady()
      const hexClean = recoveryKeyDisplay.replace(/-/g, '')
      const recoveryKey = hexToUint8Array(hexClean)

      const { dek, tokens } = await authService.verifyRecoveryKey(email, recoveryKey)

      setCryptoState({ masterKey: null, dek })
      useAuthStore.setState({ recoveryTokens: tokens })
    } finally {
      setIsSigningUp(false)
    }
  }, [])

  const completeRecovery = useCallback(
    async (email: string, newPassword: string) => {
      setIsSigningUp(true)
      setSignupError(null)

      try {
        await authService.ensureCryptoReady()

        const dek = useAuthStore.getState().cryptoState.dek
        const tokens = useAuthStore.getState().recoveryTokens
        if (!dek || !tokens) throw new Error('Session expired. Please start over.')

        const preloginResp = await authService.prelogin(email)

        const { masterKey: newMasterKey, dek: finalDek } = await authService.completeRecovery(
          email,
          newPassword,
          preloginResp.salt,
          preloginResp.argon2_params,
          dek,
          tokens
        )

        // Derive a device-local key so the DEK can be re-wrapped on future refreshes without re-prompting
        const deviceKey = await generateDek()
        const deviceWrappedDek = await wrapDek(finalDek, deviceKey)
        await tokenManager.setDeviceKey(await bytesToBase64(deviceKey))
        await tokenManager.setDeviceWrappedDek(
          await bytesToBase64(deviceWrappedDek.ciphertext),
          await bytesToBase64(deviceWrappedDek.nonce)
        )

        setCryptoState({ masterKey: newMasterKey, dek: finalDek })
        setUser({
          id: '',
          email,
          fullName: tokens.full_name || '',
          createdAt: '',
          updatedAt: '',
        })
        setAuthenticated(true)
        useAuthStore.setState({ isLoading: false, isInitializing: false })
      } finally {
        setIsSigningUp(false)
      }
    },
    [setCryptoState, setUser, setAuthenticated]
  )

  const unlock = useCallback(
    async (password: string) => {
      setIsLoggingIn(true)
      setLoginError(null)

      try {
        const email = tokenManager.getUserEmail()
        if (!email) throw new Error('Session expired. Please log in again.')

        await authService.ensureCryptoReady()
        const preloginResp = await authService.prelogin(email)
        const { masterKey } = await deriveKeysFromPassword(
          password,
          preloginResp.salt,
          preloginResp.argon2_params
        )

        const wrappedDekData = await tokenManager.getWrappedDek()
        if (!wrappedDekData) throw new Error('Encrypted keys not found. Please log in.')

        const wrappedDek = {
          ciphertext: await base64ToBytes(wrappedDekData.wrappedDek),
          nonce: await base64ToBytes(wrappedDekData.nonce),
        }
        const dek = await unwrapDek(wrappedDek, masterKey)

        if (!dek) {
          await zeroize(masterKey)
          throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, 401, {
            message: 'Failed to decrypt vault. Please check your password.',
          })
        }

        setCryptoState({ masterKey, dek })

        // Derive a device-local key so the DEK can be re-wrapped on future refreshes without re-prompting
        const deviceKey = await generateDek()
        const deviceWrappedDek = await wrapDek(dek, deviceKey)
        await tokenManager.setDeviceKey(await bytesToBase64(deviceKey))
        await tokenManager.setDeviceWrappedDek(
          await bytesToBase64(deviceWrappedDek.ciphertext),
          await bytesToBase64(deviceWrappedDek.nonce)
        )
      } catch (error) {
        const message = error instanceof AuthError ? error.message : 'Unlock failed'
        setLoginError(message)
        throw error
      } finally {
        setIsLoggingIn(false)
      }
    },
    [setCryptoState]
  )

  const logout = useCallback(async () => {
    useAuthStore.setState({ isLoading: true })

    try {
      await authService.logout(false)
    } catch {
      // Best-effort server logout; local state is always cleared
    } finally {
      await storeLogout()

      navigate(ROUTES.LOGIN, { replace: true })

      useAuthStore.setState({ isLoading: false })
      toast.success('Signed out successfully')
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
    completeSignup,
    verifyRecoveryKey,
    completeRecovery,
    unlock,
    logout,

    clearLoginError: () => setLoginError(null),
    clearSignupError: () => setSignupError(null),
  }
}
