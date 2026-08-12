import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

interface FileStoreState {
  files: Map<string, FileItem>
  folders: Map<string, Folder>
  currentFolderId: string | null

  editingId: string | null
  previewFileId: string | null
  isPreviewFullscreen: boolean
  removingIds: Set<string>
  shareTargetId: string | null
  activeMenuId: string | null
  versionFileId: string | null

  selectedFileIds: Set<string>
  sortField: 'name' | 'size' | 'modified' | 'created' | null
  sortOrder: 'asc' | 'desc' | null
  viewMode: 'list' | 'grid'

  setFiles: (files: FileItem[]) => void
  setFolders: (folders: Folder[]) => void
  setCurrentFolderId: (id: string | null) => void

  renameItem: (id: string, isFolder: boolean, newName: string) => void
  deleteItem: (id: string, isFolder: boolean) => void
  moveItem: (itemId: string, targetFolderId: string, isFolder: boolean) => void

  setEditingId: (id: string | null) => void
  setPreviewFile: (id: string | null) => void
  setIsPreviewFullscreen: (val: boolean) => void
  addRemovingId: (id: string) => void
  clearRemovingId: (id: string) => void
  setShareTarget: (id: string | null) => void
  setActiveMenuId: (id: string | null) => void
  setVersionFileId: (id: string | null) => void

  toggleFileSelection: (id: string) => void
  clearSelection: () => void
  selectAll: (ids: string[]) => void
  setSort: (
    field: 'name' | 'size' | 'modified' | 'created' | null,
    order: 'asc' | 'desc' | null
  ) => void
  toggleViewMode: () => void
}

export const useFileStore = create<FileStoreState>()(
  devtools(
    (set, get) => ({
      files: new Map(),
      folders: new Map(),
      currentFolderId: null,
      editingId: null,
      previewFileId: null,
      isPreviewFullscreen: false,
      removingIds: new Set(),
      shareTargetId: null,
      activeMenuId: null,
      versionFileId: null,
      selectedFileIds: new Set(),
      sortField: null,
      sortOrder: null,
      viewMode: 'list',

      setFiles: (files) => set({ files: new Map(files.map((f) => [f.id, f])) }),
      setFolders: (folders) => set({ folders: new Map(folders.map((f) => [f.id, f])) }),
      setCurrentFolderId: (id) => set({ currentFolderId: id }),

      renameItem: (id, isFolder, newName) =>
        set((state) => {
          if (isFolder) {
            const f = state.folders.get(id)
            if (f) state.folders.set(id, { ...f, encryptedName: newName })
          } else {
            const f = state.files.get(id)
            if (f) state.files.set(id, { ...f, encryptedName: newName })
          }
          return { folders: new Map(state.folders), files: new Map(state.files) }
        }),

      deleteItem: (id, isFolder) =>
        set((state) => {
          if (isFolder) state.folders.delete(id)
          else state.files.delete(id)
          return { folders: new Map(state.folders), files: new Map(state.files) }
        }),

      moveItem: (itemId, targetFolderId, isFolder) =>
        set((state) => {
          if (isFolder) {
            const f = state.folders.get(itemId)
            if (f) state.folders.set(itemId, { ...f, parentId: targetFolderId })
          } else {
            const f = state.files.get(itemId)
            if (f) state.files.set(itemId, { ...f, folderId: targetFolderId })
          }
          return { folders: new Map(state.folders), files: new Map(state.files) }
        }),

      setEditingId: (id) => set({ editingId: id }),
      setPreviewFile: (id) => set({ previewFileId: id }),
      setIsPreviewFullscreen: (val) => set({ isPreviewFullscreen: val }),
      addRemovingId: (id) =>
        set((state) => {
          const next = new Set(state.removingIds)
          next.add(id)
          return { removingIds: next }
        }),
      clearRemovingId: (id) =>
        set((state) => {
          const next = new Set(state.removingIds)
          next.delete(id)
          return { removingIds: next }
        }),
      setShareTarget: (id) => set({ shareTargetId: id }),
      setActiveMenuId: (id) => set({ activeMenuId: id }),
      setVersionFileId: (id) => set({ versionFileId: id }),

      toggleFileSelection: (id) =>
        set((state) => {
          const next = new Set(state.selectedFileIds)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return { selectedFileIds: next }
        }),
      clearSelection: () => set({ selectedFileIds: new Set() }),
      selectAll: (ids) => set({ selectedFileIds: new Set(ids) }),
      setSort: (field, order) => set({ sortField: field, sortOrder: order }),
      toggleViewMode: () =>
        set((state) => ({ viewMode: state.viewMode === 'list' ? 'grid' : 'list' })),
    }),
    { name: 'fileStore' }
  )
)

// Selectors for granular re-renders
export const selectCurrentFiles = (s: FileStoreState) =>
  Array.from(s.files.values()).filter((f) => f.folderId === s.currentFolderId)

export const selectCurrentFolders = (s: FileStoreState) =>
  Array.from(s.folders.values()).filter((f) => f.parentId === s.currentFolderId)

export const selectFileById = (id: string | null) => (s: FileStoreState) =>
  id ? s.files.get(id) : null

export const selectFolderById = (id: string | null) => (s: FileStoreState) =>
  id ? s.folders.get(id) : null

export const selectBreadcrumbPath = (s: FileStoreState) => {
  const path: Folder[] = []
  let parentId = s.currentFolderId
  while (parentId) {
    const folder = s.folders.get(parentId)
    if (folder) {
      path.unshift(folder)
      parentId = folder.parentId
    } else break
  }
  return path
}

export const selectFolderCounts = (s: FileStoreState) => {
  const counts: Record<string, number> = {}
  s.folders.forEach((f) => {
    counts[f.id] =
      Array.from(s.folders.values()).filter((c) => c.parentId === f.id).length +
      Array.from(s.files.values()).filter((c) => c.folderId === f.id).length
  })
  return counts
}
