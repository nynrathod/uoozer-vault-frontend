import { useState, useEffect } from 'react'
import { Check, Clock, MoreHorizontal, Download, Share2, Link2, Loader2 } from 'lucide-react'
import { cn, formatBytes, formatRelativeDate } from '@lib/utils'
import { FileIcon } from './FileIcon'
import { FileActionsMenu } from './FileActionsMenu'
import { ShareDialog } from './ShareDialog'
import type { FileItem } from '@/types/filtes'
import type { Folder } from '@/types/folders'

interface FileRowProps {
  item: FileItem | Folder
  isFolder: boolean
  isSelected: boolean
  onClick: () => void
  onDoubleClick?: () => void
  onSelect: () => void
  onRename?: (id: string, isFolder: boolean, newName: string) => void
  onRenameRequest?: (id: string | null) => void
  onDelete?: (id: string, isFolder: boolean) => void
  onMoveItem?: (itemId: string, targetFolderId: string, isFolder: boolean) => void
  editingId?: string | null
  itemCount?: number
}

export function FileRow({
  item,
  isFolder,
  isSelected,
  onClick,
  onDoubleClick,
  onSelect,
  onRename,
  onRenameRequest,
  onDelete,
  onMoveItem,
  editingId,
  itemCount = 0,
}: FileRowProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rowName, setRowName] = useState(
    isFolder ? item.encryptedName : (item as FileItem).encryptedName
  )
  const [isSaving, setIsSaving] = useState(false)

  const name = isFolder ? (item as Folder).encryptedName : (item as FileItem).encryptedName

  useEffect(() => {
    if (editingId !== item.id) {
      setRowName(name)
    }
  }, [name, editingId, item.id])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://uoozer.app/s/${item.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRenameSubmit = () => {
    if (rowName.trim() === name || isSaving) {
      onRenameRequest?.(null)
      return
    }
    setIsSaving(true)
    setTimeout(() => {
      if (onRename) onRename(item.id, isFolder, rowName)
      setIsSaving(false)
    }, 600)
  }

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg px-3 transition-all duration-150',
          'h-[52px] border border-transparent',
          isSelected
            ? 'bg-primary/[0.06] border-primary/20'
            : 'hover:bg-accent/60 hover:border-border/40',
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
          if (isFolder) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        onDrop={(e) => {
          if (isFolder) {
            e.preventDefault()
            e.stopPropagation()
            const draggedId = e.dataTransfer.getData('text/plain')
            const draggedType = e.dataTransfer.getData('application/x-item-type') || 'file'
            if (draggedId && draggedId !== item.id) {
              onMoveItem?.(draggedId, item.id, draggedType === 'folder')
            }
          }
        }}
      >
        <div
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150',
            isSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border group-hover:border-muted-foreground/40'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
        >
          {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
        </div>

        <FileIcon
          mimeType={isFolder ? undefined : (item as FileItem).encryptedMimeType}
          isFolder={isFolder}
          size="sm"
        />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {editingId === item.id ? (
            <>
              <input
                autoFocus
                value={rowName}
                onChange={(e) => setRowName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit()
                  if (e.key === 'Escape') onRenameRequest?.(null)
                }}
                className="bg-background border-primary w-full rounded-md border px-1.5 py-0.5 text-[13px] font-medium outline-none"
              />
              {isSaving ? (
                <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <button
                  onClick={handleRenameSubmit}
                  className="shrink-0 text-emerald-500 hover:text-emerald-600"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <p className="text-foreground truncate text-[13px] font-medium">{name}</p>
          )}
        </div>

        {/* Action buttons: hidden on mobile (except More menu), hover on desktop */}
        <div className={cn('flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100')}>
          {!isFolder && (
            <button
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:bg-accent hover:text-foreground hidden h-8 w-8 items-center justify-center rounded-md md:flex"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCopyLink()
            }}
            className="text-muted-foreground hover:bg-accent hover:text-foreground hidden h-8 w-8 items-center justify-center rounded-md md:flex"
            title="Copy Link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShareOpen(true)
            }}
            className="text-muted-foreground hover:bg-accent hover:text-foreground hidden h-8 w-8 items-center justify-center rounded-md md:flex"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>

          {/* Always visible on mobile and desktop */}
          <FileActionsMenu
            item={item}
            isFolder={isFolder}
            onRenameRequest={onRenameRequest || (() => {})}
            onDelete={onDelete || (() => {})}
            onShare={() => setShareOpen(true)}
            copied={copied}
            onCopyLink={handleCopyLink}
            trigger={
              <button
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md"
                title="More"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          />
        </div>

        <div className="text-muted-foreground/70 hidden w-32 items-center gap-1.5 text-xs md:flex">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatRelativeDate(item.updatedAt)}</span>
        </div>
        <div className="text-muted-foreground/70 hidden w-24 text-right text-xs tabular-nums sm:block">
          {isFolder
            ? `${itemCount} item${itemCount !== 1 ? 's' : ''}`
            : formatBytes((item as FileItem).size)}
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        itemName={name}
        isFolder={isFolder}
        itemCount={itemCount}
      />
    </>
  )
}
