import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@ui/Button'
import {
  History,
  Download,
  RotateCcw,
  Upload,
  MoreVertical,
  Loader2,
  AlertCircle,
  FileWarning,
  Trash2,
} from 'lucide-react'
import { cn, formatBytes, formatRelativeDate } from '@lib/utils'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui'
import { DeleteConfirmDialog } from '@/components/ui/overlays/DeleteConfirmDialog'
import { useFileStore, selectFileById } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
import { useAuthStore } from '@stores/authStore'
import { fileService } from '@services/files/fileService'
import { useVersionUpload } from '@hooks/useVersionUpload'
import { downloadFileToDisk } from '@services/files/downloadOrchestrator'
import { QUERY_KEYS } from '@lib/constants'
import {
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
} from '@/components/ui/primitives/DropdownMenu'
import type { FileVersion } from '@/types/files'

export function VersionHistoryDialog() {
  const versionFileId = useFileStore((s) => s.versionFileId)
  const setVersionFileId = useFileStore((s) => s.setVersionFileId)
  const file = useFileStore(selectFileById(versionFileId))

  const queryClient = useQueryClient()
  const closePreview = usePreviewStore((s) => s.close)

  const [versions, setVersions] = useState<FileVersion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileVersion | null>(null)

  const { uploadState, uploadVersion, resetUpload } = useVersionUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOpen = !!versionFileId

  const fetchVersions = useCallback(async (fileId: string) => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await fileService.listVersions(fileId)
      setVersions(data)
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load version history.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (versionFileId) {
      setVersions([])
      setLoadError(null)
      fetchVersions(versionFileId)
    }
  }, [versionFileId, fetchVersions])

  const handleClose = () => {
    setVersionFileId(null)
    resetUpload()
    setVersions([])
    setLoadError(null)
  }

  const handleFileSelected = async (selectedFile: File) => {
    if (!versionFileId) return
    try {
      await uploadVersion(selectedFile, versionFileId)
      await fetchVersions(versionFileId)

      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.DETAIL, versionFileId] })
      closePreview()

      toast.success('New version uploaded successfully.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload new version.')
    }
  }

  const handleRestore = async (versionId: string) => {
    if (!versionFileId) return
    setRestoringId(versionId)
    try {
      await fileService.restoreVersion(versionFileId, versionId)
      await fetchVersions(versionFileId)

      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.DETAIL, versionFileId] })
      closePreview()

      toast.success('Version restored successfully.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore version.')
    } finally {
      setRestoringId(null)
    }
  }

  const handleDownload = async (version: FileVersion) => {
    if (!versionFileId || !file) return
    setDownloadingId(version.version_id)
    try {
      const dek = useAuthStore.getState().cryptoState.dek
      if (!dek) throw new Error('Vault is locked.')

      await downloadFileToDisk(file.name, version.total_size, {
        dek,
        fileId: versionFileId,
        versionId: version.version_id,
      })
      toast.success('Download started.')
    } catch (err: any) {
      if (err?.code === 'CANCELLED' || err?.name === 'AbortError') return
      toast.error(err.message || 'Download failed.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!versionFileId || !deleteTarget) return
    setDeletingId(deleteTarget.version_id)
    try {
      await fileService.deleteVersion(versionFileId, deleteTarget.version_id)
      await fetchVersions(versionFileId)
      toast.success('Version deleted permanently.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete version.')
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  if (!isOpen || !file) return null

  const isUploading =
    uploadState.status === 'preparing' ||
    uploadState.status === 'uploading' ||
    uploadState.status === 'completing'

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="text-muted-foreground h-4 w-4" />
            Version history
          </DialogTitle>
          <DialogDescription className="truncate">{file.name}</DialogDescription>
        </DialogHeader>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0]
            if (selected) handleFileSelected(selected)
            e.target.value = ''
          }}
        />

        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full gap-2 rounded-lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? 'Uploading...' : 'Upload new version'}
          </Button>

          {isUploading && (
            <div className="mt-3 space-y-1.5">
              <div className="bg-primary/10 relative h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
              <p className="text-muted-foreground text-center text-[11px]">
                {uploadState.status === 'preparing' && 'Encrypting file...'}
                {uploadState.status === 'uploading' &&
                  `Uploading chunks... ${uploadState.progress}%`}
                {uploadState.status === 'completing' && 'Finalizing upload...'}
              </p>
            </div>
          )}

          {uploadState.status === 'error' && uploadState.error && (
            <div className="border-destructive/20 bg-destructive/5 text-destructive mt-3 flex items-center gap-2 rounded-lg border p-2.5 text-[12px]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{uploadState.error}</span>
            </div>
          )}
        </div>

        <div className="-mx-2 mt-4 max-h-[400px] space-y-1 overflow-y-auto px-2">
          {isLoading && (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              <p className="text-muted-foreground text-[12px]">Loading versions...</p>
            </div>
          )}

          {!isLoading && loadError && (
            <div className="text-destructive flex flex-col items-center gap-2 py-8">
              <AlertCircle className="h-8 w-8" />
              <p className="text-[13px] font-medium">{loadError}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => versionFileId && fetchVersions(versionFileId)}
              >
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !loadError && versions.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8">
              <FileWarning className="h-8 w-8 opacity-50" />
              <p className="text-[13px]">No versions found.</p>
            </div>
          )}

          {!isLoading &&
            !loadError &&
            versions.map((v) => (
              <div
                key={v.version_id}
                className={cn(
                  'flex items-center justify-between rounded-lg border p-3 transition-colors',
                  v.is_active
                    ? 'border-primary/20 bg-primary/[0.03]'
                    : 'border-border/60 hover:bg-accent/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold',
                      v.is_active
                        ? 'bg-primary/10 text-primary'
                        : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    v{v.version_number}
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-[13px] font-medium">
                      {v.is_active && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-emerald-600 uppercase">
                          Current
                        </span>
                      )}
                      {formatRelativeDate(v.created_at)}
                    </p>
                    <p className="text-muted-foreground/70 text-[11px]">
                      {formatBytes(v.total_size)} • {v.total_chunks} chunks
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {!v.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg text-[12px]"
                      onClick={() => handleRestore(v.version_id)}
                      disabled={restoringId === v.version_id}
                    >
                      {restoringId === v.version_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Restore
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-lg"
                    onClick={() => handleDownload(v)}
                    disabled={downloadingId === v.version_id}
                    title="Download this version"
                  >
                    {downloadingId === v.version_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>

                  <DropdownMenu
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-lg"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    }
                  >
                    <DropdownItem
                      icon={<Download className="h-4 w-4" />}
                      onClick={() => handleDownload(v)}
                    >
                      Download
                    </DropdownItem>
                    {!v.is_active && (
                      <>
                        <DropdownSeparator />
                        <DropdownItem
                          icon={<RotateCcw className="h-4 w-4" />}
                          onClick={() => handleRestore(v.version_id)}
                        >
                          Restore
                        </DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem
                          icon={<Trash2 className="h-4 w-4" />}
                          destructive
                          onClick={() => setDeleteTarget(v)}
                          disabled={deletingId === v.version_id}
                        >
                          Delete Permanently
                        </DropdownItem>
                      </>
                    )}
                  </DropdownMenu>
                </div>
              </div>
            ))}
        </div>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={`Version ${deleteTarget?.version_number}`}
        isFolder={false}
        isPermanent
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}
