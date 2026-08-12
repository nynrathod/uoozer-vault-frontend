import { memo } from 'react'
import { Check, Clock, MoreHorizontal, Download, Share2, Link2, Loader2 } from 'lucide-react'
import { cn, formatBytes, formatRelativeDate } from '@lib/utils'
import { FileIcon } from './FileIcon'
import { FileActionsMenu } from '../file-actions/FileActionsMenu'
import { useClipboard } from '@hooks/useClipboard'
import { useInlineRename } from '@hooks/useInlineRename'
import { MOCK_URLS } from '@lib/constants'
import type { FileItem } from '@/types/files'
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
  onShare: (item: FileItem | Folder, isFolder: boolean) => void
  editingId?: string | null
  itemCount?: number
  activeMenuId?: string | null
  setActiveMenuId?: (id: string | null) => void
  onVersions?: () => void
  isRemoving?: boolean
}

export const FileRow = memo(function FileRow({
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
  onShare,
  editingId,
  itemCount = 0,
  activeMenuId,
  setActiveMenuId,
  onVersions,
  isRemoving,
}: FileRowProps) {
  const { copied, copy } = useClipboard()
  const name = isFolder ? (item as Folder).encryptedName : (item as FileItem).encryptedName
  const isMenuActive = activeMenuId === item.id
  const isOtherMenuActive = !!activeMenuId && activeMenuId !== item.id

  const {
    name: rowName,
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
        'group grid grid-cols-[24px_2.5rem_1fr_9.5rem] items-stretch gap-3 overflow-hidden rounded-lg border px-3 transition-all duration-150 md:grid-cols-[24px_2.5rem_1fr_9.5rem_8rem_6rem]',
        isRemoving
          ? 'pointer-events-none !mt-0 h-0 scale-95 border-transparent opacity-0'
          : cn(
              'h-[52px]',
              false ? '' : '' // dragover state removed for brevity, keep existing if needed
            ),
        'cursor-grab active:cursor-grabbing'
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Checkbox */}
      <div
        className={cn(
          'flex shrink-0 cursor-pointer items-center justify-center',
          isSelected ? 'text-primary' : 'group-hover:text-muted-foreground/40 text-transparent'
        )}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <div
          className={cn(
            'flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-all duration-150',
            isSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border group-hover:border-muted-foreground/40'
          )}
        >
          {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
        </div>
      </div>

      {/* Icon */}
      <div className="flex cursor-grab items-center justify-center active:cursor-grabbing">
        <FileIcon
          mimeType={isFolder ? undefined : (item as FileItem).encryptedMimeType}
          isFolder={isFolder}
          size="sm"
        />
      </div>

      {/* Name & Rename */}
      <div className="flex min-w-0 items-center">
        {editingId === item.id ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              autoFocus
              value={rowName}
              onChange={(e) => setName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') onRenameRequest?.(null)
              }}
              className="bg-background border-primary w-full rounded-md border px-1.5 py-0.5 text-[13px] font-medium outline-none"
            />
            {isSaving ? (
              <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <button
                onClick={handleSubmit}
                className="shrink-0 cursor-pointer text-emerald-500 hover:text-emerald-600"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div
            className="flex h-full w-full min-w-0 cursor-pointer items-center gap-2"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
          >
            <p className="text-foreground truncate text-[13px] font-medium">{name}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className={cn(
          'flex cursor-pointer items-center justify-end gap-0.5 transition-opacity duration-150',
          isMenuActive
            ? 'opacity-100'
            : isOtherMenuActive
              ? 'opacity-0'
              : 'md:opacity-0 md:group-hover:opacity-100'
        )}
      >
        {!isFolder && (
          <button
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:bg-accent hover:text-foreground hidden h-8 w-8 cursor-pointer items-center justify-center rounded-md md:flex"
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
          className="text-muted-foreground hover:bg-accent hover:text-foreground hidden h-8 w-8 cursor-pointer items-center justify-center rounded-md md:flex"
          title="Copy Link"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onShare(item, isFolder)
          }}
          className="text-muted-foreground hover:bg-accent hover:text-foreground hidden h-8 w-8 cursor-pointer items-center justify-center rounded-md md:flex"
          title="Share"
        >
          <Share2 className="h-4 w-4" />
        </button>

        <FileActionsMenu
          item={item}
          isFolder={isFolder}
          onRenameRequest={(id) => onRenameRequest?.(id)}
          onDelete={onDelete || (() => {})}
          onShare={() => onShare(item, isFolder)}
          copied={copied}
          onCopyLink={handleCopyLink}
          onVersions={onVersions}
          open={isMenuActive}
          onOpenChange={(open) => setActiveMenuId?.(open ? item.id : null)}
          trigger={
            <button
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-md"
              title="More"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        />
      </div>

      {/* Modified */}
      <div className="text-muted-foreground/70 hidden w-full items-center gap-1.5 text-xs md:flex">
        <Clock className="h-3.5 w-3.5" />
        <span>{formatRelativeDate(item.updatedAt)}</span>
      </div>

      {/* Size */}
      <div className="text-muted-foreground/70 hidden w-full items-center justify-end text-right text-xs tabular-nums md:block">
        {isFolder
          ? `${itemCount} item${itemCount !== 1 ? 's' : ''}`
          : formatBytes((item as FileItem).size)}
      </div>
    </div>
  )
})
