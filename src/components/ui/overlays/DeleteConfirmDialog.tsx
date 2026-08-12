import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/Dialog'
import { Button } from '@ui/Button'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  isFolder: boolean
  onConfirm: () => void
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemName,
  isFolder,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Delete {isFolder ? 'folder' : 'file'}</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete &ldquo;{itemName}&rdquo;? This action cannot be undone.
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
