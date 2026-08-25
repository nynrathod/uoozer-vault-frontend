import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { Music, AlertCircle, Download, File as FileIcon, Loader2 } from 'lucide-react'
import { Button } from '@ui/Button'

const EpubViewer = lazy(() => import('react-epub-viewer').then((m) => ({ default: m.EpubViewer })))
const ModelViewer = lazy(() => import('./ModelViewer'))

type FileCategory =
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'markdown'
  | 'code'
  | 'text'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'epub'
  | '3d'
  | 'archive'
  | 'other'

function getCategory(fileName: string): FileCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio'

  if (ext === 'md') return 'markdown'
  if (
    [
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
    ].includes(ext)
  )
    return 'code'
  if (['txt', 'log', 'csv', 'tsv'].includes(ext)) return 'text'

  if (ext === 'docx') return 'word'
  if (['xlsx', 'xls'].includes(ext)) return 'excel'
  if (['pptx', 'ppt'].includes(ext)) return 'powerpoint'

  if (ext === 'epub') return 'epub'
  if (['obj', 'gltf', 'glb', 'stl', 'fbx'].includes(ext)) return '3d'

  return 'other'
}

interface FilePreviewerProps {
  fileName: string
  fileUrl: string | null
  fileText: string | null
  fileBlob?: Blob | null
  onDownload: () => void
}

export function FilePreviewer({
  fileName,
  fileUrl,
  fileText,
  fileBlob,
  onDownload,
}: FilePreviewerProps) {
  const category = getCategory(fileName)
  const docxRef = useRef<HTMLDivElement>(null)
  const [excelHtml, setExcelHtml] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [wordHtml, setWordHtml] = useState<string>('')
  const [docxError, setDocxError] = useState(false)

  useEffect(() => {
    let isCancelled = false

    if (category === 'word' && fileBlob) {
      setIsProcessing(true)
      setDocxError(false)

      const renderDocx = async () => {
        try {
          const arrayBuffer = await fileBlob.arrayBuffer()
          if (isCancelled) return

          const result = await mammoth.convertToHtml({ arrayBuffer })
          if (!isCancelled) {
            setWordHtml(result.value)
            setIsProcessing(false)
          }
        } catch (err: any) {
          console.error('Docx render failed:', err)

          let errorText = err.message
          try {
            const text = await fileBlob.text()
            if (text.includes('"error"') || text.includes('"code"')) {
              errorText = 'Download failed: Backend returned an error instead of the file.'
            } else if (fileBlob.type === 'application/msword' || fileName.endsWith('.doc')) {
              errorText = 'Old .doc format is not supported in browser. Please use .docx.'
            }
          } catch {}

          if (!isCancelled) {
            setDocxError(true)
            setIsProcessing(false)
          }
        }
      }

      renderDocx()
    }

    return () => {
      isCancelled = true
    }
  }, [category, fileBlob])

  useEffect(() => {
    if (category === 'excel' && fileBlob) {
      setIsProcessing(true)
      fileBlob
        .arrayBuffer()
        .then((buffer) => {
          const workbook = XLSX.read(buffer, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          if (firstSheetName) {
            const worksheet = workbook.Sheets[firstSheetName]
            const html = XLSX.utils.sheet_to_html(worksheet, { editable: true })
            setExcelHtml(html)
          }
          setIsProcessing(false)
        })
        .catch(() => setIsProcessing(false))
    }
  }, [category, fileBlob])

  // Initial loading state (only if we are expecting data but don't have it yet)
  if (!fileUrl && fileText === null && !fileBlob) {
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

  // 1. Native Browser Formats
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
      <div className="bg-card border-border/60 h-full w-full max-w-4xl overflow-auto rounded-lg border p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileText}</ReactMarkdown>
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
      <div className="bg-card border-border/60 h-full w-full max-w-4xl overflow-auto rounded-lg border p-6">
        <pre className="text-foreground font-mono text-sm whitespace-pre-wrap">{fileText}</pre>
      </div>
    )
  }

  if (category === 'word' && fileBlob) {
    if (docxError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
            <AlertCircle className="text-muted-foreground h-8 w-8" />
          </div>
          <div>
            <p className="text-foreground font-medium">Preview not available</p>
            <p className="text-muted-foreground mt-1 text-sm">
              This file is either an older format (like .doc), not a real Word document, or the
              download failed. Please download the file to view it.
            </p>
          </div>
          <Button onClick={onDownload} className="gap-2">
            <Download className="h-4 w-4" /> Download File
          </Button>
        </div>
      )
    }

    return (
      <div className="relative h-full w-full overflow-auto bg-white p-4">
        {isProcessing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        )}
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: wordHtml }} />
      </div>
    )
  }

  if (category === 'excel' && fileBlob) {
    return (
      <div className="relative h-full w-full overflow-auto bg-white p-4">
        {isProcessing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        )}
        <div dangerouslySetInnerHTML={{ __html: excelHtml }} />
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
