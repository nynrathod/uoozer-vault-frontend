import { useEffect, useRef, useState } from 'react'
import { ZipReader, BlobReader, BlobWriter } from '@zip.js/zip.js'
import { ArrowLeft, Download, File as FileIcon, Folder, Loader2 } from 'lucide-react'
import { cn, formatBytes } from '@lib/utils'

interface ZipPreviewProps {
  /** The already-decrypted archive (PreviewContent keeps the Blob). */
  blob: Blob | null
  fileName: string
}

interface ZipEntryUI {
  filename: string
  directory: boolean
  size: number
  entry: any
}

const MAX_EXTRACTION_SIZE = 100 * 1024 * 1024

function isTopLevel(filename: string): boolean {
  const trimmed = filename.endsWith('/') ? filename.slice(0, -1) : filename
  return !trimmed.includes('/')
}

function baseName(filename: string): string {
  const trimmed = filename.endsWith('/') ? filename.slice(0, -1) : filename
  return trimmed.split('/').pop() || trimmed
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext))
    return `image/${ext === 'jpg' ? 'jpeg' : ext}`
  if (ext === 'pdf') return 'application/pdf'
  if (['txt', 'md', 'sql', 'rs', 'ts', 'js', 'json', 'html', 'css'].includes(ext))
    return 'text/plain'
  return 'application/octet-stream'
}

/**
 * Archive contents for the no-preview layout (Files-Preview sheet,
 * panel 3): "Contents · n items" at 12/500 muted, then 36-high · r6 rows
 * with a 15 ghost icon, the name at 13.5 ink and the size at 12.5 muted.
 * Directories sum their contents' sizes. Clicking a file decrypts just
 * that entry and previews it inline (with a back affordance); the
 * trailing download saves the single entry to disk.
 */
export function ZipPreview({ blob, fileName }: ZipPreviewProps) {
  const [topEntries, setTopEntries] = useState<ZipEntryUI[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string | null>(null)
  const [extractingName, setExtractingName] = useState<string | null>(null)
  const readerRef = useRef<ZipReader<BlobReader> | null>(null)

  useEffect(() => {
    if (!blob) return
    setIsLoading(true)
    setError(null)
    let cancelled = false
    const reader = new ZipReader(new BlobReader(blob))
    readerRef.current = reader
    reader
      .getEntries()
      .then((entries: any[]) => {
        if (cancelled) return
        /* Folder sizes = sum of their contents (sheet shows "src/ 38 MB"). */
        const dirSizes = new Map<string, number>()
        for (const entry of entries) {
          if (entry.directory) continue
          const top = entry.filename.split('/')[0]
          dirSizes.set(top, (dirSizes.get(top) ?? 0) + (entry.uncompressedSize ?? 0))
        }
        const topLevel = entries
          .filter((e) => isTopLevel(e.filename))
          .map((e) => ({
            filename: e.filename,
            directory: e.directory,
            size: e.directory ? (dirSizes.get(baseName(e.filename)) ?? 0) : (e.uncompressedSize ?? 0),
            entry: e,
          }))
        setTopEntries(topLevel)
        setIsLoading(false)
      })
      .catch((err: any) => {
        console.error('Failed to read zip', err)
        if (!cancelled) {
          setError('Failed to read ZIP archive.')
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
      readerRef.current?.close().catch(() => {})
      readerRef.current = null
    }
  }, [blob])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleExtract = async (entry: ZipEntryUI, mode: 'preview' | 'download') => {
    if (!entry || entry.directory) return
    try {
      setExtractingName(entry.filename)
      setError(null)
      if (entry.size > MAX_EXTRACTION_SIZE) {
        setError(
          `File too large to extract: ${formatBytes(entry.size)}. Maximum is ${formatBytes(MAX_EXTRACTION_SIZE)}.`
        )
        return
      }
      const mimeType = getMimeType(entry.filename)
      const extracted = await entry.entry.getData(new BlobWriter(mimeType))
      if (extracted.size > MAX_EXTRACTION_SIZE) {
        setError(
          `File too large to extract: ${formatBytes(extracted.size)}. Maximum is ${formatBytes(MAX_EXTRACTION_SIZE)}.`
        )
        return
      }
      if (mode === 'download') {
        const url = URL.createObjectURL(extracted)
        const a = document.createElement('a')
        a.href = url
        a.download = baseName(entry.filename)
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } else {
        const url = URL.createObjectURL(extracted)
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return url
        })
        setPreviewName(baseName(entry.filename))
      }
    } catch (err) {
      console.error('Extraction failed', err)
      setError('Failed to extract file from ZIP.')
    } finally {
      setExtractingName(null)
    }
  }

  if (previewUrl) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-3.5 pb-3">
        <div className="flex shrink-0 items-center gap-2 pt-2">
          <button
            type="button"
            className="uv-preview-footer-toggle ml-0"
            onClick={() => {
              URL.revokeObjectURL(previewUrl)
              setPreviewUrl(null)
              setPreviewName(null)
            }}
          >
            <ArrowLeft className="h-[13px] w-[13px]" strokeWidth={1.6} aria-hidden="true" />
            Back to contents
          </button>
          <span className="text-muted-foreground truncate text-[12.5px] leading-[18px]">
            {previewName}
          </span>
        </div>
        <iframe
          src={previewUrl}
          className="mt-1.5 min-h-0 w-full flex-1 rounded-md bg-popover"
          title={previewName || 'preview'}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="text-ghost h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (error) {
    return <div className="text-failed px-4 py-3 text-[13px] leading-5">{error}</div>
  }

  if (topEntries.length === 0) {
    return (
      <div className="text-muted-foreground px-4 py-3 text-[13px] leading-5">
        {fileName} is empty.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="uv-preview-contents-label">
        Contents · {topEntries.length} {topEntries.length === 1 ? 'item' : 'items'}
      </div>
      <div className="uv-preview-contents">
        {topEntries.map((entry) => (
          <div key={entry.filename} className="group relative">
            <button
              type="button"
              className={cn('uv-preview-content-row', !entry.directory && 'cursor-pointer')}
              disabled={extractingName === entry.filename}
              onClick={() => entry.directory || void handleExtract(entry, 'preview')}
              title={entry.directory ? entry.filename : `Preview ${baseName(entry.filename)}`}
            >
              {entry.directory ? (
                <Folder className="text-ghost h-[15px] w-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
              ) : (
                <FileIcon className="text-ghost h-[15px] w-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate">{baseName(entry.filename)}</span>
              <span className="uv-preview-content-size">
                {extractingName === entry.filename
                  ? '…'
                  : entry.size > 0
                    ? formatBytes(entry.size)
                    : '—'}
              </span>
            </button>
            {!entry.directory && (
              <button
                type="button"
                className="uv-preview-zoom-btn absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Download ${baseName(entry.filename)}`}
                title={`Download ${baseName(entry.filename)}`}
                onClick={() => void handleExtract(entry, 'download')}
              >
                <Download className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
