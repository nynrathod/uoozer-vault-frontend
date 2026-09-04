import { useCallback, useEffect, useMemo, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfPreviewProps {
  data: ArrayBuffer
  fileName: string
  onDownload?: () => void
}

export function PdfPreview({ data, fileName, onDownload }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [, setIsLoading] = useState(true)

  const pdfFile = useMemo(
    () => new File([data], fileName, { type: 'application/pdf' }),
    [data, fileName]
  )

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
    setLoadError(null)
  }, [])

  const onDocumentLoadError = useCallback((error: Error) => {
    setIsLoading(false)
    setLoadError(error.message)
  }, [])

  useEffect(() => {
    setScale(1.0)
    setNumPages(0)
    setIsLoading(true)
    setLoadError(null)
  }, [data])

  const handleDownload = () => {
    if (onDownload) {
      onDownload()
      return
    }
    const blob = new Blob([data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="relative flex h-full flex-col bg-neutral-100">
      <div className="z-10 flex items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2.5 text-sm">
        <span className="max-w-[240px] truncate font-medium text-neutral-800">{fileName}</span>
        {numPages > 0 && (
          <span className="text-neutral-400">
            {numPages} {numPages === 1 ? 'page' : 'pages'}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loadError ? (
          <div className="flex h-full items-center justify-center text-red-500">
            <div className="text-center">
              <p className="text-lg font-medium">Failed to load PDF</p>
              <p className="mt-1 text-sm text-red-400">{loadError}</p>
            </div>
          </div>
        ) : (
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex h-full items-center justify-center text-neutral-400">
                <div className="text-center">
                  <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-500" />
                  <p className="text-sm">Loading PDF…</p>
                </div>
              </div>
            }
            error={
              <div className="flex h-full items-center justify-center text-red-500">
                <p>Failed to load PDF</p>
              </div>
            }
            className="pt-6"
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page
                key={`page_${i}`}
                pageNumber={i + 1}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="mx-auto mb-4 w-fit bg-white shadow-md"
                loading={
                  <div className="flex h-[400px] w-[600px] items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-500" />
                  </div>
                }
              />
            ))}
          </Document>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 shadow-lg">
        <button
          onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
          className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => setScale(1.0)}
          className="min-w-[48px] rounded-full py-0.5 text-center text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
          title="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={() => setScale((s) => Math.min(3.0, s + 0.25))}
          className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100"
          title="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  )
}
