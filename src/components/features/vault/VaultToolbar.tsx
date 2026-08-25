import {
  ArrowUpDown,
  FolderPlus,
  Upload,
  FileUp,
  FolderUp,
  List,
  LayoutGrid,
  Download,
  Trash2,
  X,
  Check,
  ChevronDown,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useFileStore } from '@stores/fileStore'
import { useVaultActions } from '@hooks/useVaultActions'
import { useAuthStore } from '@stores/authStore'
import { downloadItemsAsZip } from '@services/files/downloadOrchestrator'
import { Button } from '@ui/Button'
import { DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel } from '@ui/DropdownMenu'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/Dialog'

interface VaultToolbarProps {
  onUploadFiles: () => void
  onUploadFolder: () => void
  onNewFolder: () => void
}

export function VaultToolbar({ onUploadFiles, onUploadFolder, onNewFolder }: VaultToolbarProps) {
  const location = useLocation()
  const isTrash = location.pathname.startsWith('/vault/trash')

  const files = useFileStore((s) => s.files)
  const folders = useFileStore((s) => s.folders)
  const selectedFileIds = useFileStore((s) => s.selectedFileIds)
  const clearFileSelection = useFileStore((s) => s.clearSelection)
  const sortField = useFileStore((s) => s.sortField)
  const sortOrder = useFileStore((s) => s.sortOrder)
  const setSort = useFileStore((s) => s.setSort)
  const viewMode = useFileStore((s) => s.viewMode)
  const toggleViewMode = useFileStore((s) => s.toggleViewMode)

  const { bulkDelete, isDeleting, emptyTrash, isEmptyingTrash, restoreItem } = useVaultActions()
  const dek = useAuthStore((s) => s.cryptoState.dek)

  const hasSelection = selectedFileIds.size > 0
  const itemCount = useMemo(() => files.size + folders.size, [files, folders])

  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false)
  const [deleteForeverDialogOpen, setDeleteForeverDialogOpen] = useState(false)

  const handleBulkDelete = useCallback(() => {
    if (isTrash) {
      setDeleteForeverDialogOpen(true)
      return
    }
    const items = Array.from(selectedFileIds).map((id) => ({
      id,
      isFolder: folders.has(id),
      permanent: false,
    }))
    bulkDelete(items)
    clearFileSelection()
  }, [selectedFileIds, bulkDelete, folders, clearFileSelection, isTrash])

  const handleRestoreSelected = useCallback(() => {
    selectedFileIds.forEach((id) => {
      restoreItem({ id, isFolder: folders.has(id) })
    })
    clearFileSelection()
  }, [selectedFileIds, restoreItem, folders, clearFileSelection])

  const handleConfirmDeleteForever = useCallback(() => {
    const items = Array.from(selectedFileIds).map((id) => ({
      id,
      isFolder: folders.has(id),
      permanent: true,
    }))
    bulkDelete(items)
    clearFileSelection()
    setDeleteForeverDialogOpen(false)
  }, [selectedFileIds, bulkDelete, folders, clearFileSelection])

  const handleConfirmEmptyTrash = useCallback(() => {
    emptyTrash()
    setEmptyTrashDialogOpen(false)
    toast.success('Trash emptied successfully.')
  }, [emptyTrash])

  const handleBulkDownload = useCallback(async () => {
    if (isTrash) return
    const selectedItems = Array.from(selectedFileIds).map((id) => {
      const folder = folders.get(id)
      const file = files.get(id)
      return folder
        ? { id, name: folder.name, isFolder: true, size: 0 }
        : { id, name: file!.name, isFolder: false, size: file!.totalSize }
    })

    if (selectedItems.length === 0) return

    toast.loading('Preparing bulk download...', { id: 'bulk-dl' })
    try {
      if (!dek) throw new Error('Vault is locked')
      await downloadItemsAsZip(selectedItems, dek)
      toast.success('Bulk download started', { id: 'bulk-dl' })
    } catch (error: any) {
      if (error?.code === 'CANCELLED' || error?.name === 'AbortError') {
        toast.dismiss('bulk-dl')
        return
      }
      toast.error(error.message ?? 'Bulk download failed', { id: 'bulk-dl' })
    } finally {
      clearFileSelection()
    }
  }, [selectedFileIds, files, folders, dek, clearFileSelection, isTrash])

  return (
    <>
      <div className="border-border/60 flex h-[52px] shrink-0 items-center justify-between border-b px-4 py-2">
        {hasSelection ? (
          <div className="animate-fade-in flex w-full items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 rounded-lg"
                onClick={clearFileSelection}
              >
                <X className="h-4 w-4" />
              </Button>
              <span className="text-[13px] font-medium">{selectedFileIds.size} selected</span>
            </div>
            <div className="flex items-center gap-1">
              {isTrash ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 rounded-lg text-[13px]"
                    onClick={handleRestoreSelected}
                  >
                    <RotateCcw className="h-4 w-4" />{' '}
                    <span className="hidden sm:inline">Restore</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 h-8 gap-1.5 rounded-lg text-[13px]"
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />{' '}
                    <span className="hidden sm:inline">Delete Forever</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 rounded-lg text-[13px]"
                    onClick={handleBulkDownload}
                  >
                    <Download className="h-4 w-4" />{' '}
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 h-8 gap-1.5 rounded-lg text-[13px]"
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {isTrash ? (
                itemCount > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1.5 rounded-lg px-3 text-[13px] font-medium"
                    onClick={() => setEmptyTrashDialogOpen(true)}
                    disabled={isEmptyingTrash}
                  >
                    {isEmptyingTrash ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Empty Trash
                  </Button>
                )
              ) : (
                <>
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
                    <DropdownItem onClick={() => setSort('name', 'asc')}>
                      Name (A → Z){' '}
                      {sortField === 'name' && sortOrder === 'asc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownItem onClick={() => setSort('name', 'desc')}>
                      Name (Z → A){' '}
                      {sortField === 'name' && sortOrder === 'desc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem onClick={() => setSort('modified', 'desc')}>
                      Newest first{' '}
                      {sortField === 'modified' && sortOrder === 'desc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownItem onClick={() => setSort('modified', 'asc')}>
                      Oldest first{' '}
                      {sortField === 'modified' && sortOrder === 'asc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem onClick={() => setSort('size', 'desc')}>
                      Largest first{' '}
                      {sortField === 'size' && sortOrder === 'desc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                    <DropdownItem onClick={() => setSort('size', 'asc')}>
                      Smallest first{' '}
                      {sortField === 'size' && sortOrder === 'asc' && (
                        <Check className="ml-auto h-3.5 w-3.5" />
                      )}
                    </DropdownItem>
                  </DropdownMenu>
                  <span className="text-muted-foreground/60 hidden text-xs sm:inline">
                    {itemCount} items
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1">
              {!isTrash && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-foreground text-background hover:bg-foreground/90 h-8 gap-1.5 rounded-lg px-3 text-[13px] font-medium"
                    onClick={onNewFolder}
                  >
                    <FolderPlus className="h-4 w-4" strokeWidth={2.5} /> New Folder
                  </Button>

                  <DropdownMenu
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border hover:bg-secondary h-8 gap-1.5 rounded-lg px-3 text-[13px] font-medium"
                      >
                        <Upload className="h-4 w-4" /> Upload <ChevronDown className="h-3 w-3" />
                      </Button>
                    }
                  >
                    <DropdownItem icon={<FileUp className="h-4 w-4" />} onClick={onUploadFiles}>
                      Upload Files
                    </DropdownItem>
                    <DropdownItem icon={<FolderUp className="h-4 w-4" />} onClick={onUploadFolder}>
                      Upload Folder
                    </DropdownItem>
                  </DropdownMenu>
                </>
              )}

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

      <Dialog open={emptyTrashDialogOpen} onOpenChange={setEmptyTrashDialogOpen}>
        <DialogHeader>
          <DialogTitle>Empty Trash</DialogTitle>
          <DialogDescription>
            This will permanently delete all files and folders in your trash. This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            className="rounded-lg"
            onClick={() => setEmptyTrashDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="destructive" className="rounded-lg" onClick={handleConfirmEmptyTrash}>
            Empty Trash
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteForeverDialogOpen} onOpenChange={setDeleteForeverDialogOpen}>
        <DialogHeader>
          <DialogTitle>Delete Forever</DialogTitle>
          <DialogDescription>
            This will permanently delete {selectedFileIds.size} item
            {selectedFileIds.size !== 1 ? 's' : ''}. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            className="rounded-lg"
            onClick={() => setDeleteForeverDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="destructive" className="rounded-lg" onClick={handleConfirmDeleteForever}>
            Delete Forever
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
