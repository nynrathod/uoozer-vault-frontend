import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  mobileMenuOpen: boolean
  searchOpen: boolean
  commandOpen: boolean
  uploadPanelOpen: boolean
  selectedFileIds: Set<string>
  viewMode: 'list' | 'grid'
  sortField: 'name' | 'size' | 'modified' | 'created'
  sortOrder: 'asc' | 'desc'
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setMobileMenuOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  setUploadPanelOpen: (open: boolean) => void
  toggleViewMode: () => void
  setSort: (field: UIState['sortField'], order: UIState['sortOrder']) => void
  selectFile: (id: string) => void
  deselectFile: (id: string) => void
  toggleFileSelection: (id: string) => void
  clearSelection: () => void
  selectAll: (ids: string[]) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  mobileMenuOpen: false,
  searchOpen: false,
  commandOpen: false,
  uploadPanelOpen: false,
  selectedFileIds: new Set(),
  viewMode: 'list',
  sortField: 'modified',
  sortOrder: 'desc',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setUploadPanelOpen: (uploadPanelOpen) => set({ uploadPanelOpen }),
  toggleViewMode: () => set((s) => ({ viewMode: s.viewMode === 'list' ? 'grid' : 'list' })),
  setSort: (sortField, sortOrder) => set({ sortField, sortOrder }),
  selectFile: (id) =>
    set((s) => {
      const next = new Set(s.selectedFileIds)
      next.add(id)
      return { selectedFileIds: next }
    }),
  deselectFile: (id) =>
    set((s) => {
      const next = new Set(s.selectedFileIds)
      next.delete(id)
      return { selectedFileIds: next }
    }),
  toggleFileSelection: (id) => {
    const { selectedFileIds } = get()
    if (selectedFileIds.has(id)) {
      get().deselectFile(id)
    } else {
      get().selectFile(id)
    }
  },
  clearSelection: () => set({ selectedFileIds: new Set() }),
  selectAll: (ids) => set({ selectedFileIds: new Set(ids) }),
}))
