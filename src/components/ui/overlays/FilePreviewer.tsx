import { FileArchive, Music, AlertCircle, Download } from 'lucide-react'
import { Button } from '@ui/Button'

type FileCategory = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'archive' | 'other'

function getFileCategory(filename: string): FileCategory {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'audio'
  if (
    [
      'txt',
      'md',
      'json',
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
      'css',
      'html',
      'xml',
      'yml',
      'yaml',
      'toml',
      'sql',
      'sh',
    ].includes(ext)
  )
    return 'text'
  if (['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar'].includes(ext)) return 'archive'
  return 'other'
}

interface FilePreviewerProps {
  fileName: string
  fileUrl: string | null
  fileText: string | null
  onDownload: () => void
}

export function FilePreviewer({ fileName, fileUrl, fileText, onDownload }: FilePreviewerProps) {
  if (!fileUrl && fileText === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="bg-muted/20 flex h-16 w-16 items-center justify-center rounded-full">
          <FileArchive className="text-muted-foreground h-8 w-8" />
        </div>
        <div>
          <p className="text-foreground font-medium">Preview not available</p>
          <p className="text-muted-foreground mt-1 text-sm">
            This file type cannot be displayed in the browser.
          </p>
        </div>
        <Button onClick={onDownload} className="gap-2">
          <Download className="h-4 w-4" /> Download File
        </Button>
      </div>
    )
  }

  const category = getFileCategory(fileName)

  if (category === 'image' && fileUrl) {
    return <img src={fileUrl} alt={fileName} className="h-full w-full object-contain" />
  }

  if (category === 'pdf' && fileUrl) {
    return <iframe src={fileUrl} title={fileName} className="h-full w-full border-none" />
  }

  if (category === 'video' && fileUrl) {
    return <video src={fileUrl} controls autoPlay className="h-full w-full object-contain" />
  }

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

  if (category === 'text' && fileText !== null) {
    return (
      <div className="bg-card border-border/60 h-full w-full max-w-4xl overflow-auto rounded-lg border p-6">
        <pre className="text-foreground font-mono text-sm whitespace-pre-wrap">{fileText}</pre>
      </div>
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
