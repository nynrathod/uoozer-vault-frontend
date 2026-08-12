import { useEffect, useState } from 'react'
import { useFileStore, selectFileById } from '@stores/fileStore'
import { PreviewContent } from './PreviewContent'
import { PreviewFooter } from './PreviewFooter'
import { PreviewHeader } from './PreviewHeader'

interface FilePreviewDialogProps {
  fileId: string | null
}

export function FilePreviewDialog({ fileId }: FilePreviewDialogProps) {
  const file = useFileStore(selectFileById(fileId))
  const isFullscreen = useFileStore((s) => s.isPreviewFullscreen)
  const setIsFullscreen = useFileStore((s) => s.setIsPreviewFullscreen)
  const setPreviewFile = useFileStore((s) => s.setPreviewFile)
  const renameItem = useFileStore((s) => s.renameItem)
  const deleteItem = useFileStore((s) => s.deleteItem)
  const setShareTarget = useFileStore((s) => s.setShareTarget)

  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (fileId) {
      setIsLoading(true)
      setIsEditing(false)
      const timer = setTimeout(() => setIsLoading(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [fileId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fileId) {
        if (isEditing) setIsEditing(false)
        else setPreviewFile(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fileId, setPreviewFile, isEditing])

  if (!fileId || !file) return null

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-[150] flex flex-col bg-[#0a0a0a]/95 backdrop-blur-xl animate-fade-in'
    : 'flex flex-col h-full w-full bg-background animate-fade-in'

  return (
    <div className={containerClasses}>
      <PreviewHeader
        file={file}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
        onClose={() => setPreviewFile(null)}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        onRename={(newName) => renameItem(file.id, false, newName)}
        onShare={() => setShareTarget(file.id)}
        onDelete={() => deleteItem(file.id, false)}
      />
      <PreviewContent
        file={file}
        isFullscreen={isFullscreen}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
      />
      {!isFullscreen && <PreviewFooter file={file} />}
    </div>
  )
}
