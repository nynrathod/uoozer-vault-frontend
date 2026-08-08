/**
 * Centralized Auth Store — Single Source of Truth
 *
 * State:
 * - user: User info (null if not loaded)
 * - tokens: Access/refresh tokens (managed by tokenManager)
 * - cryptoState: Master Key + DEK (in-memory ONLY, never persisted)
 * - isAuthenticated: Boolean derived from token presence
 * - isCryptoReady: Whether vault is unlocked (Master Key available)
 * - isLoading: Initial session check in progress
 *
 * Persistence:
 * - Tokens → IndexedDB (via tokenManager)
 * - Master Key / DEK → Memory only (zeroized on logout)
 * - User email → localStorage (for prelogin)
 */

import { create } from 'zustand'
import { tokenManager } from '@services/auth/tokenManager'
import type { User } from '@/types/auth'

// ─── Types ─────────────────────────────────────────────────────────────────

interface CryptoState {
  masterKey: Uint8Array | null
  dek: Uint8Array | null
}

interface AuthState {
  // ── State ──
  user: User | null
  isAuthenticated: boolean
  isCryptoReady: boolean
  isLoading: boolean
  cryptoState: CryptoState

  // ── Actions ──
  setUser: (user: User | null) => void
  setAuthenticated: (value: boolean) => void
  setCryptoReady: (ready: boolean) => void
  setLoading: (value: boolean) => void
  setCryptoState: (state: CryptoState) => void
  setMasterKey: (key: Uint8Array | null) => void
  setDek: (dek: Uint8Array | null) => void
  logout: () => Promise<void>

  // ── Derived ──
  hasMasterKey: () => boolean
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isCryptoReady: false,
  isLoading: true,
  cryptoState: {
    masterKey: null,
    dek: null,
  },

  setUser: (user) => set({ user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setCryptoReady: (isCryptoReady) => set({ isCryptoReady }),
  setLoading: (isLoading) => set({ isLoading }),

  setCryptoState: (cryptoState) => set({ cryptoState, isCryptoReady: !!cryptoState.masterKey }),

  setMasterKey: (key) =>
    set((state) => ({
      cryptoState: { ...state.cryptoState, masterKey: key },
      isCryptoReady: !!key,
    })),

  setDek: (dek) =>
    set((state) => ({
      cryptoState: { ...state.cryptoState, dek },
    })),

  logout: async () => {
    // Zeroize crypto material before clearing
    const { cryptoState } = get()
    if (cryptoState.masterKey) cryptoState.masterKey.fill(0)
    if (cryptoState.dek) cryptoState.dek.fill(0)

    await tokenManager.clearAll()
    set({
      user: null,
      isAuthenticated: false,
      isCryptoReady: false,
      cryptoState: { masterKey: null, dek: null },
      isLoading: false,
    })
  },

  hasMasterKey: () => get().cryptoState.masterKey !== null,
}))
