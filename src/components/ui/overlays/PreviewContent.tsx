import { useEffect, useState } from 'react'
import { Button } from '@ui/Button'
import { Loader2, Download } from 'lucide-react'
import { cn } from '@lib/utils'
import { useFileStore, selectFileById } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
import { useAuthStore } from '@stores/authStore'
import { downloadFile } from '@services/files/downloadOrchestrator'
import { FileIcon } from '@/components/features/vault/fileList/FileIcon'

/** Renders file preview by MIME type (image, PDF, text, or generic fallback). */
export function PreviewContent() {
  const fileId = usePreviewStore((s) => s.fileId)
  const isFullscreen = usePreviewStore((s) => s.isFullscreen)
  const isLoading = usePreviewStore((s) => s.isLoading)
  const setLoading = usePreviewStore((s) => s.setLoading)

  const file = useFileStore(selectFileById(fileId))
  const dek = useAuthStore((s) => s.cryptoState.dek)

  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!fileId || !dek || !file) return

    let objectUrl: string | null = null
    const fetchFile = async () => {
      try {
        setLoading(true)
        setBlobUrl(null)
        const blob = await downloadFile({ dek, fileId })
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      } catch (error) {
        console.error('Failed to load preview:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFile()

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fileId, dek, file, setLoading])

  if (!file) return null

  const isImage = file.mimeType?.startsWith('image/')
  const isPdf = file.mimeType === 'application/pdf'
  const isText = file.mimeType?.startsWith('text/') || file.mimeType === 'application/document'

  const contentAreaClasses = isFullscreen
    ? 'flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative bg-black/95'
    : 'flex-1 flex items-center justify-center p-4 md:p-6 overflow-hidden relative bg-muted/40'

  return (
    <div className={contentAreaClasses}>
      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            isFullscreen ? 'bg-black/95' : 'bg-muted/30'
          )}
        >
          <Loader2
            className={cn(
              'h-8 w-8 animate-spin',
              isFullscreen ? 'text-muted-foreground' : 'text-muted-foreground'
            )}
          />
        </div>
      )}

      <div
        className={cn(
          'bg-card border-border/50 flex h-full max-h-full w-full max-w-full flex-col items-center justify-center overflow-hidden rounded-xl border shadow-lg',
          isFullscreen && 'max-h-[85vh] max-w-5xl'
        )}
      >
        {isImage && (
          <img
            src={blobUrl ?? ''}
            alt={file.name}
            className={cn(
              'max-h-full max-w-full object-contain transition-opacity duration-300',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
            onLoad={() => setLoading(false)}
          />
        )}
        {isPdf && blobUrl && (
          <object
            data={blobUrl}
            type="application/pdf"
            className={cn(
              'h-full w-full transition-opacity duration-300',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
          >
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Your browser does not support inline PDFs.
              </p>
              <a
                href={blobUrl}
                download={file.name}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Download PDF
              </a>
            </div>
          </object>
        )}
        {isText && blobUrl && (
          <iframe
            src={blobUrl}
            className={cn(
              'h-full w-full bg-white transition-opacity duration-300',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
            title={file.name}
          />
        )}
        {!isImage && !isPdf && !isText && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div
              className={cn(
                'mb-5 flex h-20 w-20 items-center justify-center rounded-2xl',
                isFullscreen ? 'bg-white/10' : 'bg-secondary'
              )}
            >
              <FileIcon
                mimeType={file.mimeType}
                size="lg"
                className={cn(
                  'bg-transparent',
                  isFullscreen ? 'text-muted-foreground' : 'text-muted-foreground'
                )}
              />
            </div>
            <h3
              className={cn(
                'mb-1 text-lg font-semibold',
                isFullscreen ? 'text-foreground' : 'text-foreground'
              )}
            >
              No preview available
            </h3>
            <p
              className={cn(
                'mb-6 max-w-sm text-sm',
                isFullscreen ? 'text-muted-foreground' : 'text-muted-foreground'
              )}
            >
              We can't show a preview for this file type in your browser. Please download it to view
              its contents.
            </p>
            {blobUrl && (
              <a href={blobUrl} download={file.name}>
                <Button variant="secondary" className="gap-1.5">
                  <Download className="h-4 w-4" /> Download file
                </Button>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
