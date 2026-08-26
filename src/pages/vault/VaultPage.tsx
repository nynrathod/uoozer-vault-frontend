import { useCallback, useRef, useState } from 'react'
import { useParams, useNavigate, generatePath, useLocation } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { usePreviewStore } from '@stores/previewStore'
import {
  useFileStore,
  selectCurrentFiles,
  selectCurrentFolders,
  selectFolderCounts,
} from '@stores/fileStore'
import { QUERY_KEYS, ROUTES } from '@lib/constants'
import { cn } from '@lib/utils'
import { Lock, Star, Trash2, Upload } from 'lucide-react'

import { FileGrid } from '@/components/features/vault/fileList/FileGrid'
import { FileList } from '@/components/features/vault/fileList/FileList'
import { FileBreadcrumb } from '@/components/features/vault/fileList/FileBreadcrumb'
import { EmptyState } from '@/components/ui/feedback/EmptyState'
import { FilePreviewDialog } from '@/components/ui/overlays/FilePreviewDialog'
import { ShareDialog } from '@/components/ui/overlays/ShareDialog'
import { VersionHistoryDialog } from '@/components/ui/overlays/VersionHistoryDialog'
import { VaultToolbar } from '@/components/features/vault/VaultToolbar'
import { useVaultFiles } from '@hooks/useVaultFiles'
import { useFileUpload } from '@hooks/useFileUpload'
import { useQueryClient } from '@tanstack/react-query'
import type { Folder } from '@/types/folders'
import { UploadQueue } from '@/components/features'
import { VaultSkeleton } from '@/components/features/vault/fileList/VaultSkeleton'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { toast } from 'sonner'
import { ComingSoon } from '@/components/ui/feedback'

// Helper to recursively read dropped folders (for drag-and-drop)
function readAllEntries(dirReader: any): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const allEntries: any[] = []
    const readEntries = () => {
      dirReader.readEntries((entries: any[]) => {
        if (entries.length === 0) resolve(allEntries)
        else {
          allEntries.push(...entries)
          readEntries()
        }
      }, reject)
    }
    readEntries()
  })
}

async function traverseFileTree(item: any, path: string): Promise<File[]> {
  if (item.isFile) {
    return new Promise((resolve) => {
      item.file((file: File) => {
        // @ts-ignore
        file.path = path + file.name
        resolve([file])
      })
    })
  } else if (item.isDirectory) {
    const dirReader = item.createReader()
    const entries = await readAllEntries(dirReader)
    const promises = entries.map((entry) => traverseFileTree(entry, path + item.name + '/'))
    const results = await Promise.all(promises)
    return results.flat()
  }
  return []
}

export function VaultPage({ trashed = false }: { trashed?: boolean }) {
  const { folderId } = useParams<{ folderId?: string }>()
  const location = useLocation()
  const isTrash = location.pathname.startsWith('/vault/trash')
  const isStarred = location.pathname === ROUTES.VAULT_STARRED
  const isPrivate = location.pathname === ROUTES.VAULT_PRIVATE
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const currentFolderId = folderId || null

  const previewFileId = usePreviewStore((s) => s.fileId)
  const openPreview = usePreviewStore((s) => s.open)
  const isPreviewOpen = usePreviewStore((s) => !!s.fileId)
  const isTrashRoute = location.pathname === ROUTES.VAULT_TRASH
  const { isLoading, isError, error, refresh, breadcrumbPath } = useVaultFiles(
    currentFolderId,
    trashed
  )
  const { uploadFiles } = useFileUpload()

  const files = useFileStore(useShallow(selectCurrentFiles))
  const folders = useFileStore(useShallow(selectCurrentFolders))
  const folderCounts = useFileStore(useShallow(selectFolderCounts))

  const shareTargetId = useFileStore((s) => s.shareTargetId)
  const versionFileId = useFileStore((s) => s.versionFileId)
  const viewMode = useFileStore((s) => s.viewMode)
  const setShareTarget = useFileStore((s) => s.setShareTarget)
  const setVersionFileId = useFileStore((s) => s.setVersionFileId)
  const toggleFileSelection = useFileStore((s) => s.toggleFileSelection)
  const editingId = useFileStore((s) => s.editingId)
  const setEditingId = useFileStore((s) => s.setEditingId)

  const sharedItem = useFileStore((s) =>
    s.shareTargetId ? s.files.get(s.shareTargetId) || s.folders.get(s.shareTargetId) : null
  )
  const isSharedItemFolder = useFileStore((s) =>
    s.shareTargetId ? s.folders.has(s.shareTargetId) : false
  )

  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleNewFolder = useCallback(() => {
    const tempId = `temp-${crypto.randomUUID()}`
    const newFolder: Folder = {
      id: tempId,
      uid: tempId,
      parentId: currentFolderId,
      name: 'Untitled Folder',
      encryptedMetadata: '',
      metadataNonce: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    queryClient.setQueryData<Folder[]>(
      [QUERY_KEYS.FOLDERS.LIST, currentFolderId, false],
      (old = []) => [newFolder, ...old]
    )

    setEditingId(tempId)
  }, [currentFolderId, queryClient, setEditingId])

  const showSkeleton = useDelayedLoading(isLoading, 300)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      // @ts-ignore
      files.forEach((f) => (f.path = ''))
      uploadFiles(files, currentFolderId)
      e.target.value = ''
    }
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      // @ts-ignore
      files.forEach((f) => (f.path = f.webkitRelativePath || ''))
      uploadFiles(files, currentFolderId)
      e.target.value = ''
    }
  }

  const handleFolderClick = (folder: Folder) => {
    if (trashed) {
      toast.info('Restore this folder to your Vault to view its contents.')
      return
    }

    navigate(generatePath(ROUTES.VAULT_FOLDER, { folderId: folder.id }))
  }

  const handleBreadcrumbClick = (id: string | null) => {
    if (!id) {
      navigate(trashed ? ROUTES.VAULT_TRASH : ROUTES.VAULT)
    } else {
      const route = trashed ? ROUTES.VAULT_TRASH_FOLDER : ROUTES.VAULT_FOLDER
      navigate(generatePath(route, { folderId: id }))
    }
  }

  const dragCounter = useRef(0)

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (isTrash) return

      // Only trigger for files dragged from the OS, not internal vault items
      const isFileDrag = Array.from(e.dataTransfer.types).includes('Files')
      if (!isFileDrag) return

      e.preventDefault()
      e.stopPropagation()
      dragCounter.current++
      if (dragCounter.current === 1) {
        setIsDragging(true)
      }
    },
    [isTrash]
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (isTrash) return
      const isFileDrag = Array.from(e.dataTransfer.types).includes('Files')
      if (!isFileDrag) return

      e.preventDefault()
      e.stopPropagation()
      dragCounter.current--
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsDragging(false)
      }
    },
    [isTrash]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (isTrash) return
      // Prevent default to allow drop
      e.preventDefault()
      e.stopPropagation()
    },
    [isTrash]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (isTrash) return
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current = 0
      setIsDragging(false) // Hide overlay immediately

      const items = e.dataTransfer.items
      const files: File[] = []

      if (items && items.length > 0) {
        const promises: Promise<File[]>[] = []
        for (let i = 0; i < items.length; i++) {
          const item = (items[i] as any).webkitGetAsEntry?.()
          if (item) {
            promises.push(traverseFileTree(item, ''))
          }
        }
        const results = await Promise.all(promises)
        results.forEach((res) => files.push(...res))
      } else if (e.dataTransfer.files) {
        Array.from(e.dataTransfer.files).forEach((f) => {
          // @ts-ignore
          f.path = ''
          files.push(f)
        })
      }

      if (files.length > 0) {
        uploadFiles(files, currentFolderId)
      }
    },
    [uploadFiles, currentFolderId, isTrash]
  )

  if (isStarred) {
    return (
      <div className="bg-background flex h-full w-full flex-col">
        <ComingSoon
          icon={Star}
          title="Starred Items"
          description="Quick access to your favorite and most important files is coming soon."
        />
      </div>
    )
  }

  if (isPrivate) {
    return (
      <div className="bg-background flex h-full w-full flex-col">
        <ComingSoon
          icon={Lock}
          title="Private Files"
          description="A secure enclave for your most sensitive documents is currently under construction."
        />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-destructive text-sm font-medium">
          {error instanceof Error ? error.message : 'Failed to load vault'}
        </p>
        <button onClick={refresh} className="text-primary mt-4 text-sm font-medium hover:underline">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div
      className="bg-background relative flex h-full overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        ref={folderInputRef}
        className="hidden"
        onChange={handleFolderSelect}
      />

      <div className="bg-background relative flex h-full w-full overflow-hidden">
        <div
          className={cn(
            'flex h-full flex-col overflow-hidden',
            previewFileId ? 'hidden md:flex md:w-1/2 md:border-r' : 'w-full'
          )}
        >
          <FileBreadcrumb path={breadcrumbPath} onNavigate={handleBreadcrumbClick} />
          <VaultToolbar
            onUploadFiles={() => fileInputRef.current?.click()}
            onUploadFolder={() => folderInputRef.current?.click()}
            onNewFolder={handleNewFolder}
          />

          <div className="relative flex-1 overflow-hidden">
            {showSkeleton ? (
              <VaultSkeleton viewMode={viewMode} />
            ) : isLoading ? (
              <div className="bg-background h-full w-full"></div>
            ) : files.length === 0 && folders.length === 0 ? (
              isTrash ? (
                <EmptyState
                  icon={Trash2}
                  title="Trash is empty"
                  description="Items moved to trash will appear here."
                  hideAction
                />
              ) : (
                <EmptyState />
              )
            ) : viewMode === 'list' ? (
              <div className="h-full overflow-auto">
                <FileList
                  files={files}
                  folders={folders}
                  folderCounts={folderCounts}
                  onFolderClick={handleFolderClick}
                  onFileClick={(file) => openPreview(file.id)}
                  onFileSelect={toggleFileSelection}
                  onShare={(item) => setShareTarget(item.id)}
                />
              </div>
            ) : (
              <FileGrid files={files} folders={folders} folderCounts={folderCounts} />
            )}
          </div>
        </div>

        {isPreviewOpen && (
          <div className="bg-muted/30 flex h-full w-full flex-col overflow-hidden md:w-1/2">
            <FilePreviewDialog />
          </div>
        )}

        {versionFileId && <VersionHistoryDialog />}

        {shareTargetId && sharedItem && (
          <ShareDialog
            open={!!shareTargetId}
            onOpenChange={(open) => {
              if (!open) useFileStore.getState().setShareTarget(null)
            }}
            item={sharedItem}
          />
        )}
      </div>

      {isDragging && (
        <div
          className="bg-background/50 animate-fade-in absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 backdrop-blur-[3px]"
          onClick={() => {
            dragCounter.current = 0
            setIsDragging(false)
          }}
        >
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="border-primary/20 absolute inset-0 animate-ping rounded-full border-2"></div>
            <div className="bg-primary text-primary-foreground shadow-primary/20 relative flex h-16 w-16 scale-100 items-center justify-center rounded-full shadow-xl transition-transform duration-200">
              <Upload className="h-8 w-8" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-foreground text-lg font-semibold tracking-tight">Drop to upload</p>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm">
              Files are encrypted locally before upload
            </p>
          </div>
        </div>
      )}
      <UploadQueue />
    </div>
  )
}
