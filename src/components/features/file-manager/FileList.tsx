import { cn } from '@lib/utils'
import { Check } from 'lucide-react'
import { FileRow } from './FileRow'
import type { FileItem } from '@/types/filtes'
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
}: FileListProps) {
  return (
    <div className="h-full overflow-auto">
      <div className="space-y-0.5 p-1">
        <div className="border-border/40 text-muted-foreground/50 mb-1 flex items-center gap-3 border-b px-3 py-2 text-[11px] font-semibold tracking-wider uppercase">
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
          <span className="flex-1">Name</span>
          <div className="hidden w-32 md:block">Modified</div>
          <div className="hidden w-24 text-right sm:block">Size</div>
          <div className="w-[152px]"></div>
        </div>

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
          />
        ))}
      </div>
    </div>
  )
}
