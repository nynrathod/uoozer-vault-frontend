import { memo } from 'react'
import { Check, Clock, MoreHorizontal, Download, Link2, Loader2, RotateCcw } from 'lucide-react'
import { cn, formatBytes, formatRelativeDate } from '@lib/utils'
import { FileIcon } from './FileIcon'
import { FileActionsMenu } from '../fileActions/FileActionsMenu'
import { useItemActions } from '@hooks/useItemActions'
import { useMoveToFolder } from '@hooks/useMoveToFolder'
import { useFileStore } from '@stores/fileStore'
import { toast } from 'sonner'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'
import { Checkbox } from '@/components/ui'
import { useShallow } from 'zustand/react/shallow'
import { selectFolderSizes } from '@stores/fileStore'

interface FileRowProps {
  item: FileItem | Folder
  isSelected: boolean
  onClick: () => void
  onSelect: () => void
  onShare: (item: FileItem | Folder, isFolder: boolean) => void
  folderItemCount?: number
}

export const FileRow = memo(function FileRow({
  item,
  isSelected,
  onClick,
  onSelect,
}: FileRowProps) {
  const {
    isFolder,
    isShareMode,
    isTrash,
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
  const { moveToFolder } = useMoveToFolder()
  const dragOverId = useFileStore((s) => s.dragOverId)
  const setDragOverId = useFileStore((s) => s.setDragOverId)
  const isDragging = useFileStore((s) => s.isDragging)
  const setIsDragging = useFileStore((s) => s.setIsDragging)
  const setShareTarget = useFileStore((s) => s.setShareTarget)
  const setVersionFileId = useFileStore((s) => s.setVersionFileId)
  const activeMenuId = useFileStore((s) => s.activeMenuId)
  const setActiveMenuId = useFileStore((s) => s.setActiveMenuId)
  const editingId = useFileStore((s) => s.editingId)
  const setEditingId = useFileStore((s) => s.setEditingId)
  const setDropHint = useFileStore((s) => s.setDropHint)
  const folderSizes = useFileStore(useShallow(selectFolderSizes))
  const isMenuActive = activeMenuId === item.id
  const isOtherMenuActive = !!activeMenuId && activeMenuId !== item.id
  const isDragOver = dragOverId === item.id
  const isNew = item.id.startsWith('temp-')

  const handleRowDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(null)
    setDropHint(null)
    setIsDragging(false)
    const draggedId = e.dataTransfer.getData('text/plain')
    const draggedType = e.dataTransfer.getData('application/x-item-type') || 'file'
    if (!draggedId || draggedId === item.id) return
    const state = useFileStore.getState()
    const dragged =
      draggedType === 'folder' ? state.folders.get(draggedId) : state.files.get(draggedId)
    if (!dragged) return
    void moveToFolder({ item: dragged, isFolder: draggedType === 'folder' }, item.id).then(
      (result) => {
        if (result.ok) toast.success(`Moved to “${item.name}”`)
        else if (result.message) toast.info(result.message)
      }
    )
  }

  return (
    <div
      className={cn(
        'group relative grid h-11 grid-cols-[40px_40px_minmax(0,1fr)] items-center gap-2 rounded-md border border-transparent px-0 transition-colors duration-[120ms] ease-out md:grid-cols-[40px_40px_minmax(0,1fr)_180px_100px_150px]',

        isDragOver
          ? 'bg-secondary ring-primary/40 z-20 ring-2 ring-inset'
          : isSelected
            ? 'bg-active'
            : !isDragging
              ? 'hover:bg-accent'
              : '',
        isMenuActive && 'z-30',
        editingId === item.id && 'z-30',
        'cursor-grab active:cursor-grabbing',
        isNew &&
          editingId === item.id &&
          'bg-secondary/60 border-l-primary animate-pulse border-l-2'
      )}
      onClick={onClick}
      draggable={!isShareMode && !isTrash}
      onDragStart={(e) => {
        if (isShareMode || isTrash) return
        e.dataTransfer.setData('text/plain', item.id)
        e.dataTransfer.setData('application/x-item-type', isFolder ? 'folder' : 'file')
        e.dataTransfer.effectAllowed = 'move'
        setIsDragging(true)
      }}
      onDragEnter={(e) => {
        if (isShareMode || isTrash) return
        if (isFolder && Array.from(e.dataTransfer.types).includes('text/plain')) {
          e.preventDefault()
          setDragOverId(item.id)
          setDropHint({ destinationId: item.id, destinationName: item.name })
        }
      }}
      onDragOver={(e) => {
        if (isShareMode || isTrash) return
        if (isFolder && Array.from(e.dataTransfer.types).includes('text/plain')) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onDragLeave={(e) => {
        if (isShareMode || isTrash) return
        if (isFolder && Array.from(e.dataTransfer.types).includes('text/plain')) {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverId(null)
            setDropHint(null)
          }
        }
      }}
      onDrop={isFolder ? handleRowDrop : undefined}
      onDragEnd={() => {
        setDragOverId(null)
        setDropHint(null)
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
                className="bg-card border-primary w-full rounded-sm border px-1.5 py-0.5 text-[13px] font-medium outline-none"
              />
              {isSaving ? (
                <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="text-success hover:text-success/80 shrink-0 cursor-pointer transition-colors duration-[120ms]"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
            </div>
            {error && (
              <span className="text-destructive text-2xs mt-1 px-1.5 font-medium">{error}</span>
            )}
          </div>
        ) : (
          <div
            className="flex h-full w-full min-w-0 cursor-pointer items-center gap-2"
            onDoubleClick={isTrash ? undefined : () => setEditingId(item.id)}
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
          >
            <p className="text-foreground truncate text-[13px] leading-5 font-medium">
              {item.name}
            </p>
          </div>
        )}
      </div>
      <div className="text-muted-foreground hidden min-w-0 items-center justify-start gap-1.5 text-xs leading-4 whitespace-nowrap md:flex">
        <Clock className="text-ghost h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">{formatRelativeDate(item.updatedAt)}</span>
      </div>
      <div className="text-muted-foreground hidden min-w-0 items-center justify-start text-xs leading-4 whitespace-nowrap tabular-nums md:flex">
        {isFolder
          ? formatBytes((item as Folder).totalSize ?? folderSizes.get(item.id) ?? 0)
          : formatBytes((item as FileItem).totalSize)}
      </div>
      <div
        className={cn(
          'relative z-40 hidden h-full w-full min-w-0 items-center justify-end gap-1 pr-2 md:flex',
          'pointer-events-none translate-x-1 opacity-0 transition-all duration-150',
          'group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100',
          'group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100',
          isMenuActive && 'pointer-events-auto translate-x-0 opacity-100'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {isTrash ? (
          <>
            <button
              type="button"
              onClick={handleRestore}
              className="text-ghost hover:bg-active hover:text-label flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm transition-colors duration-[120ms]"
              title="Restore"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="text-ghost hover:bg-active hover:text-label flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm transition-colors duration-[120ms]"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleDownload}
              className="text-ghost hover:bg-active hover:text-label flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm transition-colors duration-[120ms]"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            {!isShareMode && (
              <button
                type="button"
                onClick={() => handleCopyLink()}
                className="text-ghost hover:bg-active hover:text-label flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm transition-colors duration-[120ms]"
                title="Copy Link"
              >
                {copied ? (
                  <Check className="text-success h-4 w-4" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
              </button>
            )}
            {/* {!isShareMode && (
              <button
                type="button"
                onClick={() => onShare(item, isFolder)}
                className="text-ghost hover:bg-active hover:text-label flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm transition-colors duration-[120ms]"
                title="Share"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )} */}
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
                  className="text-ghost hover:bg-active hover:text-label flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm transition-colors duration-[120ms]"
                  title="More"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              }
            />
          </>
        )}
      </div>
    </div>
  )
})
