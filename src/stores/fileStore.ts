import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

interface FileStoreState {
  files: Map<string, FileItem>
  folders: Map<string, Folder>
  currentFolderId: string | null
  editingId: string | null
  removingIds: Set<string>
  shareTargetId: string | null
  activeMenuId: string | null
  versionFileId: string | null
  selectedFileIds: Set<string>
  sortField: 'name' | 'size' | 'modified' | 'created' | null
  sortOrder: 'asc' | 'desc' | null
  viewMode: 'list' | 'grid'
  dropHint: { destinationId: string | null; destinationName: string } | null
  setDropHint: (hint: { destinationId: string | null; destinationName: string } | null) => void
  setFiles: (files: FileItem[]) => void
  setFolders: (folders: Folder[]) => void
  setCurrentFolderId: (id: string | null) => void
  renameItem: (id: string, isFolder: boolean, newName: string) => void
  deleteItem: (id: string, isFolder: boolean) => void
  moveItem: (itemId: string, targetFolderId: string, isFolder: boolean) => void
  sortItems: (
    field: 'name' | 'size' | 'modified' | 'created' | null,
    order: 'asc' | 'desc' | null
  ) => void
  setEditingId: (id: string | null) => void
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
  isDragging: boolean
  setIsDragging: (val: boolean) => void
  dragOverId: string | null
  setDragOverId: (id: string | null) => void
  _lastRefresh?: number
  refreshFiles: () => void
}

/** Manages the file browser: file/folder lists, selection, sorting, drag-and-drop, and UI flags. */
export const useFileStore = create<FileStoreState>()(
  devtools(
    (set) => ({
      files: new Map(),
      folders: new Map(),
      currentFolderId: null,
      editingId: null,
      removingIds: new Set(),
      shareTargetId: null,
      activeMenuId: null,
      versionFileId: null,
      selectedFileIds: new Set(),
      sortField: null,
      sortOrder: null,
      viewMode: 'list',
      dropHint: null,
      setDropHint: (hint) => set({ dropHint: hint }),
      setFiles: (files) => set({ files: new Map(files.map((f) => [f.id, f])) }),
      setFolders: (folders) => set({ folders: new Map(folders.map((f) => [f.id, f])) }),
      setCurrentFolderId: (id) => set({ currentFolderId: id }),
      renameItem: (id, isFolder, newName) =>
        set((state) => {
          if (isFolder) {
            const f = state.folders.get(id)
            if (f) state.folders.set(id, { ...f, name: newName })
          } else {
            const f = state.files.get(id)
            if (f) state.files.set(id, { ...f, name: newName })
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
      sortItems: (field, order) =>
        set((state) => {
          const comparator = (a: FileItem | Folder, b: FileItem | Folder) => {
            if (!field || !order)
              return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            const mult = order === 'asc' ? 1 : -1
            if (field === 'name') return mult * a.name.localeCompare(b.name)
            if (field === 'size' && 'totalSize' in a && 'totalSize' in b)
              return mult * ((a as FileItem).totalSize - (b as FileItem).totalSize)
            if (field === 'modified')
              return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
            return 0
          }
          return {
            folders: new Map(
              Array.from(state.folders.values())
                .sort(comparator)
                .map((f) => [f.id, f])
            ),
            files: new Map(
              Array.from(state.files.values())
                .sort(comparator)
                .map((f) => [f.id, f])
            ),
          }
        }),
      setEditingId: (id) => set({ editingId: id }),
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
        set((state) => ({
          viewMode:
            state.viewMode === 'list' ? 'grid' : 'grid' === state.viewMode ? 'list' : 'list',
        })),
      isDragging: false,
      setIsDragging: (val) => set({ isDragging: val }),
      dragOverId: null,
      setDragOverId: (id) => set({ dragOverId: id }),
      refreshFiles: () => {
        set({ _lastRefresh: Date.now() })
      },
    }),
    { name: 'fileStore' }
  )
)

function itemComparator(
  a: { name: string; updatedAt: string; totalSize?: number },
  b: { name: string; updatedAt: string; totalSize?: number },
  sortField: FileStoreState['sortField'],
  sortOrder: FileStoreState['sortOrder']
): number {
  if (!sortField || !sortOrder) {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  }
  const mult = sortOrder === 'asc' ? 1 : -1
  if (sortField === 'name') return mult * a.name.localeCompare(b.name)
  if (sortField === 'size') return mult * ((a.totalSize ?? 0) - (b.totalSize ?? 0))
  if (sortField === 'modified' || sortField === 'created') {
    return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
  }
  return 0
}

/** Returns files in the currently-active folder. */
export const selectCurrentFiles = (s: FileStoreState) =>
  Array.from(s.files.values())
    .filter((f) => f.folderId === s.currentFolderId)
    .sort((a, b) => {
      const aIsTemp = a.id.startsWith('temp-')
      const bIsTemp = b.id.startsWith('temp-')
      if (aIsTemp && !bIsTemp) return -1
      if (!aIsTemp && bIsTemp) return 1
      return itemComparator(a, b, s.sortField, s.sortOrder)
    })

export const selectCurrentFolders = (s: FileStoreState) =>
  Array.from(s.folders.values())
    .filter((f) => f.parentId === s.currentFolderId)
    .sort((a, b) => {
      const aIsTemp = a.id.startsWith('temp-')
      const bIsTemp = b.id.startsWith('temp-')
      if (aIsTemp && !bIsTemp) return -1
      if (!aIsTemp && bIsTemp) return 1
      return itemComparator(a, b, s.sortField, s.sortOrder)
    })

export const selectCurrentItems = (s: FileStoreState) => {
  const items: Array<{ item: FileItem | Folder; isFolder: boolean }> = []
  for (const folder of selectCurrentFolders(s)) {
    items.push({ item: folder, isFolder: true })
  }
  for (const file of selectCurrentFiles(s)) {
    items.push({ item: file, isFolder: false })
  }
  // One merged sort pass with the shared comparator (temp rows first).
  return items.sort((a, b) => {
    const aIsTemp = a.item.id.startsWith('temp-')
    const bIsTemp = b.item.id.startsWith('temp-')
    if (aIsTemp && !bIsTemp) return -1
    if (!aIsTemp && bIsTemp) return 1
    return itemComparator(a.item, b.item, s.sortField, s.sortOrder)
  })
}

export const selectFolderSizes = (s: FileStoreState) => {
  const ownSizes = new Map<string, number>()
  s.files.forEach((f) => {
    if (f.folderId) {
      ownSizes.set(f.folderId, (ownSizes.get(f.folderId) ?? 0) + f.totalSize)
    }
  })
  const sizes = new Map<string, number>()
  const resolve = (folderId: string, visited: Set<string>): number => {
    if (sizes.has(folderId)) return sizes.get(folderId)!
    if (visited.has(folderId)) return 0 // corrupt chain guard
    visited.add(folderId)
    const folder = s.folders.get(folderId)
    let total = ownSizes.get(folderId) ?? 0
    if (folder) {
      for (const child of s.folders.values()) {
        if (child.parentId === folderId) {
          total += resolve(child.id, visited)
        }
      }
    }
    sizes.set(folderId, total)
    return total
  }
  s.folders.forEach((f) => {
    if (!sizes.has(f.id)) resolve(f.id, new Set())
  })
  return sizes
}

export const selectFolderItemCounts = (s: FileStoreState) => {
  const counts = new Map<string, number>()
  const directFiles = new Map<string, number>()
  s.files.forEach((f) => {
    if (f.folderId) directFiles.set(f.folderId, (directFiles.get(f.folderId) ?? 0) + 1)
  })
  const directFolders = new Map<string, number>()
  s.folders.forEach((f) => {
    if (f.parentId) directFolders.set(f.parentId, (directFolders.get(f.parentId) ?? 0) + 1)
  })
  const resolve = (folderId: string, visited: Set<string>): number => {
    if (counts.has(folderId)) return counts.get(folderId)!
    if (visited.has(folderId)) return 0
    visited.add(folderId)
    let total = (directFiles.get(folderId) ?? 0) + (directFolders.get(folderId) ?? 0)
    for (const child of s.folders.values()) {
      if (child.parentId === folderId) {
        total += resolve(child.id, visited)
      }
    }
    counts.set(folderId, total)
    return total
  }
  s.folders.forEach((f) => {
    if (!counts.has(f.id)) resolve(f.id, new Set())
  })
  return counts
}

export const selectFileById = (id: string | null) => (s: FileStoreState) =>
  id ? s.files.get(id) : null
export const selectFolderById = (id: string | null) => (s: FileStoreState) =>
  id ? s.folders.get(id) : null

/** Walks parent pointers to build the folder breadcrumb path from root. */
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
