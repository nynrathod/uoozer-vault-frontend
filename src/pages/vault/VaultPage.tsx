import { useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useUIStore } from '@stores/uiStore'
import { useUploadStore } from '@stores/uploadStore'
import {
  useFileStore,
  selectCurrentFiles,
  selectCurrentFolders,
  selectBreadcrumbPath,
  selectFolderCounts,
} from '@stores/fileStore'
import { QUERY_KEYS, ROUTES, UPLOAD_CONFIG } from '@lib/constants'
import { cn } from '@lib/utils'

import { FileGrid } from '@/components/features/vault/file-list/FileGrid'
import { FileList } from '@/components/features/vault/file-list/FileList'
import { FileBreadcrumb } from '@/components/features/vault/file-list/FileBreadcrumb'
import { EmptyState } from '@/components/features/vault/file-list/EmptyState'
import { UploadDropzone } from '@/components/features/vault/upload/UploadDropzone'
import { UploadQueue } from '@/components/features/vault/upload/UploadQueue'
import { FilePreviewDialog } from '@/components/ui/overlays/FilePreviewDialog'
import { ShareDialog } from '@/components/ui/overlays/ShareDialog'
import { VersionHistoryDialog } from '@/components/ui/overlays/VersionHistoryDialog'
import { VaultLoader } from '@/components/ui/feedback/VaultLoader'
import { VaultToolbar } from '@/components/features/vault/VaultToolbar'

export function VaultPage() {
  const { folderId } = useParams<{ folderId?: string }>()
  const navigate = useNavigate()
  const currentFolderId = folderId || null

  const uploadPanelOpen = useUIStore((s) => s.uploadPanelOpen)
  const setUploadPanelOpen = useUIStore((s) => s.setUploadPanelOpen)

  const files = useFileStore(selectCurrentFiles)
  const folders = useFileStore(selectCurrentFolders)
  const breadcrumbPath = useFileStore(selectBreadcrumbPath)
  const folderCounts = useFileStore(selectFolderCounts)

  const currentFolderIdState = useFileStore((s) => s.currentFolderId)
  const setCurrentFolderId = useFileStore((s) => s.setCurrentFolderId)
  const previewFileId = useFileStore((s) => s.previewFileId)
  const shareTargetId = useFileStore((s) => s.shareTargetId)
  const versionFileId = useFileStore((s) => s.versionFileId)

  const setPreviewFile = useFileStore((s) => s.setPreviewFile)
  const setShareTarget = useFileStore((s) => s.setShareTarget)
  const setVersionFileId = useFileStore((s) => s.setVersionFileId)
  const toggleFileSelection = useFileStore((s) => s.toggleFileSelection)
  const selectedFileIds = useFileStore((s) => s.selectedFileIds)

  // Derive the shared item object from the ID
  const sharedItem = useFileStore((s) =>
    s.shareTargetId ? s.files.get(s.shareTargetId) || s.folders.get(s.shareTargetId) : null
  )
  const isSharedItemFolder = useFileStore((s) =>
    s.shareTargetId ? s.folders.has(s.shareTargetId) : false
  )

  const { isLoading } = useQuery({
    queryKey: [QUERY_KEYS.FILES.LIST, folderId],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300))
      return true
    },
  })

  useEffect(() => {
    if (currentFolderIdState !== currentFolderId) {
      setCurrentFolderId(currentFolderId)
    }
  }, [currentFolderId, currentFolderIdState, setCurrentFolderId])

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

  return (
    <div className="bg-background relative flex h-full overflow-hidden">
      <div className="bg-background relative flex h-full w-full overflow-hidden">
        <div
          className={cn(
            'flex h-full flex-col overflow-hidden',
            previewFileId ? 'hidden md:flex md:w-1/2 md:border-r' : 'w-full'
          )}
        >
          <FileBreadcrumb
            path={breadcrumbPath}
            onNavigate={(id) =>
              id === null ? navigate(ROUTES.VAULT) : navigate(`/vault/folder/${id}`)
            }
          />
          <VaultToolbar files={files} folders={folders} onUpload={() => setUploadPanelOpen(true)} />

          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <VaultLoader size={48} />
              </div>
            ) : files.length === 0 && folders.length === 0 ? (
              <EmptyState onUpload={() => setUploadPanelOpen(true)} />
            ) : useFileStore.getState().viewMode === 'list' ? (
              <div className="h-full overflow-auto">
                <FileList
                  files={files}
                  folders={folders}
                  folderCounts={folderCounts}
                  onFolderClick={(folder) => navigate(`/vault/folder/${folder.id}`)}
                  onFileClick={(file) => setPreviewFile(file.id)}
                  onFileSelect={toggleFileSelection}
                  selectedIds={selectedFileIds}
                  onShare={(item) => setShareTarget(item.id)}
                />
              </div>
            ) : (
              <FileGrid files={files} folders={folders} folderCounts={folderCounts} />
            )}
          </div>
        </div>

        {previewFileId && (
          <div className="bg-muted/30 flex h-full w-full flex-col overflow-hidden md:w-1/2">
            <FilePreviewDialog fileId={previewFileId} />
          </div>
        )}

        <UploadDropzone
          isOpen={uploadPanelOpen}
          onClose={() => setUploadPanelOpen(false)}
          onDrop={handleUploadFiles}
        />

        {versionFileId && (
          <VersionHistoryDialog
            open={!!versionFileId}
            onOpenChange={() => setVersionFileId(null)}
            fileName={useFileStore.getState().files.get(versionFileId)?.encryptedName || ''}
          />
        )}

        {shareTargetId && sharedItem && (
          <ShareDialog
            open={!!shareTargetId}
            onOpenChange={() => setShareTarget(null)}
            itemName={sharedItem.encryptedName}
            isFolder={isSharedItemFolder}
            itemCount={isSharedItemFolder ? folderCounts[shareTargetId] || 0 : 0}
          />
        )}

        <UploadQueue />
      </div>
    </div>
  )
}
