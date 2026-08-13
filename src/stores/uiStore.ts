import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  mobileMenuOpen: boolean
  searchOpen: boolean
  commandOpen: boolean
  uploadPanelOpen: boolean

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setMobileMenuOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  setUploadPanelOpen: (open: boolean) => void
}

/** Controls global UI panel visibility (sidebar, search, command palette, upload panel). */
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileMenuOpen: false,
  searchOpen: false,
  commandOpen: false,
  uploadPanelOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setUploadPanelOpen: (uploadPanelOpen) => set({ uploadPanelOpen }),
}))
