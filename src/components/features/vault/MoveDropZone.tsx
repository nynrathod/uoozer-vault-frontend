import { useRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useFileStore } from '@stores/fileStore'
import { useMoveToFolder } from '@hooks/useMoveToFolder'
import { DropHintBar } from './DropHintBar'

interface MoveDropZoneProps {
  currentFolderId: string | null
  currentFolderName: string
  disabled?: boolean
  children: ReactNode
}

export function MoveDropZone({
  currentFolderId,
  currentFolderName,
  disabled,
  children,
}: MoveDropZoneProps) {
  const { moveToFolder } = useMoveToFolder()
  const isDragging = useFileStore((s) => s.isDragging)
  const setDropHint = useFileStore((s) => s.setDropHint)
  const dragCounter = useRef(0)

  const isInternalDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes('application/x-item-type')

  const handleDragEnter = (e: React.DragEvent) => {
    if (disabled || !isInternalDrag(e)) return
    e.preventDefault()
    dragCounter.current++
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled || !isInternalDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropHint({ destinationId: currentFolderId, destinationName: currentFolderName })
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (disabled || !isInternalDrag(e)) return
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDropHint(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    if (disabled || !isInternalDrag(e)) return
    e.preventDefault()
    dragCounter.current = 0
    setDropHint(null)
    const draggedId = e.dataTransfer.getData('text/plain')
    const draggedType = e.dataTransfer.getData('application/x-item-type') || 'file'
    if (!draggedId) return
    const state = useFileStore.getState()
    const item =
      draggedType === 'folder' ? state.folders.get(draggedId) : state.files.get(draggedId)
    if (!item) return
    void moveToFolder({ item, isFolder: draggedType === 'folder' }, currentFolderId).then(
      (result) => {
        if (result.ok) {
          toast.success(
            `Moved to ${currentFolderId ? (state.folders.get(currentFolderId)?.name ?? 'folder') : 'Vault'}`
          )
        } else if (result.message) {
          toast.info(result.message)
        }
      }
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {isDragging && !disabled && (
        <div className="border-primary/40 pointer-events-none absolute inset-0 z-10 rounded-xl border-2 border-dashed" />
      )}
      <div
        className="flex min-h-0 flex-1 flex-col"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {children}
      </div>
      <DropHintBar />
    </div>
  )
}
