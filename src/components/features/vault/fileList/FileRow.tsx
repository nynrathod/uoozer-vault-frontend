import { memo } from 'react'
import { Check, Clock, MoreHorizontal, Download, Share2, Link2, Loader2 } from 'lucide-react'
import { cn, formatBytes, formatRelativeDate } from '@lib/utils'
import { FileIcon } from './FileIcon'
import { FileActionsMenu } from '../fileActions/FileActionsMenu'
import { useItemActions } from '@hooks/useItemActions'
import { useFileStore } from '@stores/fileStore'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'
import { Checkbox } from '@/components/ui'

interface FileRowProps {
  item: FileItem | Folder
  isSelected: boolean
  onClick: () => void
  onSelect: () => void
  onShare: (item: FileItem | Folder, isFolder: boolean) => void
}

export const FileRow = memo(function FileRow({
  item,
  isSelected,
  onClick,
  onSelect,
  onShare,
}: FileRowProps) {
  const {
    isFolder,
    isTrash,
    isShareMode,
    copied,
    handleCopyLink,
    handleDownload,
    handleDelete,
    handleRestore,
    name,
    setName,
    isSaving,
    error,
    handleSubmit,
    handleCancel,
  } = useItemActions(item, () => setEditingId(null))

  const dragOverId = useFileStore((s) => s.dragOverId)
  const setDragOverId = useFileStore((s) => s.setDragOverId)
  const isDragging = useFileStore((s) => s.isDragging)
  const setIsDragging = useFileStore((s) => s.setIsDragging)
  const moveItem = useFileStore((s) => s.moveItem)
  const setShareTarget = useFileStore((s) => s.setShareTarget)
  const setVersionFileId = useFileStore((s) => s.setVersionFileId)
  const activeMenuId = useFileStore((s) => s.activeMenuId)
  const setActiveMenuId = useFileStore((s) => s.setActiveMenuId)
  const editingId = useFileStore((s) => s.editingId)
  const setEditingId = useFileStore((s) => s.setEditingId)

  const isMenuActive = activeMenuId === item.id
  const isOtherMenuActive = !!activeMenuId && activeMenuId !== item.id
  const isDragOver = dragOverId === item.id
  const isNew = item.id.startsWith('temp-')

  return (
    <div
      className={cn(
        'group relative grid h-[52px] grid-cols-[40px_40px_1fr] items-center gap-2 rounded-lg border border-transparent px-0 transition-colors duration-150 ease-out md:grid-cols-[40px_40px_1fr_160px_140px_80px]',
        isDragOver
          ? 'bg-primary/5 border-primary/20 z-20 shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_4px_12px_-2px_hsl(var(--primary)/0.15)]'
          : isSelected
            ? 'bg-primary/[0.06] border-primary/20'
            : !isDragging
              ? 'hover:bg-accent/60 hover:border-border/40'
              : '',
        isMenuActive && 'z-30',
        editingId === item.id && 'z-30',
        'cursor-grab active:cursor-grabbing',
        isNew &&
          editingId === item.id &&
          'bg-primary/[0.04] border-l-primary animate-pulse border-l-2'
      )}
      onClick={onClick}
      draggable={!isShareMode && !item.deletedAt}
      onDragStart={(e) => {
        if (isShareMode || item.deletedAt) return
        e.dataTransfer.setData('text/plain', item.id)
        e.dataTransfer.setData('application/x-item-type', isFolder ? 'folder' : 'file')
        e.dataTransfer.effectAllowed = 'move'
        setIsDragging(true)
      }}
      onDragEnter={(e) => {
        if (isShareMode || item.deletedAt) return
        if (isFolder && Array.from(e.dataTransfer.types).includes('text/plain')) {
          e.preventDefault()
          setDragOverId(item.id)
        }
      }}
      onDragOver={(e) => {
        if (isShareMode || item.deletedAt) return
        if (isFolder && Array.from(e.dataTransfer.types).includes('text/plain')) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onDragLeave={(e) => {
        if (isShareMode || item.deletedAt) return
        if (isFolder && Array.from(e.dataTransfer.types).includes('text/plain')) {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null)
        }
      }}
      onDrop={(e) => {
        if (isShareMode || item.deletedAt) return
        if (isFolder && Array.from(e.dataTransfer.types).includes('text/plain')) {
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
      <div
        className="flex shrink-0 cursor-pointer items-center justify-center"
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <Checkbox
          checked={isSelected}
          className="data-[state=unchecked]:group-hover:border-muted-foreground/40"
        />
      </div>

      <div className="flex items-center justify-center">
        <FileIcon
          mimeType={isFolder ? undefined : (item as FileItem).mimeType}
          isFolder={isFolder}
          size="sm"
        />
      </div>

      <div className="flex min-w-0 items-center justify-start">
        {editingId === item.id ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={handleCancel}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="bg-background border-primary w-full rounded-md border px-1.5 py-0.5 text-[13px] font-medium outline-none"
              />
              {isSaving ? (
                <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="shrink-0 cursor-pointer text-emerald-500 hover:text-emerald-600"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
            </div>
            {error && (
              <span className="text-destructive mt-1 px-1.5 text-[11px] font-medium">{error}</span>
            )}
          </div>
        ) : (
          <div
            className="flex h-full w-full min-w-0 cursor-pointer items-center gap-2"
            onDoubleClick={item.deletedAt ? undefined : () => setEditingId(item.id)}
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
          >
            <p className="text-foreground truncate text-[13px] font-medium">{item.name}</p>
          </div>
        )}
      </div>

      <div
        className={cn(
          'relative z-40 hidden items-center justify-start gap-0.5 md:flex',
          'translate-x-2 opacity-0 transition-all duration-200 ease-out',
          'group-hover:translate-x-0 group-hover:opacity-100',
          isMenuActive ? 'translate-x-0 opacity-100' : '',
          isOtherMenuActive ? 'opacity-0' : ''
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleDownload}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-md"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </button>
        {!isShareMode && (
          <button
            type="button"
            onClick={() => handleCopyLink()}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-md"
            title="Copy Link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
          </button>
        )}
        {!isShareMode && (
          <button
            type="button"
            onClick={() => onShare(item, isFolder)}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-md"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        )}

        <FileActionsMenu
          item={item}
          isFolder={isFolder}
          onRenameRequest={() => setEditingId(item.id)}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onDownload={handleDownload}
          onShare={() => setShareTarget(item.id)}
          copied={copied}
          onCopyLink={() => handleCopyLink()}
          onVersions={() => !isFolder && setVersionFileId(item.id)}
          open={isMenuActive}
          onOpenChange={(open) => setActiveMenuId(open ? item.id : null)}
          trigger={
            <button
              type="button"
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-md"
              title="More"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        />
      </div>

      <div className="text-muted-foreground/70 hidden items-center justify-start text-xs md:flex">
        <Clock className="mr-1.5 h-3.5 w-3.5" />
        <span>{formatRelativeDate(item.updatedAt)}</span>
      </div>

      <div className="text-muted-foreground/70 hidden items-center justify-start text-xs tabular-nums md:flex">
        {isFolder ? `${0} items` : formatBytes((item as FileItem).totalSize)}
      </div>
    </div>
  )
})
