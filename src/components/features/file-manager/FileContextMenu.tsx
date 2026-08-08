import { useState } from 'react'
import { Download, Edit3, Copy, Move, Trash2, History, Eye, Star } from 'lucide-react'
import { DropdownMenu, DropdownItem, DropdownSeparator } from '@ui/DropdownMenu'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/Dialog'
import { Button } from '@ui/Button'
import type { FileItem } from '@/types/filtes'
import type { Folder } from '@/types/folders'

interface FileContextMenuProps {
  children: React.ReactNode
  item: FileItem | Folder
  isFolder: boolean
  onDownload?: () => void
  onRename?: () => void
  onDelete?: () => void
  onMove?: () => void
  onPreview?: () => void
  onVersions?: () => void
}

export function FileContextMenu({
  children,
  item,
  isFolder,
  onDownload,
  onRename,
  onDelete,
  onMove,
  onPreview,
  onVersions,
}: FileContextMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu trigger={children}>
        {!isFolder && onPreview && (
          <DropdownItem icon={<Eye className="h-4 w-4" />} onClick={onPreview}>
            Preview
          </DropdownItem>
        )}
        {!isFolder && onDownload && (
          <DropdownItem icon={<Download className="h-4 w-4" />} onClick={onDownload}>
            Download
          </DropdownItem>
        )}
        <DropdownItem icon={<Edit3 className="h-4 w-4" />} onClick={onRename}>
          Rename
        </DropdownItem>
        <DropdownItem icon={<Copy className="h-4 w-4" />}>Copy</DropdownItem>
        <DropdownItem icon={<Move className="h-4 w-4" />} onClick={onMove}>
          Move to
        </DropdownItem>
        <DropdownItem icon={<Star className="h-4 w-4" />}>Add to starred</DropdownItem>
        {!isFolder && onVersions && (
          <>
            <DropdownSeparator />
            <DropdownItem icon={<History className="h-4 w-4" />} onClick={onVersions}>
              Version history
            </DropdownItem>
          </>
        )}
        <DropdownSeparator />
        <DropdownItem
          icon={<Trash2 className="h-4 w-4" />}
          destructive
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </DropdownItem>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogHeader>
          <DialogTitle>Delete {isFolder ? 'folder' : 'file'}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "
            {isFolder ? (item as Folder).encryptedName : (item as FileItem).encryptedName}"? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" className="rounded-lg" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="rounded-lg"
            onClick={() => {
              onDelete?.()
              setDeleteOpen(false)
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
