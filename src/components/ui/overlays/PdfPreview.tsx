import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { FileText, Loader2, ShieldCheck, Minus, Plus, RotateCw } from 'lucide-react'


pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfPreviewProps {
  data: ArrayBuffer
  fileName: string
  onDownload?: () => void
}

const MAX_PAGE_WIDTH = 896
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1

/**
 * Continuous, Google Drive-style PDF preview.
 *
 * - Uses the existing react-pdf dependency; no additional package is required.
 * - Renders every page in one vertically scrolling document.
 * - Keeps the file header and security footer outside the scroll container.
 * - Fits pages to the available width up to MAX_PAGE_WIDTH at 100% zoom.
 * - Allows zooming from 50% to 250%; zoomed pages can scroll horizontally.
 */
export function PdfPreview({ data, fileName, onDownload }: PdfPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [numPages, setNumPages] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [containerWidth, setContainerWidth] = useState(MAX_PAGE_WIDTH)
  const [loadError, setLoadError] = useState<string | null>(null)

  const pdfFile = useMemo(
    () => new File([data], fileName, { type: 'application/pdf' }),
    [data, fileName]
  )

  // Observe the actual document viewport so the PDF fits without filling
  // excessively wide monitors. The 896px cap keeps a comfortable page width.
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.max(1, entry.contentRect.width))
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setZoom(1)
    setNumPages(0)
    setLoadError(null)
  }, [data])

  const pageWidth = Math.max(1, Math.min(containerWidth, MAX_PAGE_WIDTH))

  const onDocumentLoadSuccess = useCallback(({ numPages: totalPages }: { numPages: number }) => {
    setNumPages(totalPages)
    setLoadError(null)
  }, [])

  const onDocumentLoadError = useCallback((error: Error) => {
    setLoadError(error.message || 'Unable to load this PDF.')
  }, [])

  const handleZoomOut = () => {
    setZoom((current) => Math.max(MIN_ZOOM, Math.round((current - ZOOM_STEP) * 100) / 100))
  }

  const handleZoomIn = () => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.round((current + ZOOM_STEP) * 100) / 100))
  }

  const handleDownload = () => {
    if (onDownload) {
      onDownload()
      return
    }

    const blob = new Blob([data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="bg-background flex h-full min-h-0 w-full flex-col overflow-hidden">
      {/* File status stays fixed while the document scrolls */}
      <div className="bg-background text-meta text-muted-foreground flex min-h-10 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 py-2">
        <ShieldCheck className="text-sealed h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        <span>Decrypted in your browser</span>
        {numPages > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {numPages} {numPages === 1 ? 'page' : 'pages'}
            </span>
          </>
        )}
      </div>

      {/* Only this region scrolls. Pages are centered and capped at 896px. */}
      <main
        ref={scrollRef}
        className="bg-active-surface relative min-h-0 flex-1 overflow-auto overscroll-contain px-3 py-5 sm:px-6"
        aria-label="PDF document"
      >
        {loadError ? (
          <div className="flex min-h-96 flex-col items-center justify-center gap-2 text-center">
            <FileText className="text-failed h-8 w-8" />
            <p className="text-foreground text-sm font-medium">Failed to load PDF</p>
            <p className="text-failed text-meta">{loadError}</p>
          </div>
        ) : (
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex min-h-96 flex-col items-center justify-center gap-3">
                <Loader2 className="text-primary h-7 w-7 animate-spin" />
                <p className="text-muted-foreground text-sm">Loading PDF...</p>
              </div>
            }
            error={
              <div className="flex min-h-96 items-center justify-center">
                <p className="text-failed text-sm">Failed to load PDF.</p>
              </div>
            }
            className="mx-auto flex w-max min-w-full flex-col items-center gap-5"
          >
            {Array.from({ length: numPages }, (_, index) => (
              <div
                key={`${fileName}-page-${index + 1}`}
                className="bg-card ring-line mx-auto w-fit shrink-0 overflow-hidden rounded-sm shadow-md ring-1"
              >
                <Page
                  pageNumber={index + 1}
                  width={pageWidth}
                  scale={zoom}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={
                    <div className="flex min-h-96 w-full items-center justify-center">
                      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                    </div>
                  }
                />
              </div>
            ))}
          </Document>
        )}
      </main>

      {/* Fixed footer: zoom controls stay visible and never scroll with the PDF. */}
      <footer className="bg-background border-border/60 grid min-h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t">
        <div className="text-muted-foreground text-meta hidden min-w-0 items-center gap-2 sm:flex">
          <ShieldCheck className="text-sealed h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          <span className="truncate">
            Uoozer can't see this file. Only people with the link can.
          </span>
        </div>

        <div className="uv-preview-zoom col-start-2" role="group" aria-label="PDF zoom controls">
          <button
            type="button"
            className="uv-preview-zoom-btn"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={handleZoomOut}
          >
            <Minus className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden="true" />
          </button>

          <span className="uv-preview-zoom-value" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            className="uv-preview-zoom-btn"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={handleZoomIn}
          >
            <Plus className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="uv-preview-zoom-btn"
            aria-label="Reset zoom"
            title="Reset zoom"
            disabled={zoom === 1}
            onClick={() => setZoom(1)}
          >
            <RotateCw className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>

        <span aria-hidden="true" />
      </footer>
    </div>
  )
}
