import { create } from 'zustand'
import { tokenManager } from '@services/auth/tokenManager'
import { authService } from '@services/auth/authService'
import { base64ToBytes, unwrapDek } from '@lib/crypto'
import type { AuthResponse, User } from '@/types/auth'

interface CryptoState {
  masterKey: Uint8Array | null
  dek: Uint8Array | null
}
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isCryptoReady: boolean
  isInitializing: boolean
  isLoading: boolean
  cryptoState: CryptoState

  setUser: (user: User | null) => void
  setAuthenticated: (value: boolean) => void
  setCryptoReady: (ready: boolean) => void
  setCryptoState: (state: CryptoState) => void
  setDek: (dek: Uint8Array | null) => void

  initialize: () => Promise<void>
  logout: () => Promise<void>

  recoveryTokens?: AuthResponse | null
}

const hasSession = tokenManager.getHasSession()
const userEmail = tokenManager.getUserEmail()

let _initPromise: Promise<void> | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  // Around line 37
  user:
    hasSession && userEmail
      ? { id: '', email: userEmail, fullName: '', createdAt: '', updatedAt: '' }
      : null,
  isAuthenticated: hasSession,
  isCryptoReady: false,
  isInitializing: hasSession,
  isLoading: false,
  cryptoState: { masterKey: null, dek: null },
  recoveryTokens: null,
  setUser: (user) => set({ user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setCryptoReady: (isCryptoReady) => set({ isCryptoReady }),
  setCryptoState: (cryptoState) => set({ cryptoState, isCryptoReady: !!cryptoState.dek }),
  setDek: (dek) =>
    set((state) => ({ cryptoState: { ...state.cryptoState, dek }, isCryptoReady: !!dek })),

  initialize: async () => {
    // If already initializing, return the existing promise so React Strict Mode doesn't double-fire
    if (_initPromise) return _initPromise

    if (!hasSession) {
      set({ isInitializing: false })
      return
    }

    _initPromise = (async () => {
      try {
        await authService.ensureCryptoReady()

        // 1. Silent Unlock via IndexedDB Device Key
        const deviceKeyB64 = await tokenManager.getDeviceKey()
        const deviceWrappedDek = await tokenManager.getDeviceWrappedDek()

        if (deviceKeyB64 && deviceWrappedDek) {
          try {
            const dk = await base64ToBytes(deviceKeyB64)
            const wrappedDek = {
              ciphertext: await base64ToBytes(deviceWrappedDek.wrappedDek),
              nonce: await base64ToBytes(deviceWrappedDek.nonce),
            }
            const dek = await unwrapDek(wrappedDek, dk)
            if (dek) {
              set({ cryptoState: { masterKey: null, dek }, isCryptoReady: true })
            }
          } catch (e) {}
        }

        // 2. Validate Refresh Token via API (This will now only run ONCE)
        const restored = await authService.tryRestoreSession()
        if (!restored) {
          await get().logout()
        }
      } catch (error) {
        await get().logout()
      } finally {
        set({ isInitializing: false })
        _initPromise = null // Clear lock when done
      }
    })()

    return _initPromise
  },

  logout: async () => {
    await tokenManager.clearAll()
    set({
      user: null,
      isAuthenticated: false,
      isCryptoReady: false,
      isInitializing: false,
      cryptoState: { masterKey: null, dek: null },
    })
  },
}))
