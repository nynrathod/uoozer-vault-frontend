import { useEffect, useRef, useState } from 'react'
import { ZipReader, BlobReader, BlobWriter } from '@zip.js/zip.js'
import { downloadFile } from '@services/files/downloadOrchestrator'
import { useAuthStore } from '@stores/authStore'
import { Loader2, File, Folder, Download, ArrowLeft, Eye } from 'lucide-react'
import { cn, formatBytes } from '@lib/utils'

interface ZipPreviewProps {
  fileId: string
  fileName: string
}
const MAX_EXTRACTION_SIZE = 100 * 1024 * 1024

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext))
    return `image/${ext === 'jpg' ? 'jpeg' : ext}`
  if (ext === 'pdf') return 'application/pdf'
  if (['txt', 'md', 'sql', 'rs', 'ts', 'js', 'json', 'html', 'css'].includes(ext))
    return 'text/plain'
  return 'application/octet-stream'
}

export function ZipPreview({ fileId, fileName }: ZipPreviewProps) {
  const [entries, setEntries] = useState<{ filename: string; directory: boolean; entry: any }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string | null>(null)
  const dek = useAuthStore((s) => s.cryptoState.dek)

  const readerRef = useRef<ZipReader<BlobReader> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    async function loadZip() {
      if (!dek) return
      setIsLoading(true)
      setError(null)

      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const blob = await downloadFile({ dek, fileId, signal: controller.signal })
        if (controller.signal.aborted) return

        const reader = new ZipReader(new BlobReader(blob))
        readerRef.current = reader
        const zipEntries = await reader.getEntries()
        if (controller.signal.aborted) return

        setEntries(
          zipEntries.map((e) => ({ filename: e.filename, directory: e.directory, entry: e }))
        )
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Failed to read zip', err)
        setError('Failed to read ZIP archive.')
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    loadZip()

    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (readerRef.current) {
        readerRef.current.close().catch(() => {})
        readerRef.current = null
      }
      setPreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url)
        return null
      })
    }
  }, [fileId, dek])

  const handleExtractFile = async (entry: any, isDownload: boolean = false) => {
    if (!entry || entry.directory) return
    try {
      setIsLoading(true)
      setError(null)

      if (entry.uncompressedSize && entry.uncompressedSize > MAX_EXTRACTION_SIZE) {
        setError(
          `File too large to extract: ${formatBytes(entry.uncompressedSize)}. ` +
            `Maximum is ${formatBytes(MAX_EXTRACTION_SIZE)}.`
        )
        return
      }

      const mimeType = getMimeType(entry.filename)
      const blob = await entry.getData(new BlobWriter(mimeType))

      if (blob.size > MAX_EXTRACTION_SIZE) {
        setError(
          `File too large to extract: ${formatBytes(blob.size)}. ` +
            `Maximum is ${formatBytes(MAX_EXTRACTION_SIZE)}.`
        )
        return
      }

      if (isDownload) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = entry.filename.split('/').pop() || 'extracted_file'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        setPreviewUrl((oldUrl) => {
          if (oldUrl) URL.revokeObjectURL(oldUrl)
          return URL.createObjectURL(blob)
        })
        setPreviewName(entry.filename.split('/').pop())
      }
    } catch (err) {
      console.error('Extraction failed', err)
      setError('Failed to extract file from ZIP.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error && entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
          <File className="text-muted-foreground h-8 w-8" />
        </div>
        <div>
          <p className="text-foreground font-medium">Preview Error</p>
          <p className="text-muted-foreground mt-1 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (previewUrl) {
    return (
      <div className="bg-background flex h-full flex-col">
        <div className="border-border/60 flex items-center justify-between border-b p-2">
          <button
            onClick={() => {
              URL.revokeObjectURL(previewUrl)
              setPreviewUrl(null)
              setPreviewName(null)
            }}
            className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Back to ZIP
          </button>
          <span className="truncate px-2 text-sm font-medium">{previewName}</span>
        </div>
        <iframe
          src={previewUrl}
          className="h-full w-full bg-white"
          title={previewName || 'preview'}
        />
      </div>
    )
  }

  return (
    <div className="bg-background flex h-full flex-col p-4">
      <h3 className="mb-4 text-sm font-semibold">Contents of {fileName}</h3>
      <div className="border-border/60 flex-1 overflow-y-auto rounded-lg border">
        {entries.length === 0 ? (
          <div className="text-muted-foreground p-4 text-center text-sm">ZIP archive is empty.</div>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={idx}
              className={cn(
                'border-border/40 flex items-center justify-between border-b p-2.5 transition-colors last:border-b-0',
                !entry.directory && 'hover:bg-accent/50'
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {entry.directory ? (
                  <Folder className="h-4 w-4 shrink-0 text-blue-500" />
                ) : (
                  <File className="text-muted-foreground h-4 w-4 shrink-0" />
                )}
                <span className="truncate text-[13px]">{entry.filename}</span>
              </div>

              {!entry.directory && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleExtractFile(entry.entry, false)}
                    className="text-muted-foreground hover:bg-accent hover:text-primary rounded-md p-1.5"
                    title="Preview file"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleExtractFile(entry.entry, true)}
                    className="text-muted-foreground hover:bg-accent hover:text-primary rounded-md p-1.5"
                    title="Download file"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
