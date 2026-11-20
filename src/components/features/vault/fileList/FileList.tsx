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

const HEADER_GRID =
  'grid grid-cols-[40px_minmax(0,1fr)] md:grid-cols-[40px_minmax(0,1fr)_180px_100px_150px]'

export function FileList({
  files,
  folders,
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
    estimateSize: () => 48,
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
    if (isAllSelected) {
      clearSelection()
    } else {
      selectAll(allItems.map((item) => item.id))
    }
  }

  const handleColumnSort = (field: 'name' | 'size' | 'modified') => {
    let newField: 'name' | 'size' | 'modified' | null = field
    let newOrder: 'asc' | 'desc' | null = 'asc'

    if (sortField === field) {
      if (sortOrder === 'asc') {
        newOrder = 'desc'
      } else if (sortOrder === 'desc') {
        newField = null
        newOrder = null
      }
    }

    setSort(newField, newOrder)
    sortItems(newField, newOrder)
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Table Header */}
      <div
        className={`${HEADER_GRID} border-border/40 text-muted-foreground bg-background sticky top-0 z-10 items-center gap-2 border-b px-4 py-2.5 text-[11px] font-semibold tracking-wider`}
      >
        {/* Checkbox */}
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
            className="data-[state=unchecked]:hover:border-muted-foreground/40"
          />
        </div>

        {/* Name */}
        <button
          className="hover:text-foreground flex min-w-0 cursor-pointer items-center gap-1 text-left transition-colors"
          onClick={() => handleColumnSort('name')}
        >
          <span>Name</span>
          {sortField === 'name' ? (
            sortOrder === 'asc' ? (
              <ChevronUp className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0" />
            )
          ) : (
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
          )}
        </button>

        {/* Modified */}
        <div className="hidden text-left whitespace-nowrap md:block">Modified</div>

        {/* Size */}
        <button
          className="hover:text-foreground hidden cursor-pointer items-center gap-1 text-left transition-colors md:flex"
          onClick={() => handleColumnSort('size')}
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

        {/* Actions column placeholder */}
        <div className="hidden md:block" />
      </div>

      {/* File Rows */}
      <div ref={parentRef} className="min-w-0 flex-1 overflow-auto px-4">
        <div
          className="relative w-full py-2"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
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

                    if (folderCheck) {
                      onFolderClick(item)
                    } else {
                      onFileClick(item)
                    }
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
