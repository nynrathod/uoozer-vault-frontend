import { memo } from 'react'
import { FileCard } from './FileCard'
import { useFileStore } from '@stores/fileStore'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

interface FileGridProps {
  files: FileItem[]
  folders: Folder[]
  folderCounts?: Record<string, number>
}

export const FileGrid = memo(function FileGrid({ files, folders, folderCounts }: FileGridProps) {
  const editingId = useFileStore((s) => s.editingId)
  const setEditingId = useFileStore((s) => s.setEditingId)
  const selectedFileIds = useFileStore((s) => s.selectedFileIds)
  const toggleFileSelection = useFileStore((s) => s.toggleFileSelection)
  const setPreviewFile = useFileStore((s) => s.setPreviewFile)

  const allItems = [...folders, ...files]

  return (
    <div className="grid grid-cols-2 gap-3 overflow-auto p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {allItems.map((item) => {
        const isFolder = 'parentId' in item
        return (
          <FileCard
            key={item.id}
            item={item}
            isFolder={isFolder}
            isSelected={selectedFileIds.has(item.id)}
            onClick={() => (isFolder ? null : setPreviewFile(item.id))}
            onSelect={() => toggleFileSelection(item.id)}
            editingId={editingId}
            onRenameRequest={setEditingId}
            itemCount={isFolder ? folderCounts?.[item.id] || 0 : 0}
          />
        )
      })}
    </div>
  )
})
