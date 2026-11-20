import { lazy, Suspense, Component, useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, File as FileIcon, Minus, Music, Plus, RotateCw } from 'lucide-react'
import { PreviewEmpty } from './PreviewEmpty'
import { VaultLoader } from '@/components/ui/feedback/VaultLoader'

const ModelViewer = lazy(() => import('./ModelViewer'))
const LazyPdfPreview = lazy(() => import('./PdfPreview').then((m) => ({ default: m.PdfPreview })))
const EpubViewer = lazy(() => import('react-epub-viewer').then((m) => ({ default: m.EpubViewer })))
const LazyMarkdown = lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ])
  return {
    default: function MarkdownViewer({ children }: { children: string }) {
      return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    },
  }
})
const LazyCodeBlock = lazy(async () => {
  const [{ Prism: SyntaxHighlighter }, { vscDarkPlus }] = await Promise.all([
    import('react-syntax-highlighter'),
    import('react-syntax-highlighter/dist/esm/styles/prism'),
  ])
  return {
    default: function CodeBlock({ language, children }: { language: string; children: string }) {
      return (
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers
          wrapLongLines
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '13px',
          }}
        >
          {children}
        </SyntaxHighlighter>
      )
    },
  }
})

interface FilePreviewerProps {
  fileName: string
  fileUrl: string | null
  fileText: string | null
  onDownload: () => void
  onOpenWith?: () => void
  /** Reports natural dimensions back to the drawer header meta. */
  onImageMeta?: (width: number, height: number) => void
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}
interface ErrorBoundaryState {
  hasError: boolean
}
class PreviewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

const MAX_TEXT_PREVIEW_SIZE = 5 * 1024 * 1024
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

/**
 * In-viewer renderers (Files-Preview sheet): the image sits centered with
 * the exact zoom pill (− 100% + ⟳ · 34 high · r10 · white · pill
 * elevation) at 14 from the bottom; PDFs are paged with the page pill;
 * video/audio/text/code/markdown/EPUB/3D keep their renderers on the
 * sheet's viewer surface; anything that cannot render gets the sheet's
 * no-preview block.
 */
export function FilePreviewer({
  fileName,
  fileUrl,
  fileText,
  onDownload,
  onOpenWith,
  onImageMeta,
}: FilePreviewerProps) {
  const [autoText, setAutoText] = useState<string | null>(fileText)
  const [textError, setTextError] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [pdfFailed, setPdfFailed] = useState(false)
  const [zoom, setZoom] = useState(1)

  useEffect(() => setZoom(1), [fileUrl])

  useEffect(() => {
    if (fileText !== null) {
      setAutoText(fileText)
      setTextError(null)
      return
    }
    if (!fileUrl) {
      setAutoText(null)
      return
    }
    setAutoText(null)
    setTextError(null)
    fetch(fileUrl)
      .then((res) => res.blob())
      .then((blob) => {
        if (blob.size > MAX_TEXT_PREVIEW_SIZE) {
          setTextError('File too large to preview as text. Please download to view.')
          return null
        }
        return blob.text()
      })
      .then((text) => {
        if (text) setAutoText(text)
      })
      .catch(() => setTextError('Failed to load text content.'))
  }, [fileText, fileUrl])

  useEffect(() => {
    setPdfData(null)
    setPdfFailed(false)
    if (!isPdfName(fileName) || !fileUrl) return
    let cancelled = false
    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load PDF')
        return res.arrayBuffer()
      })
      .then((buf) => {
        if (!cancelled) setPdfData(buf)
      })
      .catch(() => {
        if (!cancelled) setPdfFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [fileName, fileUrl])

  const displayText = fileText !== null ? fileText : autoText

  if (textError) {
    return (
      <PreviewEmpty
        icon={AlertCircle}
        title="Preview not available"
        description={textError}
        onDownload={onDownload}
        onOpenWith={onOpenWith}
      />
    )
  }

  if (isPdfName(fileName)) {
    if (pdfData) {
      return (
        <div className="h-full w-full overflow-hidden">
          <Suspense fallback={<VaultLoader size={32} />}>
            <LazyPdfPreview data={pdfData} fileName={fileName} onDownload={onDownload} />
          </Suspense>
        </div>
      )
    }
    if (fileUrl && !pdfFailed) return <VaultLoader size={32} />
    return (
      <PreviewEmpty
        icon={FileIcon}
        title="PDF preview"
        description="Download to view this PDF."
        onDownload={onDownload}
        onOpenWith={onOpenWith}
      />
    )
  }

  if (isImageName(fileName)) {
    if (!fileUrl) return <VaultLoader size={32} />
    return (
      <>
        <div className="h-full w-full overflow-auto">
          <div
            className="flex min-h-full min-w-full items-center justify-center"
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
          >
            <img
              src={fileUrl}
              alt={fileName}
              className="uv-preview-img max-h-full max-w-full"
              draggable={false}
              onLoad={(e) => onImageMeta?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
            />
          </div>
        </div>
        {/* Zoom pill — sheet exact: − 100% + ⟳ */}
        <div className="uv-preview-zoom">
          <button
            type="button"
            className="uv-preview-zoom-btn"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
          >
            <Minus className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden="true" />
          </button>
          <span className="uv-preview-zoom-value">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="uv-preview-zoom-btn"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
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
      </>
    )
  }

  if (isVideoName(fileName) && fileUrl) {
    return (
      <video src={fileUrl} controls className="uv-preview-img h-full w-auto" />
    )
  }

  if (isAudioName(fileName) && fileUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6">
        <div className="uv-preview-empty-icon">
          <Music className="h-[26px] w-[26px]" strokeWidth={1.6} aria-hidden="true" />
        </div>
        <audio src={fileUrl} controls className="w-full max-w-[280px]" />
      </div>
    )
  }

  if (isMarkdownName(fileName) && displayText !== null) {
    return (
      <PreviewErrorBoundary
        fallback={
          <PreviewEmpty
            icon={AlertCircle}
            title="Preview not available"
            description="Failed to render markdown."
            onDownload={onDownload}
            onOpenWith={onOpenWith}
          />
        }
      >
        <div className="markdown-body h-full w-full overflow-auto px-6 py-5">
          <div className="mx-auto max-w-[560px]">
            <Suspense fallback={<VaultLoader size={32} />}>
              <LazyMarkdown>{displayText}</LazyMarkdown>
            </Suspense>
          </div>
        </div>
      </PreviewErrorBoundary>
    )
  }

  if (isCodeName(fileName) && displayText !== null) {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'text'
    return (
      <PreviewErrorBoundary
        fallback={
          <PreviewEmpty
            icon={AlertCircle}
            title="Preview not available"
            description="Failed to render code."
            onDownload={onDownload}
            onOpenWith={onOpenWith}
          />
        }
      >
        <div className="h-full w-full overflow-auto rounded-md bg-[#1e1e1e]">
          <Suspense fallback={<VaultLoader size={32} />}>
            <LazyCodeBlock language={EXT_TO_PRISM[ext] ?? 'text'}>{displayText}</LazyCodeBlock>
          </Suspense>
        </div>
      </PreviewErrorBoundary>
    )
  }

  if (isPlainName(fileName) && displayText !== null) {
    return (
      <div className="h-full w-full overflow-auto px-6 py-5">
        <pre className="font-mono text-body-text break-words whitespace-pre-wrap text-[13px] leading-[22px]">
          {displayText}
        </pre>
      </div>
    )
  }

  if (isModelName(fileName) && fileUrl) {
    return (
      <PreviewErrorBoundary
        fallback={
          <PreviewEmpty
            icon={AlertCircle}
            title="Preview not available"
            description="The 3D file is invalid or corrupted."
            onDownload={onDownload}
            onOpenWith={onOpenWith}
          />
        }
      >
        <Suspense fallback={<VaultLoader size={32} />}>
          <ModelViewer url={fileUrl} />
        </Suspense>
      </PreviewErrorBoundary>
    )
  }

  if (isEpubName(fileName) && fileUrl) {
    return (
      <PreviewErrorBoundary
        fallback={
          <PreviewEmpty
            icon={AlertCircle}
            title="Preview not available"
            description="The EPUB file is invalid or corrupted."
            onDownload={onDownload}
            onOpenWith={onOpenWith}
          />
        }
      >
        <Suspense fallback={<VaultLoader size={32} />}>
          <div className="h-full w-full bg-popover">
            <EpubViewer url={fileUrl} />
          </div>
        </Suspense>
      </PreviewErrorBoundary>
    )
  }

  /* Still decrypting, or nothing renderable. */
  if (!fileUrl && displayText === null) {
    return <VaultLoader size={32} />
  }

  return (
    <PreviewEmpty
      icon={FileIcon}
      title="Preview not available"
      description="Download the file to view it on this device."
      onDownload={onDownload}
      onOpenWith={onOpenWith}
    />
  )
}

/* ---- extension helpers (single place, used by this viewer only) ---- */
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'ogv']
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
const MARKDOWN_EXTS = ['md', 'markdown']
const PLAIN_EXTS = ['txt', 'log', 'csv', 'tsv']
const EPUB_EXTS = ['epub']
const MODEL_EXTS = ['gltf', 'glb']
const CODE_EXTS = new Set([
  'js', 'ts', 'tsx', 'jsx', 'rs', 'py', 'go', 'java', 'c', 'cpp', 'cs', 'rb', 'php',
  'swift', 'kt', 'scala', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'sql', 'json',
  'xml', 'html', 'css', 'scss', 'less', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config',
  'env', 'dockerfile', 'vue', 'svelte', 'graphql', 'gql',
])
const EXT_TO_PRISM: Record<string, string> = {
  js: 'javascript', ts: 'typescript', tsx: 'tsx', jsx: 'jsx', rs: 'rust', py: 'python',
  go: 'go', java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp', rb: 'ruby', php: 'php',
  swift: 'swift', kt: 'kotlin', scala: 'scala', sh: 'bash', bash: 'bash', zsh: 'bash',
  ps1: 'powershell', bat: 'batch', cmd: 'batch', sql: 'sql', json: 'json', xml: 'xml',
  html: 'markup', css: 'css', scss: 'scss', less: 'less', yaml: 'yaml', yml: 'yaml',
  toml: 'toml', ini: 'ini', conf: 'ini', config: 'ini', env: 'bash', dockerfile: 'docker',
  vue: 'markup', svelte: 'markup', graphql: 'graphql', gql: 'graphql',
}

const extOf = (fileName: string) => fileName.split('.').pop()?.toLowerCase() || ''
const isImageName = (n: string) => IMAGE_EXTS.includes(extOf(n))
const isVideoName = (n: string) => VIDEO_EXTS.includes(extOf(n))
const isAudioName = (n: string) => AUDIO_EXTS.includes(extOf(n))
const isMarkdownName = (n: string) => MARKDOWN_EXTS.includes(extOf(n))
const isPlainName = (n: string) => PLAIN_EXTS.includes(extOf(n))
const isEpubName = (n: string) => EPUB_EXTS.includes(extOf(n))
const isModelName = (n: string) => MODEL_EXTS.includes(extOf(n))
const isCodeName = (n: string) => CODE_EXTS.has(extOf(n))
function isPdfName(n: string) {
  return extOf(n) === 'pdf'
}
