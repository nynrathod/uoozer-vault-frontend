import { useFileStore } from '@stores/fileStore'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

export function useDragHandlers(item: FileItem | Folder, isFolder: boolean) {
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
      if (isFolder) {
        e.preventDefault()
        e.stopPropagation()
        setDragOverId(null)
        setIsDragging(false)
        const draggedId = e.dataTransfer.getData('text/plain')
        const draggedType = e.dataTransfer.getData('application/x-item-type') || 'file'
        if (draggedId && draggedId !== item.id) {
          moveItem(draggedId, item.id, draggedType === 'folder')
        }
      }
    },
    onDragEnd: () => {
      setDragOverId(null)
      setIsDragging(false)
    },
  }

  return { handlers, isDragOver, isDragging }
}
