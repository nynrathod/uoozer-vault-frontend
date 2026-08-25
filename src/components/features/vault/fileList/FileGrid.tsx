import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FileCard } from './FileCard'
import { useFileStore } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
import { isFolder } from '@/lib/type-guards'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

interface FileGridProps {
  files: FileItem[]
  folders: Folder[]
  folderCounts?: Record<string, number>
}

/** Virtualized grid of file/folder cards. */
export function FileGrid({ files, folders, folderCounts }: FileGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  // Folders always appear before files
  const allItems = [...folders, ...files]

  // Fixed column count for virtualizer row calculation;
  // responsive column count is handled by CSS grid-cols at each breakpoint
  const columns = 6
  const rows = Math.ceil(allItems.length / columns)

  // Virtualize rows of cards rather than individual cards to keep grid layout intact
  const rowVirtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 2,
  })

  const editingId = useFileStore((s) => s.editingId)
  const setEditingId = useFileStore((s) => s.setEditingId)
  const selectedFileIds = useFileStore((s) => s.selectedFileIds)

  const openPreview = usePreviewStore((s) => s.open)

  return (
    <div ref={parentRef} className="h-full overflow-auto p-4">
      <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns
          const rowItems = allItems.slice(startIndex, startIndex + columns)

          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowItems.map((item) => {
                const folderCheck = isFolder(item)
                return (
                  <FileCard
                    key={item.uid}
                    item={item}
                    isSelected={selectedFileIds.has(item.id)}
                    onClick={() => {
                      if (item.deletedAt) return
                      if (!folderCheck) openPreview(item.id)
                    }}

                    editingId={editingId}
                    onRenameRequest={setEditingId}
                    itemCount={folderCheck ? folderCounts?.[item.id] || 0 : 0}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
