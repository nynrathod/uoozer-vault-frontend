import { useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutGrid,
  List,
  ArrowUpDown,
  FolderPlus,
  Upload,
  Plus,
  FileText,
  Presentation,
  FileSpreadsheet,
  Trash2,
  Download,
  X,
  Check,
  ChevronDown,
} from 'lucide-react'
import { useUIStore } from '@stores/uiStore'
import { useUploadStore } from '@stores/uploadStore'
import { QUERY_KEYS, ROUTES } from '@lib/constants'
import { cn } from '@lib/utils'

import { Button } from '@ui/Button'
import { DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel } from '@ui/DropdownMenu'

import { FileGrid } from '@features/file-manager/FileGrid'
import { FileBreadcrumb } from '@features/file-manager/FileBreadcrumb'
import { EmptyState } from '@features/file-manager/EmptyState'
import { UploadDropzone } from '@features/file-manager/UploadDropzone'
import { UploadQueue } from '@features/file-manager/UploadQueue'
import { FilePreviewDialog } from '@features/file-manager/FilePreviewDialog'
import type { FileItem } from '@/types/filtes'
import type { Folder } from '@/types/folders'
import { FileList } from '@features/file-manager/FileList'
import { VersionHistoryDialog } from '@/components/features/file-manager/VersionHistoryDialog'
import { VaultLoader } from '@/components/ui/VaultLoader'

const initialFolders: Folder[] = [
  {
    id: '1',
    userId: '1',
    parentId: null,
    encryptedName: 'Documents',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    userId: '1',
    parentId: null,
    encryptedName: 'Images',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    userId: '1',
    parentId: null,
    encryptedName: 'Videos',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    userId: '1',
    parentId: null,
    encryptedName: 'Work Projects',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    userId: '1',
    parentId: '1',
    encryptedName: 'Invoices',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const initialFiles: FileItem[] = [
  {
    id: 'f1',
    userId: '1',
    folderId: null,
    encryptedName: 'Annual Report.pdf',
    encryptedMimeType: 'application/pdf',
    size: 2456789,
    blake3Hash: 'hash',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chunks: [],
  },
  {
    id: 'f2',
    userId: '1',
    folderId: null,
    encryptedName: 'Vacation.png',
    encryptedMimeType: 'image/png',
    size: 4567891,
    blake3Hash: 'hash',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chunks: [],
  },
  {
    id: 'f3',
    userId: '1',
    folderId: null,
    encryptedName: 'Meeting Notes.docx',
    encryptedMimeType: 'application/document',
    size: 12345,
    blake3Hash: 'hash',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chunks: [],
  },
  {
    id: 'f4',
    userId: '1',
    folderId: null,
    encryptedName: 'Budget.xlsx',
    encryptedMimeType: 'application/spreadsheet',
    size: 98765,
    blake3Hash: 'hash',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chunks: [],
  },
  {
    id: 'f5',
    userId: '1',
    folderId: null,
    encryptedName: 'Presentation.pptx',
    encryptedMimeType: 'application/presentation',
    size: 5432100,
    blake3Hash: 'hash',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chunks: [],
  },
  {
    id: 'f6',
    userId: '1',
    folderId: null,
    encryptedName: 'archive.zip',
    encryptedMimeType: 'application/zip',
    size: 12345678,
    blake3Hash: 'hash',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chunks: [],
  },
  {
    id: 'f7',
    userId: '1',
    folderId: null,
    encryptedName: 'Readme.txt',
    encryptedMimeType: 'text/plain',
    size: 1024,
    blake3Hash: 'hash',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chunks: [],
  },
]

export function VaultPage() {
  const { folderId } = useParams<{ folderId?: string }>()
  const navigate = useNavigate()
  const currentFolderId = folderId || null

  const viewMode = useUIStore((s) => s.viewMode)
  const toggleViewMode = useUIStore((s) => s.toggleViewMode)
  const sortField = useUIStore((s) => s.sortField)
  const sortOrder = useUIStore((s) => s.sortOrder)
  const setSort = useUIStore((s) => s.setSort)
  const selectedIds = useUIStore((s) => s.selectedFileIds)
  const toggleFileSelection = useUIStore((s) => s.toggleFileSelection)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const uploadPanelOpen = useUIStore((s) => s.uploadPanelOpen)
  const setUploadPanelOpen = useUIStore((s) => s.setUploadPanelOpen)

  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [files, setFiles] = useState<FileItem[]>(initialFiles)
  const [isDragOver, setIsDragOver] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false)

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [versionFile, setVersionFile] = useState<FileItem | null>(null)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  const { isLoading } = useQuery({
    queryKey: [QUERY_KEYS.FILES.LIST, folderId],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300))
      return true
    },
  })

  const currentFolders = folders.filter((f) => f.parentId === currentFolderId)
  const currentFiles = files.filter((f) => f.folderId === currentFolderId)

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    folders.forEach((f) => {
      counts[f.id] =
        folders.filter((c) => c.parentId === f.id).length +
        files.filter((c) => c.folderId === f.id).length
    })
    return counts
  }, [folders, files])

  const breadcrumbPath: Folder[] = []
  let parentId = currentFolderId
  while (parentId) {
    const parentFolder = folders.find((f) => f.id === parentId)
    if (parentFolder) {
      breadcrumbPath.unshift(parentFolder)
      parentId = parentFolder.parentId
    } else break
  }

  const handleFolderClick = useCallback(
    (folder: Folder) => {
      clearSelection()
      setPreviewFile(null)
      navigate(`/vault/folder/${folder.id}`)
    },
    [navigate, clearSelection]
  )

  const handleNavigate = useCallback(
    (targetFolderId: string | null) => {
      clearSelection()
      setPreviewFile(null)
      if (targetFolderId === null) navigate(ROUTES.VAULT)
      else navigate(`/vault/folder/${targetFolderId}`)
    },
    [navigate, clearSelection]
  )

  const handleFileClick = useCallback((file: FileItem) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    clickTimer.current = setTimeout(() => {
      setPreviewFile(file)
      setIsPreviewFullscreen(false)
      clickTimer.current = null
    }, 220)
  }, [])

  const handleFileDoubleClick = useCallback((file: FileItem) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    setPreviewFile(file)
    setIsPreviewFullscreen(true)
  }, [])

  const handleUploadFiles = useCallback(
    (droppedFiles: File[]) => {
      droppedFiles.forEach((file) => {
        const uploadId = crypto.randomUUID()
        const totalChunks = Math.ceil(file.size / (4 * 1024 * 1024))
        const chunks = Array.from({ length: totalChunks }, (_, i) => ({
          id: crypto.randomUUID(),
          fileId: uploadId,
          index: i,
          totalChunks,
          status: 'pending' as const,
          progress: 0,
          size: Math.min(4 * 1024 * 1024, file.size - i * 4 * 1024 * 1024),
          blake3Hash: null,
          retries: 0,
        }))
        useUploadStore.getState().addUpload({
          id: uploadId,
          localFile: file,
          encryptedName: file.name,
          encryptedMimeType: file.type,
          folderId: currentFolderId,
          totalSize: file.size,
          chunks,
          status: 'pending',
          overallProgress: 0,
          createdAt: Date.now(),
        })
      })
      setUploadPanelOpen(true)
    },
    [currentFolderId, setUploadPanelOpen]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files') && !isDragOver) setIsDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.relatedTarget === null) setIsDragOver(false)
  }
  const handleDropUpload = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleCreateFolder = () => {
    const newId = crypto.randomUUID()
    const newFolder: Folder = {
      id: newId,
      userId: '1',
      parentId: currentFolderId,
      encryptedName: 'Untitled Folder',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setFolders([...folders, newFolder])
    setEditingId(newId)
  }

  const handleRenameRequest = useCallback((id: string | null) => {
    setEditingId(id)
  }, [])

  const handleRename = useCallback((id: string, isFolder: boolean, newName: string) => {
    if (isFolder)
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, encryptedName: newName } : f)))
    else setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, encryptedName: newName } : f)))
    setEditingId(null)
  }, [])

  const handleDelete = (id: string, isFolder: boolean) => {
    if (isFolder) setFolders((prev) => prev.filter((f) => f.id !== id))
    else setFiles((prev) => prev.filter((f) => f.id !== id))
    setPreviewFile(null)
  }

  const handleMoveItem = (itemId: string, targetFolderId: string, isFolder: boolean) => {
    if (itemId === targetFolderId) return
    if (isFolder) {
      let currentParent: string | null = targetFolderId
      while (currentParent) {
        if (currentParent === itemId) return
        const p = folders.find((f) => f.id === currentParent)
        currentParent = p?.parentId || null
      }
    }

    // 1. Add to removingIds to trigger the CSS collapse animation
    setRemovingIds((prev) => new Set(prev).add(itemId))

    // 2. Wait 150ms for the animation to finish, THEN update the state array
    setTimeout(() => {
      if (isFolder) {
        setFolders((prev) =>
          prev.map((f) => (f.id === itemId ? { ...f, parentId: targetFolderId } : f))
        )
      } else {
        setFiles((prev) =>
          prev.map((f) => (f.id === itemId ? { ...f, folderId: targetFolderId } : f))
        )
      }
      // 3. Remove from removingIds
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }, 150)
  }

  // Unified sort function that sorts BOTH folders and files
  const applySort = (field: 'name' | 'size' | 'modified', order: 'asc' | 'desc') => {
    setSort(field, order)
    const mult = order === 'asc' ? 1 : -1

    // Sort Folders (Folders don't have a size, so we fall back to name)
    setFolders((prev) =>
      [...prev].sort((a, b) => {
        if (field === 'name') return mult * a.encryptedName.localeCompare(b.encryptedName)
        if (field === 'modified')
          return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        return 0 // Keep folder order for size sorting
      })
    )

    // Sort Files
    setFiles((prev) =>
      [...prev].sort((a, b) => {
        if (field === 'name') return mult * a.encryptedName.localeCompare(b.encryptedName)
        if (field === 'size') return mult * (a.size - b.size)
        if (field === 'modified')
          return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        return 0
      })
    )
  }

  const handleSort = (field: 'name' | 'size' | 'modified', order: 'asc' | 'desc') => {
    applySort(field, order)
  }

  const handleColumnSort = (field: 'name' | 'size' | 'modified') => {
    let newField: 'name' | 'size' | 'modified' | null = field
    let newOrder: 'asc' | 'desc' | null = 'asc'

    // Cycle logic:
    // 1. If clicking a new field, start with Asc.
    // 2. If clicking the same field and it's Asc, switch to Desc.
    // 3. If clicking the same field and it's Desc, reset to Default (null).
    if (sortField === field) {
      if (sortOrder === 'asc') {
        newOrder = 'desc'
      } else if (sortOrder === 'desc') {
        newField = null
        newOrder = null
      }
    }

    setSort(newField as any, newOrder as any)

    if (newField && newOrder) {
      // Apply the actual sorting
      const mult = newOrder === 'asc' ? 1 : -1
      setFolders((prev) =>
        [...prev].sort((a, b) => {
          if (newField === 'name') return mult * a.encryptedName.localeCompare(b.encryptedName)
          if (newField === 'modified')
            return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
          return 0
        })
      )
      setFiles((prev) =>
        [...prev].sort((a, b) => {
          if (newField === 'name') return mult * a.encryptedName.localeCompare(b.encryptedName)
          if (newField === 'size') return mult * (a.size - b.size)
          if (newField === 'modified')
            return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
          return 0
        })
      )
    } else {
      // Reset to default view (e.g., by modified desc)
      setFolders((prev) =>
        [...prev].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      )
      setFiles((prev) =>
        [...prev].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      )
    }
  }

  const isEmpty = currentFiles.length === 0 && currentFolders.length === 0
  const hasSelection = selectedIds.size > 0
  // Update isAllSelected to check both files AND folders
  const isAllSelected =
    currentFiles.length + currentFolders.length > 0 &&
    [...currentFolders, ...currentFiles].every((item) => selectedIds.has(item.id))

  // Update handleSelectAll to select both files AND folders
  const handleSelectAll = () => {
    if (isAllSelected) {
      clearSelection()
    } else {
      const allIds = [...currentFolders.map((f) => f.id), ...currentFiles.map((f) => f.id)]
      useUIStore.getState().selectAll(allIds)
    }
  }

  // Update handleBulkDelete to delete both files AND folders
  const handleBulkDelete = () => {
    setFolders((prev) => prev.filter((f) => !selectedIds.has(f.id)))
    setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)))
    clearSelection()
  }

  return (
    <div
      className="bg-background relative flex h-full overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropUpload}
    >
      <div className="bg-background relative flex h-full w-full overflow-hidden">
        {isDragOver && (
          <div className="border-primary bg-primary/5 pointer-events-none absolute inset-0 z-[200] m-4 flex items-center justify-center rounded-2xl border-4 border-dashed backdrop-blur-sm">
            <div className="text-primary flex flex-col items-center gap-3">
              <Upload className="h-12 w-12" strokeWidth={1.5} />
              <h3 className="text-lg font-semibold">Drop files to upload</h3>
              <p className="text-muted-foreground text-sm">Release to upload to this folder</p>
            </div>
          </div>
        )}

        {/* File List Container - Hidden on mobile when preview is open */}
        <div
          className={cn(
            'flex h-full flex-col overflow-hidden',
            previewFile ? 'hidden md:flex md:w-1/2 md:border-r' : 'w-full'
          )}
        >
          <FileBreadcrumb path={breadcrumbPath} onNavigate={handleNavigate} />

          <div className="border-border/60 flex shrink-0 items-center justify-between border-b px-4 py-2">
            {hasSelection ? (
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 rounded-lg"
                    onClick={clearSelection}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <span className="text-[13px] font-medium">{selectedIds.size} selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-[13px]">
                    <Download className="h-4 w-4" />{' '}
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 h-8 gap-1.5 rounded-lg text-[13px]"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <DropdownMenu
                    align="start"
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg text-[13px]"
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Sort</span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    }
                  >
                    <DropdownLabel>Sort by</DropdownLabel>
                    <DropdownItem onClick={() => handleSort('name', 'asc')}>
                      Name (A → Z){' '}
                      {sortField === 'name' && sortOrder === 'asc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownItem onClick={() => handleSort('name', 'desc')}>
                      Name (Z → A){' '}
                      {sortField === 'name' && sortOrder === 'desc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem onClick={() => handleSort('modified', 'desc')}>
                      Newest first{' '}
                      {sortField === 'modified' && sortOrder === 'desc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownItem onClick={() => handleSort('modified', 'asc')}>
                      Oldest first{' '}
                      {sortField === 'modified' && sortOrder === 'asc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem onClick={() => handleSort('size', 'desc')}>
                      Largest first{' '}
                      {sortField === 'size' && sortOrder === 'desc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownItem onClick={() => handleSort('size', 'asc')}>
                      Smallest first{' '}
                      {sortField === 'size' && sortOrder === 'asc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                  </DropdownMenu>
                  <span className="text-muted-foreground/60 hidden text-xs sm:inline">
                    {currentFiles.length + currentFolders.length} items
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <DropdownMenu
                    trigger={
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-foreground text-background hover:bg-foreground/90 h-8 gap-1.5 rounded-lg px-3 text-[13px] font-medium"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} /> New
                      </Button>
                    }
                  >
                    <DropdownItem
                      icon={<FolderPlus className="h-4 w-4" />}
                      onClick={handleCreateFolder}
                    >
                      New Folder
                    </DropdownItem>
                    <DropdownItem
                      icon={<Upload className="h-4 w-4" />}
                      onClick={() => setUploadPanelOpen(true)}
                    >
                      Upload File
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem icon={<FileText className="h-4 w-4" />}>
                      New Document
                    </DropdownItem>
                    <DropdownItem icon={<Presentation className="h-4 w-4" />}>
                      New Presentation
                    </DropdownItem>
                    <DropdownItem icon={<FileSpreadsheet className="h-4 w-4" />}>
                      New Spreadsheet
                    </DropdownItem>
                  </DropdownMenu>
                  <div className="bg-border/70 mx-1 hidden h-5 w-px sm:block" />
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="icon-sm"
                    onClick={() => viewMode !== 'list' && toggleViewMode()}
                    className="hidden h-8 w-8 rounded-lg sm:flex"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="icon-sm"
                    onClick={() => viewMode !== 'grid' && toggleViewMode()}
                    className="hidden h-8 w-8 rounded-lg sm:flex"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <VaultLoader size={48} />

                {/* <ChunkStreamLoader size={40} /> */}
                {/* <OrbitCoreLoader size={40} /> */}
              </div>
            ) : isEmpty ? (
              <EmptyState onUpload={() => setUploadPanelOpen(true)} />
            ) : viewMode === 'list' ? (
              <div className="h-full overflow-auto">
                <FileList
                  files={currentFiles}
                  folders={currentFolders}
                  onFolderClick={handleFolderClick}
                  onFileClick={handleFileClick}
                  onFileDoubleClick={handleFileDoubleClick}
                  onFileSelect={toggleFileSelection}
                  selectedIds={selectedIds}
                  onRename={handleRename}
                  onRenameRequest={handleRenameRequest}
                  onDelete={handleDelete}
                  onMoveItem={handleMoveItem}
                  editingId={editingId}
                  folderCounts={folderCounts}
                  onSelectAll={handleSelectAll}
                  isAllSelected={isAllSelected}
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSortChange={handleColumnSort}
                  activeMenuId={activeMenuId}
                  setActiveMenuId={setActiveMenuId}
                  onVersions={(file) => setVersionFile(file)}
                  removingIds={removingIds} // <-- ADD THIS PROP
                />
              </div>
            ) : (
              <FileGrid
                files={currentFiles}
                folders={currentFolders}
                onFolderClick={handleFolderClick}
                onFileClick={handleFileClick}
                onFileDoubleClick={handleFileDoubleClick}
                onFileSelect={toggleFileSelection}
                selectedIds={selectedIds}
                onRename={handleRename}
                onRenameRequest={handleRenameRequest}
                onDelete={handleDelete}
                onMoveItem={handleMoveItem}
                editingId={editingId}
                folderCounts={folderCounts}
                onVersions={(file) => setVersionFile(file)}
              />
            )}
          </div>
        </div>

        {/* Preview Pane - Full width on mobile */}
        {previewFile && (
          <div className="bg-muted/30 flex h-full w-full flex-col overflow-hidden md:w-1/2">
            <FilePreviewDialog
              open={true}
              onOpenChange={(open) => !open && setPreviewFile(null)}
              file={previewFile}
              isFullscreen={isPreviewFullscreen}
              setIsFullscreen={setIsPreviewFullscreen}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          </div>
        )}

        <UploadDropzone
          isOpen={uploadPanelOpen}
          onClose={() => setUploadPanelOpen(false)}
          onDrop={handleUploadFiles}
        />
        <VersionHistoryDialog
          open={!!versionFile}
          onOpenChange={() => setVersionFile(null)}
          fileName={versionFile?.encryptedName || ''}
        />
        <UploadQueue />
      </div>
    </div>
  )
}
