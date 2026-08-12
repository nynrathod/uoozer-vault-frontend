import { memo } from 'react'
import { FileIcon } from './FileIcon'
import { cn, formatBytes } from '@lib/utils'
import { FileActionsMenu } from '../file-actions/FileActionsMenu'
import { MoreHorizontal, Share2, Loader2, Check } from 'lucide-react'
import { useClipboard } from '@hooks/useClipboard'
import { useInlineRename } from '@hooks/useInlineRename'
import { useFileStore } from '@stores/fileStore'
import { MOCK_URLS } from '@lib/constants'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

interface FileCardProps {
  item: FileItem | Folder
  isFolder: boolean
  isSelected: boolean
  onClick: () => void
  onDoubleClick?: () => void
  onSelect: () => void
  editingId?: string | null
  onRenameRequest?: (id: string | null) => void
  itemCount?: number
}

export const FileCard = memo(function FileCard({
  item,
  isFolder,
  isSelected,
  onClick,
  onDoubleClick,
  onSelect,
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

  const name = isFolder ? (item as Folder).encryptedName : (item as FileItem).encryptedName
  const isEditing = editingId === item.id

  const {
    name: gridName,
    setName,
    isSaving,
    handleSubmit,
  } = useInlineRename(
    name,
    (newName) => {
      renameItem(item.id, isFolder, newName)
      onRenameRequest?.(null)
    },
    () => onRenameRequest?.(null)
  )

  const handleCopyLink = () => copy(`${MOCK_URLS.SHARE_LINK_BASE}${item.id}`)

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition-all duration-150',
        isSelected
          ? 'border-primary/25 bg-primary/[0.04] shadow-sm'
          : 'hover:border-border/60 hover:bg-accent/50 border-transparent',
        'cursor-grab active:cursor-grabbing'
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.id)
        e.dataTransfer.setData('application/x-item-type', isFolder ? 'folder' : 'file')
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (isFolder) e.preventDefault()
      }}
      onDrop={(e) => {
        if (isFolder) {
          e.preventDefault()
          const draggedId = e.dataTransfer.getData('text/plain')
          const draggedType = e.dataTransfer.getData('application/x-item-type') || 'file'
          if (draggedId && draggedId !== item.id)
            moveItem(draggedId, item.id, draggedType === 'folder')
        }
      }}
    >
      <FileIcon
        mimeType={isFolder ? undefined : (item as FileItem).encryptedMimeType}
        isFolder={isFolder}
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
          {isFolder
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
          isFolder={isFolder}
          onRenameRequest={(id) => onRenameRequest?.(id)}
          onDelete={deleteItem}
          onShare={() => setShareTarget(item.id)}
          copied={copied}
          onCopyLink={handleCopyLink}
          onVersions={() => !isFolder && setVersionFileId(item.id)}
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
