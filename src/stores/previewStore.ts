import { create } from 'zustand'

interface PreviewState {
  fileId: string | null
  isFullscreen: boolean
  isLoading: boolean
  isEditing: boolean
  open: (fileId: string) => void
  close: () => void
  setFullscreen: (val: boolean) => void
  toggleFullscreen: () => void
  setLoading: (val: boolean) => void
  setEditing: (val: boolean) => void
}

export const usePreviewStore = create<PreviewState>((set) => ({
  fileId: null,
  isFullscreen: false,
  isLoading: true,
  isEditing: false,
  open: (fileId) => set({ fileId, isFullscreen: false, isLoading: true, isEditing: false }),
  close: () => set({ fileId: null, isFullscreen: false, isEditing: false }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),
  setLoading: (isLoading) => set({ isLoading }),
  setEditing: (isEditing) => set({ isEditing }),
}))
