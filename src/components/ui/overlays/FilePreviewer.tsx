import { lazy, Suspense, useRef, Component, type ReactNode, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Music, AlertCircle, Download, File as FileIcon, Loader2 } from 'lucide-react'
import { Button } from '@ui/Button'

const ModelViewer = lazy(() => import('./ModelViewer'))
const EpubViewer = lazy(() => import('react-epub-viewer').then((m) => ({ default: m.EpubViewer })))

type FileCategory =
  'image' | 'pdf' | 'video' | 'audio' | 'markdown' | 'code' | 'text' | 'epub' | '3d' | 'other'

const TEXT_EXTENSIONS = new Set([
  'js',
  'ts',
  'tsx',
  'jsx',
  'rs',
  'py',
  'go',
  'java',
  'c',
  'cpp',
  'cs',
  'rb',
  'php',
  'swift',
  'kt',
  'scala',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'bat',
  'cmd',
  'sql',
  'json',
  'xml',
  'html',
  'css',
  'scss',
  'less',
  'yaml',
  'yml',
  'toml',
  'ini',
  'conf',
  'config',
  'env',
  'dockerfile',
  'vue',
  'svelte',
  'graphql',
  'gql',
  'txt',
  'log',
  'csv',
  'tsv',
])

function getCategory(fileName: string): FileCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'].includes(ext))
    return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['mp4', 'webm', 'mov', 'ogv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio'
  if (['md', 'markdown'].includes(ext)) return 'markdown'
  if (TEXT_EXTENSIONS.has(ext)) return 'code'
  if (ext === 'epub') return 'epub'
  if (['gltf', 'glb'].includes(ext)) return '3d'
  return 'other'
}

function getMimeType(category: FileCategory, ext: string): string {
  if (category === 'pdf') return 'application/pdf'
  if (category === 'video') {
    if (ext === 'mp4') return 'video/mp4'
    if (ext === 'webm') return 'video/webm'
    if (ext === 'mov') return 'video/quicktime'
    if (ext === 'ogv') return 'video/ogg'
  }
  if (category === 'audio') {
    if (ext === 'mp3') return 'audio/mpeg'
    if (ext === 'wav') return 'audio/wav'
    if (ext === 'ogg') return 'audio/ogg'
    if (ext === 'flac') return 'audio/flac'
    if (ext === 'm4a') return 'audio/mp4'
    if (ext === 'aac') return 'audio/aac'
  }
  if (category === 'epub') return 'application/epub+zip'
  return 'application/octet-stream'
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}
interface ErrorBoundaryState {
  hasError: boolean
}
class ModelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

interface FilePreviewerProps {
  fileName: string
  fileUrl: string | null
  fileText: string | null
  onDownload: () => void
}

export function FilePreviewer({ fileName, fileUrl, fileText, onDownload }: FilePreviewerProps) {
  const category = getCategory(fileName)
  const epubViewerRef = useRef<any>(null)
  const [autoText, setAutoText] = useState<string | null>(fileText)

  const [fixedUrl, setFixedUrl] = useState<string | null>(fileUrl)

  useEffect(() => {
    if (category === 'code' || category === 'markdown' || category === 'text') {
      if (fileText) {
        setAutoText(fileText)
      } else if (fileUrl) {
        setAutoText(null)
        fetch(fileUrl)
          .then((res) => res.text())
          .then((text) => setAutoText(text))
          .catch(() => setAutoText(''))
      }
    }
  }, [category, fileText, fileUrl])

  useEffect(() => {
    if (
      fileUrl &&
      (category === 'pdf' || category === 'video' || category === 'audio' || category === 'epub')
    ) {
      fetch(fileUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const ext = fileName.split('.').pop()?.toLowerCase() || ''
          const correctType = getMimeType(category, ext)
          const fixedBlob = new Blob([blob], { type: correctType })
          setFixedUrl(URL.createObjectURL(fixedBlob))
        })
        .catch(() => setFixedUrl(fileUrl))
    } else {
      setFixedUrl(fileUrl)
    }
  }, [fileUrl, category, fileName])

  const displayText = fileText !== null ? fileText : autoText

  if (
    (category === 'code' || category === 'markdown' || category === 'text') &&
    displayText === null
  ) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (
    (category === 'pdf' || category === 'video' || category === 'audio' || category === 'epub') &&
    !fixedUrl
  ) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!fixedUrl && displayText === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
          <FileIcon className="text-muted-foreground h-8 w-8" />
        </div>
        <div>
          <p className="text-foreground font-medium">Preparing preview...</p>
          <p className="text-muted-foreground mt-1 text-sm">Decrypting your file securely.</p>
        </div>
      </div>
    )
  }

  if (category === 'image' && fixedUrl)
    return <img src={fixedUrl} alt={fileName} className="h-full w-full object-contain" />

  if (category === 'pdf' && fixedUrl) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="bg-secondary flex justify-center p-2">
          <Button onClick={onDownload} className="gap-2" size="sm">
            <Download className="h-4 w-4" /> Download to verify file integrity
          </Button>
        </div>
        <object data={fixedUrl} type="application/pdf" className="h-full w-full flex-1">
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4 text-center">
            <AlertCircle className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground">Inline PDF preview blocked by browser.</p>
            <Button onClick={onDownload} className="gap-2">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </div>
        </object>
      </div>
    )
  }

  if (category === 'video' && fixedUrl)
    return <video src={fixedUrl} controls autoPlay className="h-full w-full object-contain" />

  if (category === 'audio' && fixedUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
          <Music className="text-muted-foreground h-8 w-8" />
        </div>
        <audio src={fixedUrl} controls autoPlay />
      </div>
    )
  }

  if (category === 'markdown' && displayText !== null) {
    return (
      <div className="markdown-body h-full w-full overflow-auto px-8 py-6">
        <div className="mx-auto max-w-3xl">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
        </div>
      </div>
    )
  }

  if (category === 'code' && displayText !== null) {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'text'
    return (
      <div className="h-full w-full overflow-auto rounded-lg bg-[#1e1e1e]">
        <SyntaxHighlighter
          language={ext}
          style={vscDarkPlus}
          showLineNumbers
          wrapLongLines
          customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
        >
          {displayText}
        </SyntaxHighlighter>
      </div>
    )
  }

  if (category === '3d' && fixedUrl) {
    return (
      <ModelErrorBoundary
        fallback={
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
              <AlertCircle className="text-muted-foreground h-8 w-8" />
            </div>
            <div>
              <p className="text-foreground font-medium">Preview not available</p>
              <p className="text-muted-foreground mt-1 text-sm">
                The 3D file is invalid or corrupted.
              </p>
            </div>
            <Button onClick={onDownload} className="gap-2">
              <Download className="h-4 w-4" /> Download File
            </Button>
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          }
        >
          <ModelViewer url={fixedUrl} />
        </Suspense>
      </ModelErrorBoundary>
    )
  }

  if (category === 'epub' && fixedUrl) {
    return (
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        }
      >
        <div className="h-full w-full bg-white">
          <EpubViewer ref={epubViewerRef} url={fixedUrl} />
        </div>
      </Suspense>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center">
      <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
        <AlertCircle className="text-muted-foreground h-8 w-8" />
      </div>
      <div>
        <p className="text-foreground font-medium">Preview not available</p>
        <p className="text-muted-foreground mt-1 text-sm">Please download the file to view it.</p>
      </div>
      <Button onClick={onDownload} className="gap-2">
        <Download className="h-4 w-4" /> Download File
      </Button>
    </div>
  )
}
