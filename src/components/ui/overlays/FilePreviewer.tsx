import { lazy, Suspense, Component, type ReactNode, useEffect, useState } from 'react'
import { Music, AlertCircle, Download, File as FileIcon, Loader2 } from 'lucide-react'
import { Button } from '@ui/Button'

const ModelViewer = lazy(() => import('./ModelViewer'))
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

type FileCategory =
  'image' | 'pdf' | 'video' | 'audio' | 'markdown' | 'code' | 'text' | 'epub' | '3d' | 'other'

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'ogv']
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
const MARKDOWN_EXTS = ['md', 'markdown']
const PLAIN_TEXT_EXTS = ['txt', 'log', 'csv', 'tsv']
const EPUB_EXTS = ['epub']
const MODEL_EXTS = ['gltf', 'glb']

const CODE_EXTS = new Set([
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
])

function getCategory(fileName: string): FileCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  if (AUDIO_EXTS.includes(ext)) return 'audio'
  if (MARKDOWN_EXTS.includes(ext)) return 'markdown'
  if (PLAIN_TEXT_EXTS.includes(ext)) return 'text'
  if (CODE_EXTS.has(ext)) return 'code'
  if (EPUB_EXTS.includes(ext)) return 'epub'
  if (MODEL_EXTS.includes(ext)) return '3d'
  return 'other'
}

const EXT_TO_PRISM: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  rs: 'rust',
  py: 'python',
  go: 'go',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  ps1: 'powershell',
  bat: 'batch',
  cmd: 'batch',
  sql: 'sql',
  json: 'json',
  xml: 'xml',
  html: 'markup',
  css: 'css',
  scss: 'scss',
  less: 'less',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  conf: 'ini',
  config: 'ini',
  env: 'bash',
  dockerfile: 'docker',
  vue: 'markup',
  svelte: 'markup',
  graphql: 'graphql',
  gql: 'graphql',
}

function getPrismLanguage(ext: string): string {
  return EXT_TO_PRISM[ext] || 'text'
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

interface FilePreviewerProps {
  fileName: string
  fileUrl: string | null
  fileText: string | null
  onDownload: () => void
}

export function FilePreviewer({ fileName, fileUrl, fileText, onDownload }: FilePreviewerProps) {
  const category = getCategory(fileName)
  const [autoText, setAutoText] = useState<string | null>(fileText)
  const [textError, setTextError] = useState<string | null>(null)

  useEffect(() => {
    if (category !== 'code' && category !== 'markdown' && category !== 'text') {
      setAutoText(null)
      setTextError(null)
      return
    }
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
  }, [category, fileText, fileUrl])

  const displayText = fileText !== null ? fileText : autoText

  if (
    (category === 'code' || category === 'markdown' || category === 'text') &&
    displayText === null &&
    !textError
  ) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (textError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
          <AlertCircle className="text-muted-foreground h-8 w-8" />
        </div>
        <div>
          <p className="text-foreground font-medium">Preview not available</p>
          <p className="text-muted-foreground mt-1 text-sm">{textError}</p>
        </div>
        <Button onClick={onDownload} className="gap-2">
          <Download className="h-4 w-4" /> Download File
        </Button>
      </div>
    )
  }

  if (!fileUrl && displayText === null) {
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

  if (category === 'image' && fileUrl) {
    return <img src={fileUrl} alt={fileName} className="h-full w-full object-contain" />
  }

  if (category === 'pdf') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
          <FileIcon className="text-muted-foreground h-8 w-8" />
        </div>
        <div>
          <p className="text-foreground font-medium">PDF Preview</p>
          <p className="text-muted-foreground mt-1 text-sm">Download to view this PDF.</p>
        </div>
        <Button onClick={onDownload} className="gap-2">
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      </div>
    )
  }

  if (category === 'video' && fileUrl) {
    return <video src={fileUrl} controls className="h-full w-full object-contain" />
  }

  if (category === 'audio' && fileUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
          <Music className="text-muted-foreground h-8 w-8" />
        </div>
        <audio src={fileUrl} controls />
      </div>
    )
  }

  if (category === 'markdown' && displayText !== null) {
    return (
      <PreviewErrorBoundary
        fallback={
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground text-sm">Failed to render markdown.</p>
            <Button onClick={onDownload} className="gap-2">
              <Download className="h-4 w-4" /> Download File
            </Button>
          </div>
        }
      >
        <div className="markdown-body h-full w-full overflow-auto px-8 py-6">
          <div className="mx-auto max-w-3xl">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="text-primary h-8 w-8 animate-spin" />
                </div>
              }
            >
              <LazyMarkdown>{displayText}</LazyMarkdown>
            </Suspense>
          </div>
        </div>
      </PreviewErrorBoundary>
    )
  }

  if (category === 'code' && displayText !== null) {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'text'
    const lang = getPrismLanguage(ext)
    return (
      <PreviewErrorBoundary
        fallback={
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground text-sm">Failed to render code.</p>
            <Button onClick={onDownload} className="gap-2">
              <Download className="h-4 w-4" /> Download File
            </Button>
          </div>
        }
      >
        <div className="h-full w-full overflow-auto rounded-lg bg-[#1e1e1e]">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
              </div>
            }
          >
            <LazyCodeBlock language={lang}>{displayText}</LazyCodeBlock>
          </Suspense>
        </div>
      </PreviewErrorBoundary>
    )
  }

  if (category === 'text' && displayText !== null) {
    return (
      <div className="h-full w-full overflow-auto rounded-lg bg-[#1e1e1e] p-4">
        <pre className="text-sm break-words whitespace-pre-wrap text-gray-300">{displayText}</pre>
      </div>
    )
  }

  if (category === '3d' && fileUrl) {
    return (
      <PreviewErrorBoundary
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
          <ModelViewer url={fileUrl} />
        </Suspense>
      </PreviewErrorBoundary>
    )
  }

  if (category === 'epub' && fileUrl) {
    return (
      <PreviewErrorBoundary
        fallback={
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
              <AlertCircle className="text-muted-foreground h-8 w-8" />
            </div>
            <div>
              <p className="text-foreground font-medium">Preview not available</p>
              <p className="text-muted-foreground mt-1 text-sm">
                The EPUB file is invalid or corrupted.
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
          <div className="h-full w-full bg-white">
            <EpubViewer url={fileUrl} />
          </div>
        </Suspense>
      </PreviewErrorBoundary>
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
