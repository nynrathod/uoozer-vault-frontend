import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
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
import { QUERY_KEYS, ROUTES, UI_CONFIG, UPLOAD_CONFIG } from '@lib/constants'
import { cn } from '@lib/utils'

import { Button } from '@ui/Button'
import { DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel } from '@ui/DropdownMenu'

import { FileGrid } from '@/components/features/vault/file-list/FileGrid'
import { FileBreadcrumb } from '@/components/features/vault/file-list/FileBreadcrumb'
import { EmptyState } from '@/components/features/vault/file-list/EmptyState'
import { UploadDropzone } from '@/components/features/vault/upload/UploadDropzone'
import { UploadQueue } from '@/components/features/vault/upload/UploadQueue'
import { FilePreviewDialog } from '@/components/ui/overlays/FilePreviewDialog'
import { ShareDialog } from '@/components/ui/overlays/ShareDialog'
import { VersionHistoryDialog } from '@/components/ui/overlays/VersionHistoryDialog'
import { VaultLoader } from '@/components/ui/feedback/VaultLoader'

import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'
import { FileList } from '@/components/features/vault/file-list/FileList'
import { mockFolders } from '@/test/mocks/folders'
import { mockFiles } from '@/test/mocks/files'

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

  const [folders, setFolders] = useState<Folder[]>(mockFolders)
  const [files, setFiles] = useState<FileItem[]>(mockFiles)
  const [isDragOver, setIsDragOver] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [versionFile, setVersionFile] = useState<FileItem | null>(null)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [shareTarget, setShareTarget] = useState<{
    item: FileItem | Folder
    isFolder: boolean
    itemCount: number
  } | null>(null)

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const removeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    return () => {
      if (clickTimer.current) clearTimeout(clickTimer.current)
      removeTimers.current.forEach((t) => clearTimeout(t))
      removeTimers.current.clear()
    }
  }, [])

  const { isLoading } = useQuery({
    queryKey: [QUERY_KEYS.FILES.LIST, folderId],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300))
      return true
    },
  })

  const currentFolders = useMemo(
    () => folders.filter((f) => f.parentId === currentFolderId),
    [folders, currentFolderId]
  )
  const currentFiles = useMemo(
    () => files.filter((f) => f.folderId === currentFolderId),
    [files, currentFolderId]
  )

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    folders.forEach((f) => {
      counts[f.id] =
        folders.filter((c) => c.parentId === f.id).length +
        files.filter((c) => c.folderId === f.id).length
    })
    return counts
  }, [folders, files])

  const breadcrumbPath = useMemo(() => {
    const path: Folder[] = []
    let parentId = currentFolderId
    while (parentId) {
      const parentFolder = folders.find((f) => f.id === parentId)
      if (parentFolder) {
        path.unshift(parentFolder)
        parentId = parentFolder.parentId
      } else break
    }
    return path
  }, [currentFolderId, folders])

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
    }, UI_CONFIG.DOUBLE_CLICK_THRESHOLD_MS)
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
        const totalChunks = Math.ceil(file.size / UPLOAD_CONFIG.CHUNK_SIZE)
        const chunks = Array.from({ length: totalChunks }, (_, i) => ({
          id: crypto.randomUUID(),
          fileId: uploadId,
          index: i,
          totalChunks,
          status: 'pending' as const,
          progress: 0,
          size: Math.min(UPLOAD_CONFIG.CHUNK_SIZE, file.size - i * UPLOAD_CONFIG.CHUNK_SIZE),
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

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.types.includes('Files') && !isDragOver) setIsDragOver(true)
    },
    [isDragOver]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.relatedTarget === null) setIsDragOver(false)
  }, [])

  const handleDropUpload = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUploadFiles(Array.from(e.dataTransfer.files))
      }
    },
    [handleUploadFiles]
  )

  const handleCreateFolder = useCallback(() => {
    const newId = crypto.randomUUID()
    const newFolder: Folder = {
      id: newId,
      userId: '1',
      parentId: currentFolderId,
      encryptedName: 'Untitled Folder',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setFolders((prev) => [...prev, newFolder])
    setEditingId(newId)
  }, [currentFolderId])

  const handleRenameRequest = useCallback((id: string | null) => setEditingId(id), [])

  const handleRename = useCallback((id: string, isFolder: boolean, newName: string) => {
    if (isFolder)
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, encryptedName: newName } : f)))
    else setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, encryptedName: newName } : f)))
    setEditingId(null)
  }, [])

  const handleDelete = useCallback((id: string, isFolder: boolean) => {
    if (isFolder) setFolders((prev) => prev.filter((f) => f.id !== id))
    else setFiles((prev) => prev.filter((f) => f.id !== id))
    setPreviewFile(null)
  }, [])

  const handleMoveItem = useCallback(
    (itemId: string, targetFolderId: string, isFolder: boolean) => {
      if (itemId === targetFolderId) return
      if (isFolder) {
        let currentParent: string | null = targetFolderId
        while (currentParent) {
          if (currentParent === itemId) return
          const p = folders.find((f) => f.id === currentParent)
          currentParent = p?.parentId || null
        }
      }

      setRemovingIds((prev) => new Set(prev).add(itemId))

      const timer = setTimeout(() => {
        if (isFolder) {
          setFolders((prev) =>
            prev.map((f) => (f.id === itemId ? { ...f, parentId: targetFolderId } : f))
          )
        } else {
          setFiles((prev) =>
            prev.map((f) => (f.id === itemId ? { ...f, folderId: targetFolderId } : f))
          )
        }
        setRemovingIds((prev) => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
        removeTimers.current.delete(itemId)
      }, UI_CONFIG.REMOVE_ANIMATION_MS)

      removeTimers.current.set(itemId, timer)
    },
    [folders]
  )

  const applySort = useCallback(
    (field: 'name' | 'size' | 'modified', order: 'asc' | 'desc') => {
      setSort(field, order)
      const mult = order === 'asc' ? 1 : -1
      setFolders((prev) =>
        [...prev].sort((a, b) =>
          field === 'name'
            ? mult * a.encryptedName.localeCompare(b.encryptedName)
            : field === 'modified'
              ? mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
              : 0
        )
      )
      setFiles((prev) =>
        [...prev].sort((a, b) =>
          field === 'name'
            ? mult * a.encryptedName.localeCompare(b.encryptedName)
            : field === 'size'
              ? mult * (a.size - b.size)
              : field === 'modified'
                ? mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
                : 0
        )
      )
    },
    [setSort]
  )

  const handleColumnSort = useCallback(
    (field: 'name' | 'size' | 'modified') => {
      let newField: 'name' | 'size' | 'modified' | null = field
      let newOrder: 'asc' | 'desc' | null = 'asc'

      if (sortField === field) {
        if (sortOrder === 'asc') {
          newOrder = 'desc'
        } else if (sortOrder === 'desc') {
          newField = null
          newOrder = null
        }
      }

      setSort(newField, newOrder)

      if (newField && newOrder) {
        applySort(newField, newOrder)
      } else {
        setFolders((prev) =>
          [...prev].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
        )
        setFiles((prev) =>
          [...prev].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
        )
      }
    },
    [sortField, sortOrder, setSort, applySort]
  )

  const handleSelectAll = useCallback(() => {
    const isAllSelected =
      currentFiles.length + currentFolders.length > 0 &&
      [...currentFolders, ...currentFiles].every((item) => selectedIds.has(item.id))
    if (isAllSelected) clearSelection()
    else
      useUIStore
        .getState()
        .selectAll([...currentFolders.map((f) => f.id), ...currentFiles.map((f) => f.id)])
  }, [currentFiles, currentFolders, selectedIds, clearSelection])

  const handleBulkDelete = useCallback(() => {
    setFolders((prev) => prev.filter((f) => !selectedIds.has(f.id)))
    setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)))
    clearSelection()
  }, [selectedIds, clearSelection])

  const isEmpty = currentFiles.length === 0 && currentFolders.length === 0
  const hasSelection = selectedIds.size > 0
  const isAllSelected =
    currentFiles.length + currentFolders.length > 0 &&
    [...currentFolders, ...currentFiles].every((item) => selectedIds.has(item.id))

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
                    <DropdownItem onClick={() => applySort('name', 'asc')}>
                      Name (A → Z){' '}
                      {sortField === 'name' && sortOrder === 'asc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownItem onClick={() => applySort('name', 'desc')}>
                      Name (Z → A){' '}
                      {sortField === 'name' && sortOrder === 'desc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem onClick={() => applySort('modified', 'desc')}>
                      Newest first{' '}
                      {sortField === 'modified' && sortOrder === 'desc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownItem onClick={() => applySort('modified', 'asc')}>
                      Oldest first{' '}
                      {sortField === 'modified' && sortOrder === 'asc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem onClick={() => applySort('size', 'desc')}>
                      Largest first{' '}
                      {sortField === 'size' && sortOrder === 'desc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownItem onClick={() => applySort('size', 'asc')}>
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
                  onVersions={(file: FileItem) => setVersionFile(file)}
                  onShare={(item: FileItem | Folder, isFolder: boolean) =>
                    setShareTarget({
                      item,
                      isFolder,
                      itemCount: isFolder ? folderCounts[item.id] || 0 : 0,
                    })
                  }
                  removingIds={removingIds}
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
                onVersions={(file: FileItem) => setVersionFile(file)}
                onShare={(item, isFolder) =>
                  setShareTarget({
                    item,
                    isFolder,
                    itemCount: isFolder ? folderCounts[item.id] || 0 : 0,
                  })
                }
              />
            )}
          </div>
        </div>

        {previewFile && (
          <div className="bg-muted/30 flex h-full w-full flex-col overflow-hidden md:w-1/2">
            <FilePreviewDialog
              open={true}
              onOpenChange={(open: boolean) => !open && setPreviewFile(null)}
              file={previewFile}
              isFullscreen={isPreviewFullscreen}
              setIsFullscreen={setIsPreviewFullscreen}
              onRename={handleRename}
              onDelete={handleDelete}
              onShare={(file: FileItem) =>
                setShareTarget({ item: file, isFolder: false, itemCount: 0 })
              }
            />
          </div>
        )}

        <UploadDropzone
          isOpen={uploadPanelOpen}
          onClose={() => setUploadPanelOpen(false)}
          onDrop={handleUploadFiles}
        />

        {versionFile && (
          <VersionHistoryDialog
            open={!!versionFile}
            onOpenChange={() => setVersionFile(null)}
            fileName={versionFile.encryptedName}
          />
        )}

        {/* SINGLE INSTANCE OF SHARE DIALOG */}
        {shareTarget && (
          <ShareDialog
            open={!!shareTarget}
            onOpenChange={() => setShareTarget(null)}
            itemName={shareTarget.item.encryptedName}
            isFolder={shareTarget.isFolder}
            itemCount={shareTarget.itemCount}
          />
        )}

        <UploadQueue />
      </div>
    </div>
  )
}
