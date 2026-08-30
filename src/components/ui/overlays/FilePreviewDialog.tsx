import { useEffect } from 'react'
import { useFileStore, selectFileById } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
import { PreviewContent } from './PreviewContent'
import { PreviewFooter } from './PreviewFooter'
import { PreviewHeader } from './PreviewHeader'

/** Full-screen or panel file preview orchestrating header, content, and footer. */
export function FilePreviewDialog() {
  const fileId = usePreviewStore((s) => s.fileId)
  const isFullscreen = usePreviewStore((s) => s.isFullscreen)
  const isEditing = usePreviewStore((s) => s.isEditing)
  const close = usePreviewStore((s) => s.close)
  const setEditing = usePreviewStore((s) => s.setEditing)

  const file = useFileStore(selectFileById(fileId))

  useEffect(() => {
    if (fileId) {
      setEditing(false)
    }
  }, [fileId, setEditing])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fileId) {
        if (isEditing) setEditing(false)
        else close()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fileId, close, isEditing, setEditing])

  if (!fileId || !file) return null

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-[150] flex flex-col bg-background/95 backdrop-blur-xl animate-fade-in'
    : 'flex flex-col h-full w-full bg-background animate-fade-in'

  return (
    <div className={containerClasses}>
      <PreviewHeader />
      <PreviewContent />
      {!isFullscreen && <PreviewFooter />}
    </div>
  )
}
