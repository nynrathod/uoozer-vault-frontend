import { useState } from 'react'
import { DropdownMenu, DropdownItem, DropdownSeparator } from '@ui/DropdownMenu'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/Dialog'
import { Button } from '@ui/Button'
import {
  Download,
  Share2,
  Edit3,
  Copy,
  Move,
  Trash2,
  History,
  Eye,
  Star,
  Check,
} from 'lucide-react'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

interface FileActionsMenuProps {
  item: FileItem | Folder
  isFolder: boolean
  onRenameRequest: (id: string) => void
  onDelete: (id: string, isFolder: boolean) => void
  onShare: () => void
  trigger: React.ReactNode
  copied: boolean
  onCopyLink: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onVersions?: () => void
}

export function FileActionsMenu({
  item,
  isFolder,
  onRenameRequest,
  onDelete,
  onShare,
  trigger,
  copied,
  onCopyLink,
  open,
  onOpenChange,
  onVersions,
}: FileActionsMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu trigger={trigger} open={open} onOpenChange={onOpenChange}>
        {!isFolder && <DropdownItem icon={<Eye className="h-4 w-4" />}>Preview</DropdownItem>}
        {!isFolder && <DropdownItem icon={<Download className="h-4 w-4" />}>Download</DropdownItem>}
        <DropdownItem icon={<Edit3 className="h-4 w-4" />} onClick={() => onRenameRequest(item.id)}>
          Rename
        </DropdownItem>
        <DropdownItem
          icon={
            copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />
          }
          preventClose
          onClick={onCopyLink}
        >
          {copied ? 'Copied!' : 'Copy link'}
        </DropdownItem>
        <DropdownItem icon={<Move className="h-4 w-4" />}>Move to</DropdownItem>
        <DropdownItem icon={<Star className="h-4 w-4" />}>Add to starred</DropdownItem>
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
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogHeader>
          <DialogTitle>Delete {isFolder ? 'folder' : 'file'}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;
            {isFolder ? item.encryptedName : (item as FileItem).encryptedName}&rdquo;? This action
            cannot be undone.
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
              onDelete(item.id, isFolder)
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
