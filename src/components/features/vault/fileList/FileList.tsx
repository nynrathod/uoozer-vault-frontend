import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { FileRow } from './FileRow'
import { useFileStore } from '@stores/fileStore'
import { isFolder } from '@/lib/type-guards'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'
import { Checkbox } from '@/components/ui/primitives/Checkbox'

interface FileListProps {
  files: FileItem[]
  folders: Folder[]
  folderCounts?: Record<string, number>
  onFolderClick: (folder: Folder) => void
  onFileClick: (file: FileItem) => void
  onFileSelect: (id: string) => void
  onShare: (item: FileItem | Folder, isFolder: boolean) => void
}

/** Virtualized list view for files and folders with sortable columns. */
export function FileList({
  files,
  folders,
  onFolderClick,
  onFileClick,
  onFileSelect,
  onShare,
}: FileListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  // Folders always appear before files
  const allItems = [...folders, ...files]

  const rowVirtualizer = useVirtualizer({
    count: allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // 52px row height + 4px visual gap
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

  // Cycles through ascending → descending → unsorted on repeated clicks
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
      <div className="border-border/40 text-muted-foreground/50 bg-background sticky top-0 z-10 grid grid-cols-[40px_40px_1fr] items-center gap-2 border-b px-4 py-2.5 text-[11px] font-semibold tracking-wider uppercase sm:px-4 md:grid-cols-[40px_40px_1fr_160px_140px_80px]">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
            className="data-[state=unchecked]:hover:border-muted-foreground/40"
          />
        </div>

        <div></div>

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

        <div className="hidden md:block"></div>

        <span className="hidden md:block">Modified</span>

        <button
          className="hover:text-foreground hidden cursor-pointer items-center gap-1 transition-colors md:flex"
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

      <div ref={parentRef} className="flex-1 overflow-auto px-4 sm:px-4">
        <div
          className="relative w-full py-2"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = allItems[virtualRow.index]
            const folderCheck = isFolder(item)
            return (
              <div
                key={item.uid}
                className="absolute top-0 left-0 w-full"
                style={{
                  height: '52px',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <FileRow
                  item={item}
                  isSelected={selectedFileIds.has(item.id)}
                  onClick={() => {
                    if (item.deletedAt) return
                    if (folderCheck) onFolderClick(item)
                    else onFileClick(item)
                  }}
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
