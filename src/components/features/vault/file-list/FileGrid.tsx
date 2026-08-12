import { useState, useEffect, memo } from 'react'
import { FileIcon } from './FileIcon'
import { cn, formatBytes } from '@lib/utils'
import { FileActionsMenu } from '../file-actions/FileActionsMenu'
import { MoreHorizontal, Share2, Loader2, Check } from 'lucide-react'
import { useClipboard } from '@hooks/useClipboard'
import { useInlineRename } from '@hooks/useInlineRename'
import { MOCK_URLS } from '@lib/constants'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

interface FileGridProps {
  files: FileItem[]
  folders: Folder[]
  onFolderClick: (folder: Folder) => void
  onFileClick: (file: FileItem) => void
  onFileDoubleClick?: (file: FileItem) => void
  onFileSelect: (id: string) => void
  selectedIds: Set<string>
  onRename?: (id: string, isFolder: boolean, newName: string) => void
  onRenameRequest?: (id: string | null) => void
  onDelete?: (id: string, isFolder: boolean) => void
  onMoveItem?: (itemId: string, targetFolderId: string, isFolder: boolean) => void
  editingId?: string | null
  folderCounts?: Record<string, number>
  onVersions?: (file: FileItem) => void
  onShare: (item: FileItem | Folder, isFolder: boolean) => void
}

interface FileCardProps extends FileGridProps {
  item: FileItem | Folder
}

const FileCard = memo(function FileCard({
  item,
  isFolder,
  isSelected,
  onFolderClick,
  onFileClick,
  onFileDoubleClick,
  onFileSelect,
  onRename,
  onRenameRequest,
  onDelete,
  onMoveItem,
  editingId,
  folderCounts,
  onVersions,
  onShare,
}: any) {
  const { copied, copy } = useClipboard()
  const name = isFolder ? item.encryptedName : item.encryptedName
  const itemCount = isFolder ? folderCounts?.[item.id] || 0 : 0
  const isEditing = editingId === item.id

  const {
    name: gridName,
    setName,
    isSaving,
    handleSubmit,
  } = useInlineRename(
    name,
    (newName) => {
      if (onRename) onRename(item.id, isFolder, newName)
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
      onClick={() => (isFolder ? onFolderClick(item) : onFileClick(item))}
      onDoubleClick={() => !isFolder && onFileDoubleClick?.(item)}
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
            onMoveItem?.(draggedId, item.id, draggedType === 'folder')
        }
      }}
    >
      <FileIcon
        mimeType={isFolder ? undefined : item.encryptedMimeType}
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
          {isFolder ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : formatBytes(item.size)}
        </p>
      </div>

      <div className="absolute top-2 right-2 flex items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onShare(item, isFolder)
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
          onRenameRequest={onRenameRequest || (() => {})}
          onDelete={onDelete || (() => {})}
          onShare={() => onShare(item, isFolder)}
          copied={copied}
          onCopyLink={handleCopyLink}
          onVersions={() => !isFolder && onVersions?.(item)}
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

export function FileGrid(props: FileGridProps) {
  const allItems = [...props.folders, ...props.files]

  return (
    <div className="grid grid-cols-2 gap-3 overflow-auto p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {allItems.map((item) => {
        const isFolder = 'parentId' in item
        return (
          <FileCard
            key={item.id}
            item={item}
            isFolder={isFolder}
            isSelected={props.selectedIds.has(item.id)}
            onClick={isFolder ? props.onFolderClick : props.onFileClick}
            onDoubleClick={!isFolder ? props.onFileDoubleClick : undefined}
            onSelect={() => props.onFileSelect(item.id)}
            onRename={props.onRename}
            onRenameRequest={props.onRenameRequest}
            onDelete={props.onDelete}
            onMoveItem={props.onMoveItem}
            editingId={props.editingId}
            folderCounts={props.folderCounts}
            onVersions={props.onVersions}
            onShare={props.onShare}
          />
        )
      })}
    </div>
  )
}
