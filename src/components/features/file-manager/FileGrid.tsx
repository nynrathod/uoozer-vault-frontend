import { useState, useEffect } from 'react'
import { FileIcon } from './FileIcon'
import { cn, formatBytes } from '@lib/utils'
import { FileActionsMenu } from './FileActionsMenu'
import { ShareDialog } from './ShareDialog'
import { MoreHorizontal, Share2, Loader2, Check } from 'lucide-react'
import type { FileItem } from '@/types/filtes'
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
}

export function FileGrid({
  files,
  folders,
  onFolderClick,
  onFileClick,
  onFileDoubleClick,
  selectedIds,
  onRename,
  onRenameRequest,
  onDelete,
  onMoveItem,
  editingId,
  folderCounts,
}: FileGridProps) {
  const allItems = [...folders, ...files]
  const [shareItem, setShareItem] = useState<{
    id: string
    name: string
    isFolder: boolean
    itemCount: number
  } | null>(null)
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set())
  const [gridNames, setGridNames] = useState<Record<string, string>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    allItems.forEach((item) => {
      const name = 'parentId' in item ? item.encryptedName : (item as FileItem).encryptedName
      if (editingId !== item.id) {
        setGridNames((prev) => ({ ...prev, [item.id]: name }))
      }
    })
  }, [allItems, editingId])

  const handleCopyLink = (id: string) => {
    navigator.clipboard.writeText(`https://uoozer.app/s/${id}`)
    setCopiedIds((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setCopiedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 2000)
  }

  const handleRenameSubmit = (item: FileItem | Folder, isFolder: boolean) => {
    const currentName = 'parentId' in item ? item.encryptedName : (item as FileItem).encryptedName
    if (gridNames[item.id]?.trim() === currentName || savingIds.has(item.id)) {
      onRenameRequest?.(null)
      return
    }

    setSavingIds((prev) => new Set(prev).add(item.id))
    setTimeout(() => {
      if (onRename) onRename(item.id, isFolder, gridNames[item.id] || '')
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }, 600)
  }

  return (
    <div className="grid grid-cols-2 gap-3 overflow-auto p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {allItems.map((item) => {
        const isFolder = 'parentId' in item
        const isSelected = selectedIds.has(item.id)
        const name = isFolder ? (item as Folder).encryptedName : (item as FileItem).encryptedName
        const itemCount = isFolder ? folderCounts?.[item.id] || 0 : 0
        const isCopied = copiedIds.has(item.id)
        const isEditing = editingId === item.id
        const isSaving = savingIds.has(item.id)

        return (
          <div
            key={item.id}
            className={cn(
              'group relative flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition-all duration-150',
              isSelected
                ? 'border-primary/25 bg-primary/[0.04] shadow-sm'
                : 'hover:border-border/60 hover:bg-accent/50 border-transparent',
              'cursor-grab active:cursor-grabbing'
            )}
            onClick={() =>
              isFolder ? onFolderClick(item as Folder) : onFileClick(item as FileItem)
            }
            onDoubleClick={() => !isFolder && onFileDoubleClick?.(item as FileItem)}
            draggable={true}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', item.id)
              e.dataTransfer.setData('application/x-item-type', isFolder ? 'folder' : 'file')
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              if (isFolder) {
                e.preventDefault()
              }
            }}
            onDrop={(e) => {
              if (isFolder) {
                e.preventDefault()
                const draggedId = e.dataTransfer.getData('text/plain')
                const draggedType = e.dataTransfer.getData('application/x-item-type') || 'file'
                if (draggedId && draggedId !== item.id) {
                  onMoveItem?.(draggedId, item.id, draggedType === 'folder')
                }
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
                    value={gridNames[item.id] || name}
                    onChange={(e) =>
                      setGridNames((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => handleRenameSubmit(item, isFolder)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(item, isFolder)
                      if (e.key === 'Escape') onRenameRequest?.(null)
                    }}
                    className="bg-background border-primary w-full rounded-md border px-1.5 py-0.5 text-center text-[13px] font-medium outline-none"
                  />
                  {isSaving ? (
                    <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <button
                      onClick={() => handleRenameSubmit(item, isFolder)}
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
                  setShareItem({ id: item.id, name, isFolder, itemCount })
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
                onShare={() => setShareItem({ id: item.id, name, isFolder, itemCount })}
                copied={isCopied}
                onCopyLink={() => handleCopyLink(item.id)}
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
      })}

      <ShareDialog
        open={shareItem !== null}
        onOpenChange={() => setShareItem(null)}
        itemName={shareItem?.name || ''}
        isFolder={shareItem?.isFolder || false}
        itemCount={shareItem?.itemCount}
      />
    </div>
  )
}
