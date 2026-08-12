import { cn } from '@lib/utils'
import { Check, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { FileRow } from './FileRow'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

interface FileListProps {
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
  onSelectAll?: () => void
  isAllSelected?: boolean
  sortField?: 'name' | 'size' | 'modified' | 'created' | null
  sortOrder?: 'asc' | 'desc' | null
  onSortChange?: (field: 'name' | 'size' | 'modified') => void
  activeMenuId?: string | null
  setActiveMenuId?: (id: string | null) => void
  onVersions?: (file: FileItem) => void
  removingIds?: Set<string>
  onShare: (item: FileItem | Folder, isFolder: boolean) => void
}

export function FileList({
  files,
  folders,
  onFolderClick,
  onFileClick,
  onFileDoubleClick,
  onFileSelect,
  selectedIds,
  onRename,
  onRenameRequest,
  onDelete,
  onMoveItem,
  editingId,
  folderCounts,
  onSelectAll,
  isAllSelected,
  sortField,
  sortOrder,
  onSortChange,
  activeMenuId,
  setActiveMenuId,
  onVersions,
  removingIds,
  onShare,
}: FileListProps) {
  return (
    <div className="h-full overflow-auto px-4 sm:px-6">
      <div className="pb-4">
        <div className="border-border/40 text-muted-foreground/50 bg-background sticky top-0 z-10 mb-2 grid grid-cols-[24px_2.5rem_1fr_9.5rem] items-center gap-3 border-b px-3 py-2 text-[11px] font-semibold tracking-wider uppercase md:grid-cols-[24px_2.5rem_1fr_9.5rem_8rem_6rem]">
          <div
            className={cn(
              'flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border transition-all duration-150',
              isAllSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-muted-foreground/40'
            )}
            onClick={(e) => {
              e.stopPropagation()
              onSelectAll?.()
            }}
          >
            {isAllSelected && <Check className="h-3 w-3" strokeWidth={3} />}
          </div>
          <span></span>
          <button
            className="hover:text-foreground flex cursor-pointer items-center gap-1 truncate transition-colors"
            onClick={() => onSortChange?.('name')}
          >
            Name
            {sortField === 'name' ? (
              sortOrder === 'asc' ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )
            ) : (
              <ChevronsUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
          <span></span>
          <span className="hidden md:block">Modified</span>
          <button
            className="hover:text-foreground ml-auto flex cursor-pointer items-center gap-1 transition-colors"
            onClick={() => onSortChange?.('size')}
          >
            Size
            {sortField === 'size' ? (
              sortOrder === 'asc' ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )
            ) : (
              <ChevronsUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        </div>

        <div className="space-y-0.5">
          {folders.map((folder) => (
            <FileRow
              key={`folder-${folder.id}`}
              item={folder}
              isFolder={true}
              isSelected={selectedIds.has(folder.id)}
              onClick={() => onFolderClick(folder)}
              onSelect={() => onFileSelect(folder.id)}
              onRename={onRename}
              onRenameRequest={onRenameRequest}
              onDelete={onDelete}
              onMoveItem={onMoveItem}
              editingId={editingId}
              itemCount={folderCounts?.[folder.id] || 0}
              activeMenuId={activeMenuId}
              setActiveMenuId={setActiveMenuId}
              isRemoving={removingIds?.has(folder.id)}
              onShare={onShare}
            />
          ))}

          {files.map((file) => (
            <FileRow
              key={`file-${file.id}`}
              item={file}
              isFolder={false}
              isSelected={selectedIds.has(file.id)}
              onClick={() => onFileClick(file)}
              onDoubleClick={() => onFileDoubleClick?.(file)}
              onSelect={() => onFileSelect(file.id)}
              onRename={onRename}
              onRenameRequest={onRenameRequest}
              onDelete={onDelete}
              onMoveItem={onMoveItem}
              editingId={editingId}
              activeMenuId={activeMenuId}
              setActiveMenuId={setActiveMenuId}
              onVersions={() => onVersions?.(file)}
              isRemoving={removingIds?.has(file.id)}
              onShare={onShare}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
