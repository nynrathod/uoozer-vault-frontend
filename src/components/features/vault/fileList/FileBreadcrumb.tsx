import { memo, useState } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@lib/utils'
import { useFileStore } from '@stores/fileStore'
import type { Folder } from '@/types/folders'
import type { MoveTarget } from '@hooks/useMoveToFolder'

interface FileBreadcrumbProps {
  path: Folder[]
  onNavigate: (folderId: string | null) => void
  isLoading?: boolean
  onDropMove?: (target: MoveTarget, destinationFolderId: string | null) => void
}

/** Clickable breadcrumb navigation + drop target for "move out" operations. */
export const FileBreadcrumb = memo(function FileBreadcrumb({
  path,
  onNavigate,
  isLoading,
  onDropMove,
}: FileBreadcrumbProps) {
  const isDropMode = !!onDropMove
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const setDropHint = useFileStore((s) => s.setDropHint)

  const nameFor = (folderId: string | null) =>
    folderId === null ? 'Vault' : (path.find((f) => f.id === folderId)?.name ?? 'folder')

  const parseDragPayload = (e: React.DragEvent): { id: string; type: 'file' | 'folder' } | null => {
    const raw = e.dataTransfer.getData('text/plain')
    const type = e.dataTransfer.getData('application/x-item-type') as 'file' | 'folder' | ''
    if (!raw || (type !== 'file' && type !== 'folder')) return null
    return { id: raw, type }
  }

  const handleDragOver = (e: React.DragEvent, folderId: string | null, isCurrent: boolean) => {
    if (!isDropMode) return
    if (!Array.from(e.dataTransfer.types).includes('application/x-item-type')) return
    if (isCurrent) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverFolderId(folderId ?? 'root')
    setDropHint({ destinationId: folderId, destinationName: nameFor(folderId) })
  }

  const handleDragLeave = (e: React.DragEvent, folderId: string | null) => {
    if (!isDropMode) return
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverFolderId === (folderId ?? 'root')) setDragOverFolderId(null)
      setDropHint(null)
    }
  }

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    if (!isDropMode) return
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(null)
    setDropHint(null)
    const payload = parseDragPayload(e)
    if (!payload || !onDropMove) return
    onDropMove({ item: { id: payload.id } as any, isFolder: payload.type === 'folder' }, folderId)
  }

  const rootHighlighted = dragOverFolderId === 'root' && isDropMode

  return (
    <nav className="no-scrollbar flex items-center gap-0.5 overflow-x-auto px-4 py-2.5 text-[13px]">
      <button
        onClick={() => onNavigate(null)}
        onDragOver={(e) => handleDragOver(e, null, path.length === 0)}
        onDragLeave={(e) => handleDragLeave(e, null)}
        onDrop={(e) => handleDrop(e, null)}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-all duration-150',
          isDropMode && 'ring-1 ring-transparent',
          rootHighlighted && 'bg-primary/10 text-primary ring-primary/40 rounded-md',
          !rootHighlighted &&
            (path.length === 0 && !isLoading
              ? 'text-foreground'
              : 'text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground')
        )}
      >
        <Home className="h-3.5 w-3.5" strokeWidth={2} />
        <span>Vault</span>
      </button>
      {isLoading && path.length === 0 ? (
        <div className="flex items-center gap-0.5">
          <ChevronRight className="text-muted-foreground/30 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <div className="bg-muted h-3 w-24 animate-pulse rounded" />
          <ChevronRight className="text-muted-foreground/30 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <div className="bg-muted h-3 w-16 animate-pulse rounded" />
        </div>
      ) : (
        path.map((folder, index) => {
          const isLast = index === path.length - 1
          const highlighted = isDropMode && dragOverFolderId === folder.id
          return (
            <div key={folder.id} className="flex items-center gap-0.5">
              <ChevronRight
                className="text-muted-foreground/30 h-3.5 w-3.5 shrink-0"
                strokeWidth={2}
              />
              <button
                onClick={() => onNavigate(folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id, isLast)}
                onDragLeave={(e) => handleDragLeave(e, folder.id)}
                onDrop={(e) => handleDrop(e, folder.id)}
                className={cn(
                  'max-w-[160px] truncate rounded-md px-2 py-1 transition-all duration-150',
                  isDropMode && 'ring-1 ring-transparent',
                  highlighted
                    ? 'bg-primary/10 text-primary ring-primary/40'
                    : isLast
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground'
                )}
              >
                {folder.name}
              </button>
            </div>
          )
        })
      )}
    </nav>
  )
})
