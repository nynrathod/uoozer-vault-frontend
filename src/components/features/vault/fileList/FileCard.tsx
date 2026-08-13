import { memo } from 'react'
import { FileIcon } from './FileIcon'
import { cn, formatBytes } from '@lib/utils'
import { FileActionsMenu } from '../fileActions/FileActionsMenu'
import { MoreHorizontal, Share2, Loader2, Check } from 'lucide-react'
import { useClipboard } from '@hooks/useClipboard'
import { useInlineRename } from '@hooks/useInlineRename'
import { useFileStore } from '@stores/fileStore'
import { MOCK_URLS } from '@lib/constants'
import { isFolder } from '@/lib/type-guards'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

interface FileCardProps {
  item: FileItem | Folder
  isSelected: boolean
  onClick: () => void
  editingId?: string | null
  onRenameRequest?: (id: string | null) => void
  itemCount?: number
}

export const FileCard = memo(function FileCard({
  item,
  isSelected,
  onClick,
  editingId,
  onRenameRequest,
  itemCount = 0,
}: FileCardProps) {
  const { copied, copy } = useClipboard()
  const deleteItem = useFileStore((s) => s.deleteItem)
  const moveItem = useFileStore((s) => s.moveItem)
  const renameItem = useFileStore((s) => s.renameItem)
  const setShareTarget = useFileStore((s) => s.setShareTarget)
  const setVersionFileId = useFileStore((s) => s.setVersionFileId)
  const activeMenuId = useFileStore((s) => s.activeMenuId)

  const dragOverId = useFileStore((s) => s.dragOverId)
  const setDragOverId = useFileStore((s) => s.setDragOverId)
  const isDragging = useFileStore((s) => s.isDragging)
  const setIsDragging = useFileStore((s) => s.setIsDragging)

  const folderCheck = isFolder(item)
  const name = item.encryptedName
  const isEditing = editingId === item.id
  const isMenuActive = activeMenuId === item.id
  const isDragOver = dragOverId === item.id

  const {
    name: gridName,
    setName,
    isSaving,
    handleSubmit,
  } = useInlineRename(
    name,
    (newName) => {
      renameItem(item.id, folderCheck, newName)
      onRenameRequest?.(null)
    },
    () => onRenameRequest?.(null)
  )

  const handleCopyLink = () => copy(`${MOCK_URLS.SHARE_LINK_BASE}${item.id}`)

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition-colors duration-150 ease-out',
        isDragOver
          ? 'border-primary/20 bg-primary/5 z-20 shadow-[0_0_0_2px_hsl(var(--primary)/0.2),0_8px_20px_-4px_hsl(var(--primary)/0.15)]'
          : isSelected
            ? 'border-primary/25 bg-primary/[0.04] shadow-sm'
            : !isDragging
              ? 'hover:border-border/60 hover:bg-accent/50 border-transparent'
              : 'border-transparent',
        isMenuActive && 'z-30',
        isEditing && 'z-30',
        'cursor-grab active:cursor-grabbing'
      )}
      onClick={onClick}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.id)
        e.dataTransfer.setData('application/x-item-type', folderCheck ? 'folder' : 'file')
        e.dataTransfer.effectAllowed = 'move'
        setIsDragging(true)
      }}
      onDragEnter={(e) => {
        if (folderCheck) {
          e.preventDefault()
          setDragOverId(item.id)
        }
      }}
      onDragOver={(e) => {
        if (folderCheck) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onDragLeave={(e) => {
        if (folderCheck) {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverId(null)
          }
        }
      }}
      onDrop={(e) => {
        if (folderCheck) {
          e.preventDefault()
          e.stopPropagation()
          setDragOverId(null)
          setIsDragging(false)
          const draggedId = e.dataTransfer.getData('text/plain')
          const draggedType = e.dataTransfer.getData('application/x-item-type') || 'file'
          if (draggedId && draggedId !== item.id)
            moveItem(draggedId, item.id, draggedType === 'folder')
        }
      }}
      onDragEnd={() => {
        setDragOverId(null)
        setIsDragging(false)
      }}
    >
      <FileIcon
        mimeType={folderCheck ? undefined : (item as FileItem).encryptedMimeType}
        isFolder={folderCheck}
        size="lg"
        className="mb-0.5"
      />
      <div className="w-full">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={gridName}
              onChange={(e) => setName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') onRenameRequest?.(null)
              }}
              className="bg-background border-primary w-full rounded-md border px-1.5 py-0.5 text-center text-[13px] font-medium outline-none"
            />
            {isSaving ? (
              <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <button
                onClick={handleSubmit}
                className="shrink-0 text-emerald-500 hover:text-emerald-600"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <p className="text-foreground truncate text-[13px] font-medium">{name}</p>
        )}
        <p className="text-muted-foreground/70 mt-0.5 text-[11px]">
          {folderCheck
            ? `${itemCount} item${itemCount !== 1 ? 's' : ''}`
            : formatBytes((item as FileItem).size)}
        </p>
      </div>

      <div className="absolute top-2 right-2 flex items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShareTarget(item.id)
          }}
          className={cn(
            'text-muted-foreground hover:bg-accent hover:text-foreground bg-background/50 flex h-7 w-7 items-center justify-center rounded-md backdrop-blur-sm transition-opacity',
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <Share2 className="h-4 w-4" />
        </button>

        <FileActionsMenu
          item={item}
          isFolder={folderCheck}
          onRenameRequest={(id) => onRenameRequest?.(id)}
          onDelete={deleteItem}
          onShare={() => setShareTarget(item.id)}
          copied={copied}
          onCopyLink={handleCopyLink}
          onVersions={() => !folderCheck && setVersionFileId(item.id)}
          open={isMenuActive}
          onOpenChange={(open) => useFileStore.getState().setActiveMenuId(open ? item.id : null)}
          trigger={
            <button
              className={cn(
                'text-muted-foreground hover:bg-accent hover:text-foreground bg-background/50 flex h-7 w-7 items-center justify-center rounded-md backdrop-blur-sm transition-opacity',
                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        />
      </div>
    </div>
  )
})
