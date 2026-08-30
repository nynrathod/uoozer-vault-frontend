import { useFileStore } from '@stores/fileStore'
import { fileService } from '@services/files/fileService'
import { folderService } from '@services/folders/folderService'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@lib/constants'
import { toast } from 'sonner'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

export function useDragHandlers(item: FileItem | Folder, isFolder: boolean) {
  const queryClient = useQueryClient()
  const dragOverId = useFileStore((s) => s.dragOverId)
  const setDragOverId = useFileStore((s) => s.setDragOverId)
  const isDragging = useFileStore((s) => s.isDragging)
  const setIsDragging = useFileStore((s) => s.setIsDragging)
  const moveItem = useFileStore((s) => s.moveItem)

  const isDragOver = dragOverId === item.id

  const handlers = {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', item.id)
      e.dataTransfer.setData('application/x-item-type', isFolder ? 'folder' : 'file')
      e.dataTransfer.effectAllowed = 'move'
      setIsDragging(true)
    },
    onDragEnter: (e: React.DragEvent) => {
      if (isFolder) {
        e.preventDefault()
        setDragOverId(item.id)
      }
    },
    onDragOver: (e: React.DragEvent) => {
      if (isFolder) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      if (isFolder && !e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOverId(null)
      }
    },
    onDrop: (e: React.DragEvent) => {
      if (!isFolder) return

      e.preventDefault()
      e.stopPropagation()
      setDragOverId(null)
      setIsDragging(false)

      const draggedId = e.dataTransfer.getData('text/plain')
      const draggedType = e.dataTransfer.getData('application/x-item-type') || 'file'

      const isFolderDrag = draggedType === 'folder'

      moveItem(draggedId, item.id, isFolderDrag)

      const movePromise = isFolderDrag
        ? folderService.moveFolder(draggedId, item.id)
        : fileService.moveFile(draggedId, item.id)

      movePromise
        .then(() => {
          console.log('[MOVE] API success')
          toast.success(`Moved to "${item.name}"`)
        })
        .catch((error: any) => {
          console.error('[MOVE] API failed:', error)
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
          toast.error(error?.message ?? 'Failed to move item')
        })
    },
    onDragEnd: () => {
      setDragOverId(null)
      setIsDragging(false)
    },
  }

  return { handlers, isDragOver, isDragging }
}
