import { memo, useState } from 'react'
import { DropdownMenu, DropdownItem, DropdownSeparator } from '@ui/DropdownMenu'
import { Download, Share2, Edit3, Copy, Trash2, History, Eye, Check, RotateCcw } from 'lucide-react'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'
import { DeleteConfirmDialog } from '@/components/ui/overlays/DeleteConfirmDialog'

interface FileActionsMenuProps {
  item: FileItem | Folder
  isFolder: boolean
  onRenameRequest: () => void
  onDelete: () => void
  onRestore?: () => void
  onDownload: () => void
  onShare: () => void
  trigger: React.ReactNode
  copied: boolean
  onCopyLink: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onVersions?: () => void
}

export const FileActionsMenu = memo(function FileActionsMenu({
  item,
  isFolder,
  onRenameRequest,
  onDelete,
  onRestore,
  onDownload,
  onShare,
  trigger,
  copied,
  onCopyLink,
  open,
  onOpenChange,
  onVersions,
}: FileActionsMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isTrash = !!item.deletedAt
  return (
    <>
      <DropdownMenu trigger={trigger} open={open} onOpenChange={onOpenChange}>
        {isTrash ? (
          // --- TRASH VIEW MENU ---
          <>
            <DropdownItem icon={<RotateCcw className="h-4 w-4" />} onClick={onRestore}>
              Restore
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              icon={<Trash2 className="h-4 w-4" />}
              destructive
              onClick={() => setDeleteOpen(true)}
            >
              Delete Forever
            </DropdownItem>
          </>
        ) : (
          // --- NORMAL VIEW MENU ---
          <>
            {!isFolder && <DropdownItem icon={<Eye className="h-4 w-4" />}>Preview</DropdownItem>}
            <DropdownItem icon={<Download className="h-4 w-4" />} onClick={onDownload}>
              Download
            </DropdownItem>
            <DropdownItem icon={<Edit3 className="h-4 w-4" />} onClick={onRenameRequest}>
              Rename
            </DropdownItem>
            <DropdownItem
              icon={
                copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )
              }
              preventClose
              onClick={onCopyLink}
            >
              {copied ? 'Copied!' : 'Copy link'}
            </DropdownItem>
            {!isFolder && (
              <>
                <DropdownSeparator />
                <DropdownItem icon={<History className="h-4 w-4" />} onClick={onVersions}>
                  Version history
                </DropdownItem>
              </>
            )}
            <DropdownSeparator />
            <DropdownItem icon={<Share2 className="h-4 w-4" />} onClick={onShare}>
              Manage permissions
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              icon={<Trash2 className="h-4 w-4" />}
              destructive
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </DropdownItem>
          </>
        )}
      </DropdownMenu>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={item.name}
        isFolder={isFolder}
        isPermanent={isTrash} // Use red warning text for permanent delete
        onConfirm={() => {
          onDelete()
          setDeleteOpen(false)
        }}
      />
    </>
  )
})
