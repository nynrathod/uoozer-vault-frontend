import { useState } from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/Dialog'
import { Button } from '@ui/Button'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  isFolder: boolean
  isPermanent?: boolean
  onConfirm: () => void | Promise<void>
}

/** Confirmation dialog for trashing or permanently deleting a file/folder. */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemName,
  isFolder,
  isPermanent,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (isConfirming) return
    setIsConfirming(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isConfirming) onOpenChange(next)
      }}
    >
      <DialogHeader>
        <DialogTitle>Delete {isFolder ? 'folder' : 'file'}</DialogTitle>
        <DialogDescription>
          {isPermanent
            ? `Permanently delete "${itemName}"? This cannot be undone.`
            : `Move "${itemName}" to trash? You can restore it later.`}
        </DialogDescription>
      </DialogHeader>
      {error && <p className="text-destructive mt-1 text-[13px]">{error}</p>}
      <DialogFooter>
        <Button
          variant="ghost"
          className="rounded-lg"
          disabled={isConfirming}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          className="rounded-lg"
          loading={isConfirming}
          onClick={handleConfirm}
        >
          {isPermanent ? 'Delete forever' : 'Delete'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
