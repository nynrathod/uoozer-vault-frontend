import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/Dialog'
import { Button } from '@ui/Button'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  isFolder: boolean
  isPermanent?: boolean
  onConfirm: () => void
}

/** Confirmation dialog before permanently deleting a file or folder. */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  isFolder,
  isPermanent,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Delete {isFolder ? 'folder' : 'file'}</DialogTitle>
        //{' '}
        <DialogDescription>
          {isPermanent ? `This will permanently delete...` : `Are you sure you want to delete...`}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" className="rounded-lg" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="destructive" className="rounded-lg" onClick={onConfirm}>
          Delete
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
