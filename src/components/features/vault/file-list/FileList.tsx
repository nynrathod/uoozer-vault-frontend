import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@lib/utils'
import { Check, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { FileRow } from './FileRow'
import { useFileStore } from '@stores/fileStore'
import { isFolder } from '@/lib/type-guards'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

interface FileListProps {
  files: FileItem[]
  folders: Folder[]
  folderCounts?: Record<string, number>
  onFolderClick: (folder: Folder) => void
  onFileClick: (file: FileItem) => void
  onFileSelect: (id: string) => void
  onShare: (item: FileItem | Folder, isFolder: boolean) => void
}

export function FileList({
  files,
  folders,
  folderCounts,
  onFolderClick,
  onFileClick,
  onFileSelect,
  onShare,
}: FileListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const allItems = [...folders, ...files]

  const rowVirtualizer = useVirtualizer({
    count: allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52, // Approximate height of FileRow
    overscan: 5,
  })

  const sortField = useFileStore((s) => s.sortField)
  const sortOrder = useFileStore((s) => s.sortOrder)
  const setSort = useFileStore((s) => s.setSort)
  const sortItems = useFileStore((s) => s.sortItems)
  const selectedFileIds = useFileStore((s) => s.selectedFileIds)
  const selectAll = useFileStore((s) => s.selectAll)
  const clearSelection = useFileStore((s) => s.clearSelection)

  const isAllSelected =
    allItems.length > 0 && allItems.every((item) => selectedFileIds.has(item.id))

  const handleSelectAll = () => {
    if (isAllSelected) clearSelection()
    else selectAll(allItems.map((i) => i.id))
  }

  const handleColumnSort = (field: 'name' | 'size' | 'modified') => {
    let newField: 'name' | 'size' | 'modified' | null = field
    let newOrder: 'asc' | 'desc' | null = 'asc'
    if (sortField === field) {
      if (sortOrder === 'asc') newOrder = 'desc'
      else if (sortOrder === 'desc') {
        newField = null
        newOrder = null
      }
    }
    setSort(newField, newOrder)
    sortItems(newField, newOrder)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border/40 text-muted-foreground/50 bg-background sticky top-0 z-10 grid grid-cols-[24px_2.5rem_1fr_9.5rem] items-center gap-3 border-b px-3 py-2 text-[11px] font-semibold tracking-wider uppercase md:grid-cols-[24px_2.5rem_1fr_9.5rem_8rem_6rem]">
        <div
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border transition-all duration-150',
            isAllSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:border-muted-foreground/40'
          )}
          onClick={handleSelectAll}
        >
          {isAllSelected && <Check className="h-3 w-3" strokeWidth={3} />}
        </div>
        <span></span>
        <button
          className="hover:text-foreground flex cursor-pointer items-center gap-1 truncate transition-colors"
          onClick={() => handleColumnSort('name')}
        >
          Name{' '}
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
          onClick={() => handleColumnSort('size')}
        >
          Size{' '}
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

      {/* Virtualized List */}
      <div ref={parentRef} className="flex-1 overflow-auto px-4 sm:px-6">
        <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = allItems[virtualRow.index]
            const folderCheck = isFolder(item)
            return (
              <div
                key={item.id}
                className="absolute top-0 left-0 w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <FileRow
                  item={item}
                  isSelected={selectedFileIds.has(item.id)}
                  onClick={() => (folderCheck ? onFolderClick(item) : onFileClick(item))}
                  onSelect={() => onFileSelect(item.id)}
                  onShare={(item) => onShare(item, folderCheck)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
