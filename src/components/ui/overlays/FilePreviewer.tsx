import { lazy, Suspense } from 'react'
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

const CODE_EXTENSIONS = new Set([
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

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'].includes(ext))
    return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['mp4', 'webm', 'mov', 'ogv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio'

  if (['md', 'markdown'].includes(ext)) return 'markdown'
  if (CODE_EXTENSIONS.has(ext)) return 'code'
  if (['txt', 'log', 'csv', 'tsv'].includes(ext)) return 'text'

  if (ext === 'epub') return 'epub'
  if (['gltf', 'glb'].includes(ext)) return '3d'

  return 'other'
}

interface FilePreviewerProps {
  fileName: string
  fileUrl: string | null
  fileText: string | null
  onDownload: () => void
}

/** Renders a file preview based on its type.
 *  Uses native browser rendering for media (images, PDF, video, audio),
 *  react-markdown for markdown, syntax highlighter for code, and lazy-loaded
 *  viewers for EPUB and 3D models. */
export function FilePreviewer({ fileName, fileUrl, fileText, onDownload }: FilePreviewerProps) {
  const category = getCategory(fileName)

  // Loading state — waiting for decrypted blob/text to arrive
  if (!fileUrl && fileText === null) {
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

  if (category === 'image' && fileUrl)
    return <img src={fileUrl} alt={fileName} className="h-full w-full object-contain" />

  if (category === 'pdf' && fileUrl)
    return <iframe src={fileUrl} title={fileName} className="h-full w-full border-none" />

  if (category === 'video' && fileUrl)
    return <video src={fileUrl} controls autoPlay className="h-full w-full object-contain" />

  if (category === 'audio' && fileUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
          <Music className="text-muted-foreground h-8 w-8" />
        </div>
        <audio src={fileUrl} controls autoPlay />
      </div>
    )
  }

  if (category === 'markdown' && fileText !== null) {
    return (
      <div className="markdown-body h-full w-full overflow-auto px-8 py-6">
        <div className="mx-auto max-w-3xl">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileText}</ReactMarkdown>
        </div>
      </div>
    )
  }

  if (category === 'code' && fileText !== null) {
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
          {fileText}
        </SyntaxHighlighter>
      </div>
    )
  }

  if (category === 'text' && fileText !== null) {
    return (
      <div className="h-full w-full overflow-auto px-8 py-6">
        <pre className="text-foreground font-mono text-sm whitespace-pre-wrap">{fileText}</pre>
      </div>
    )
  }

  if (category === '3d' && fileUrl) {
    return (
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        }
      >
        <ModelViewer url={fileUrl} />
      </Suspense>
    )
  }

  if (category === 'epub' && fileUrl) {
    return (
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
