import { useEffect, useState } from 'react'
import { useFileStore, selectFileById } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
import { PreviewHeader } from './PreviewHeader'
import { PreviewContent } from './PreviewContent'
import { PreviewFooter } from './PreviewFooter'
import { getCategory, isPreviewableCategory } from './previewCategories'

export type PreviewTab = 'details' | 'versions' | 'activity'

export function FilePreviewDialog() {
  const fileId = usePreviewStore((s) => s.fileId)
  const isFullscreen = usePreviewStore((s) => s.isFullscreen)
  const isEditing = usePreviewStore((s) => s.isEditing)
  const close = usePreviewStore((s) => s.close)
  const setFullscreen = usePreviewStore((s) => s.setFullscreen)
  const setEditing = usePreviewStore((s) => s.setEditing)
  const file = useFileStore(selectFileById(fileId))

  /** Details panel below the viewer (sheet's "Details ▲" + tabs). */
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<PreviewTab>('details')
  /** Extra header meta once known ("1920×1280", "2 pages"). */
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    setDetailsOpen(false)
    setActiveTab('details')
    setDetail(null)
    setEditing(false)
  }, [fileId, setEditing])

  useEffect(() => {
    if (!fileId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) setEditing(false)
        else if (isFullscreen) setFullscreen(false)
        else close()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        setFullscreen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fileId, isEditing, isFullscreen, close, setEditing, setFullscreen])

  if (!fileId || !file) return null

  const category = getCategory(file.name)
  const canPreview = isPreviewableCategory(category)

  const toggleDetails = () => setDetailsOpen((v) => !v)
  const openVersions = () => {
    setDetailsOpen(true)
    setActiveTab('versions')
  }

  const panelBody = (
    <>
      <PreviewHeader
        file={file}
        detail={detail}
        canPreview={canPreview}
        detailsOpen={detailsOpen}
        onToggleDetails={toggleDetails}
        onOpenVersions={openVersions}
      />
      <PreviewContent
        file={file}
        canPreview={canPreview}
        detailsOpen={detailsOpen}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onDetailLoaded={setDetail}
      />
      {canPreview && (
        <PreviewFooter
          category={category}
          detailsOpen={detailsOpen}
          onToggleDetails={toggleDetails}
        />
      )}
    </>
  )

  if (isFullscreen) {
    return (
      <div className="bg-background/95 animate-fade-in fixed inset-0 z-[150] flex items-center justify-center p-3 backdrop-blur-xl sm:p-8">
        <div className="uv-preview-panel uv-preview-panel-fullscreen animate-scale-in max-h-full">
          {panelBody}
        </div>
      </div>
    )
  }

  return <div className="uv-preview-panel animate-fade-in">{panelBody}</div>
}
