import { useState, useEffect } from 'react'
import { useFileStore, selectFileById } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
import { useAuthStore } from '@stores/authStore'
import { downloadFile, downloadFileToDisk } from '@services/files/downloadOrchestrator'
import { FilePreviewer } from './FilePreviewer'
import { ZipPreview } from './ZipPreview'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@ui/Button'

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
  | 'archive'
  | '3d'
  | 'epub'
  | 'other'

function getCategory(fileName: string): FileCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  console.log('ext', ext)
  if (['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar'].includes(ext)) return 'archive'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'audio'
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
      'gitignore',
    ].includes(ext)
  )
    return 'code'
  if (['txt', 'log', 'csv', 'tsv'].includes(ext)) return 'text'
  if (ext === 'docx') return 'word'
  if (['xlsx', 'xls'].includes(ext)) return 'excel'
  if (['pptx', 'ppt'].includes(ext)) return 'powerpoint'
  if (['obj', 'gltf', 'glb', 'stl', 'fbx'].includes(ext)) return '3d'
  if (ext === 'epub') return 'epub'
  return 'other'
}

export function PreviewContent() {
  const fileId = usePreviewStore((s) => s.fileId)
  const setLoading = usePreviewStore((s) => s.setLoading)
  const file = useFileStore(selectFileById(fileId))
  const dek = useAuthStore((s) => s.cryptoState.dek)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fileId || !file || !dek) return

    let url: string | null = null
    let isCancelled = false

    const loadPreview = async () => {
      setLoading(true)
      setError(null)
      setPreviewUrl(null)
      setPreviewText(null)
      setPreviewBlob(null)

      try {
        const category = getCategory(file.name)

        if (category === 'archive') {
          setLoading(false)
          return
        }

        const response = await downloadFile({ dek, fileId: file.id })
        const blob = await response.blob()

        if (isCancelled) return

        if (category === 'text' || category === 'markdown' || category === 'code') {
          const text = await blob.text()
          if (!isCancelled) setPreviewText(text)
        } else {
          url = URL.createObjectURL(blob)
          if (!isCancelled) {
            setPreviewUrl(url)
            setPreviewBlob(blob)
          }
        }
      } catch (err: any) {
        if (!isCancelled) setError(err.message || 'Failed to load preview.')
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    loadPreview()

    return () => {
      isCancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [fileId, file, dek, setLoading])

  if (!file) return null

  const category = getCategory(file.name)

  if (category === 'archive') {
    return <ZipPreview fileId={file.id} fileName={file.name} />
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="text-destructive h-10 w-10" />
        <p className="text-destructive font-medium">Preview Error</p>
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  const handleDownload = () => {
    if (file && dek) {
      downloadFileToDisk(file.name, file.totalSize, { dek, fileId: file.id })
    }
  }

  return (
    <FilePreviewer
      fileName={file.name}
      fileUrl={previewUrl}
      fileText={previewText}
      fileBlob={previewBlob}
      onDownload={handleDownload}
    />
  )
}
