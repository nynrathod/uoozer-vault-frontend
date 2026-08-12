import { useState } from 'react'
import { Download, Edit3, Copy, Move, Trash2, History, Eye, Star } from 'lucide-react'
import { DropdownMenu, DropdownItem, DropdownSeparator } from '@ui/DropdownMenu'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'
import { DeleteConfirmDialog } from '@/components/ui/overlays/DeleteConfirmDialog'

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

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={item.encryptedName}
        isFolder={isFolder}
        onConfirm={() => {
          onDelete?.()
          setDeleteOpen(false)
        }}
      />
    </>
  )
}
