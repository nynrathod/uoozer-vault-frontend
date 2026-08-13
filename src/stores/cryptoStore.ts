import { create } from 'zustand'
import { initCrypto } from '@lib/crypto'

interface CryptoState {
  isReady: boolean
  error: string | null
  initialize: () => Promise<void>
}

export const useCryptoStore = create<CryptoState>((set) => ({
  isReady: false,
  error: null,
  initialize: async () => {
    try {
      await initCrypto()
      set({ isReady: true, error: null })
    } catch (error) {
      set({
        isReady: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
}))
