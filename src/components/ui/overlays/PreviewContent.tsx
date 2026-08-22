import { useEffect, useState } from 'react'
import { Button } from '@ui/Button'
import { Loader2, Download, AlertCircle, Lock } from 'lucide-react'
import { cn } from '@lib/utils'
import { useFileStore, selectFileById } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
import { useAuthStore } from '@stores/authStore'
import { downloadFile, DownloadError } from '@services/files/downloadOrchestrator'
import { FileIcon } from '@/components/features/vault/fileList/FileIcon'
import { ZipPreview } from './ZipPreview'

const previewCache = new Map<string, string>()

export function PreviewContent() {
  const fileId = usePreviewStore((s) => s.fileId)
  const isFullscreen = usePreviewStore((s) => s.isFullscreen)
  const isLoading = usePreviewStore((s) => s.isLoading)
  const setLoading = usePreviewStore((s) => s.setLoading)

  const file = useFileStore(selectFileById(fileId))
  const dek = useAuthStore((s) => s.cryptoState.dek)

  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isZip = file?.mimeType === 'application/zip' || file?.name.toLowerCase().endsWith('.zip')

  useEffect(() => {
    if (!fileId || !dek || !file || isZip) return

    let objectUrl: string | null = null
    const fetchFile = async () => {
      try {
        setLoading(true)
        setError(null)
        setBlobUrl(null)

        if (previewCache.has(fileId)) {
          setBlobUrl(previewCache.get(fileId)!)
          setLoading(false)
          return
        }

        const response = await downloadFile({ dek, fileId })
        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        previewCache.set(fileId, objectUrl)
        setBlobUrl(objectUrl)
      } catch (err) {
        if (err instanceof DownloadError) {
          setError(err.message)
        } else {
          setError('Failed to load preview.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchFile()

    return () => {
      if (objectUrl && !previewCache.has(fileId)) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [fileId, dek, file, setLoading, isZip])

  if (!file) return null
  if (isZip) return <ZipPreview fileId={file.id} fileName={file.name} />

  const isImage = file.mimeType?.startsWith('image/')
  const isPdf = file.mimeType === 'application/pdf'
  const isText = file.mimeType?.startsWith('text/') || file.mimeType === 'application/document'

  const contentAreaClasses = isFullscreen
    ? 'flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative bg-black/95'
    : 'flex-1 flex items-center justify-center p-4 md:p-6 overflow-hidden relative bg-muted/40'

  if (!dek) {
    return (
      <div className={contentAreaClasses}>
        <div className="flex flex-col items-center gap-4 text-center">
          <Lock className="text-muted-foreground h-10 w-10" />
          <h3 className="text-lg font-semibold">Vault Locked</h3>
          <p className="text-muted-foreground text-sm">
            Please unlock your vault to preview files.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={contentAreaClasses}>
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="text-destructive h-10 w-10" />
          <h3 className="text-lg font-semibold">Preview Failed</h3>
          <p className="text-muted-foreground max-w-sm text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={contentAreaClasses}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )}
      <div
        className={cn(
          'border-border/50 bg-card flex h-full w-full max-w-full flex-col items-center justify-center overflow-hidden rounded-xl border shadow-lg',
          isFullscreen && 'max-h-[85vh] max-w-5xl'
        )}
      >
        {isImage && (
          <img
            src={blobUrl ?? ''}
            alt={file.name}
            className={cn(
              'max-h-full max-w-full object-contain transition-opacity',
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
              'h-full w-full transition-opacity',
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
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium"
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
              'h-full w-full bg-white transition-opacity',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
            title={file.name}
          />
        )}
        {!isImage && !isPdf && !isText && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="bg-secondary mb-5 flex h-20 w-20 items-center justify-center rounded-2xl">
              <FileIcon
                mimeType={file.mimeType}
                size="lg"
                className="text-muted-foreground bg-transparent"
              />
            </div>
            <h3 className="text-foreground mb-1 text-lg font-semibold">No preview available</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
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
