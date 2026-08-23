import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { apiClient } from '@services/api/client'
import {
  base64ToBytes,
  unwrapDek,
  initFileDecryption,
  decryptFileChunk,
  cleanupFileStream,
  decryptMetadata,
} from '@lib/crypto'
import { VaultLoader } from '@/components/ui/feedback/VaultLoader'
import { Button } from '@ui/Button'
import {
  Download,
  FileText,
  Folder as FolderIcon,
  ArrowLeft,
  File,
  Image as ImageIcon,
  Video,
  Music,
  FileArchive,
  AlertCircle,
  Eye,
  Grid2x2,
  List,
} from 'lucide-react'
import { formatBytes, cn } from '@lib/utils'

interface ShareData {
  share_id: string
  item_type: 'file' | 'folder'
  encrypted_payload: string
  encrypted_nonce: string
  encryption_header: string | null
  chunks?: Array<{
    chunk_index: number
    segment_index: number
    chunk_size: number
    presigned_url: string
  }>
  total_size?: number
}

interface ManifestFile {
  file_id: string
  name: string
  file_key: string
  size: number
}

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

function getFileIcon(category: FileCategory) {
  switch (category) {
    case 'image':
      return ImageIcon
    case 'pdf':
      return FileText
    case 'video':
      return Video
    case 'audio':
      return Music
    case 'archive':
      return FileArchive
    case 'text':
      return FileText
    default:
      return File
  }
}

export function PublicSharePage() {
  const { shareId } = useParams()

  const [view, setView] = useState<'loading' | 'error' | 'list' | 'preview'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [shareKey, setShareKey] = useState<Uint8Array | null>(null)
  const [folderFiles, setFolderFiles] = useState<ManifestFile[]>([])

  const [activeFile, setActiveFile] = useState<ManifestFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [isFileLoading, setIsFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const [listViewMode, setListViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    async function init() {
      if (!shareId) return
      const hash = window.location.hash
      const keyBase64 = hash.replace('#k=', '')
      if (!keyBase64) {
        setError('Invalid share link: Missing decryption key.')
        setView('error')
        return
      }

      try {
        const keyBytes = await base64ToBytes(keyBase64)
        setShareKey(keyBytes)

        const { data } = await apiClient.get(`/api/v1/shares/${shareId}`)
        setShareData(data)

        if (data.item_type === 'file') {
          setActiveFile({
            file_id: '',
            name: `Shared File`,
            file_key: '',
            size: data.total_size || 0,
          })
          setView('preview')
          await loadPreview(
            {
              file_id: '',
              name: 'Shared File',
              file_key: '',
              size: data.total_size || 0,
            },
            data,
            keyBytes
          )
        } else {
          const manifestBytes = await base64ToBytes(data.encrypted_payload)
          const nonceBytes = await base64ToBytes(data.encrypted_nonce)
          const decryptedManifest = await decryptMetadata(manifestBytes, nonceBytes, keyBytes)

          if (decryptedManifest) {
            const text = new TextDecoder().decode(decryptedManifest)
            const files = JSON.parse(text)
            setFolderFiles(files)
            setView('list')
          } else {
            throw new Error('Failed to decrypt folder manifest')
          }
        }
      } catch (err) {
        console.error(err)
        setError('Share link not found, expired, or revoked.')
        setView('error')
      }
    }
    init()
  }, [shareId])

  const decryptAndAssembleFile = useCallback(
    async (
      chunksData: ShareData['chunks'],
      fileKey: Uint8Array,
      encryptionHeaderB64: string
    ): Promise<Blob> => {
      if (!chunksData || chunksData.length === 0)
        throw new Error('No chunks available for download')

      const header = await base64ToBytes(encryptionHeaderB64)
      const streamId = await initFileDecryption(header, fileKey)

      const decryptedParts: Uint8Array[] = []
      for (const chunk of chunksData) {
        const response = await fetch(chunk.presigned_url)
        if (!response.ok) throw new Error(`Failed to download chunk ${chunk.chunk_index}`)
        const arrayBuffer = await response.arrayBuffer()
        const ciphertext = new Uint8Array(arrayBuffer)
        const plaintext = await decryptFileChunk(streamId, ciphertext)
        decryptedParts.push(plaintext)
      }

      await cleanupFileStream(streamId)
      return new Blob(decryptedParts as BlobPart[], { type: 'application/octet-stream' })
    },
    []
  )

  const loadPreview = useCallback(
    async (file: ManifestFile, currentShareData?: ShareData, currentShareKey?: Uint8Array) => {
      const sData = currentShareData || shareData
      const sKey = currentShareKey || shareKey

      if (!sData || !sKey || !shareId) return

      setIsFileLoading(true)
      setFileError(null)

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setPreviewText(null)
      setActiveFile(file)
      setView('preview')

      try {
        let chunksData: ShareData['chunks']
        let fileKey: Uint8Array | null = null
        let encryptionHeader: string

        if (sData.item_type === 'file') {
          const wrappedKey = {
            ciphertext: await base64ToBytes(sData.encrypted_payload),
            nonce: await base64ToBytes(sData.encrypted_nonce),
          }
          fileKey = await unwrapDek(wrappedKey, sKey)
          chunksData = sData.chunks
          encryptionHeader = sData.encryption_header || ''
        } else {
          if (!file.file_key) throw new Error('Missing file key for shared file.')
          fileKey = await base64ToBytes(file.file_key)
          const { data } = await apiClient.get(`/api/v1/shares/${shareId}/files/${file.file_id}`)
          chunksData = data.chunks
          encryptionHeader = data.encryption_header
        }

        if (!fileKey) throw new Error('Failed to decrypt file key')

        const blob = await decryptAndAssembleFile(chunksData, fileKey, encryptionHeader)
        const category = getFileCategory(file.name)

        if (category === 'text') {
          const text = await blob.text()
          setPreviewText(text)
        } else {
          const url = URL.createObjectURL(blob)
          setPreviewUrl(url)
        }
      } catch (err) {
        console.error(err)
        setFileError('Failed to decrypt or display file.')
      } finally {
        setIsFileLoading(false)
      }
    },
    [shareData, shareKey, shareId, decryptAndAssembleFile, previewUrl]
  )

  const handleDownload = useCallback(
    async (file: ManifestFile | null) => {
      if (!shareData || !shareKey || !shareId) return

      const targetFile = file ||
        activeFile || {
          file_id: '',
          name: `shared_file_${shareId?.slice(0, 8)}`,
          file_key: '',
          size: shareData.total_size || 0,
        }

      try {
        let chunksData: ShareData['chunks']
        let fileKey: Uint8Array | null = null
        let encryptionHeader: string

        if (shareData.item_type === 'file') {
          const wrappedKey = {
            ciphertext: await base64ToBytes(shareData.encrypted_payload),
            nonce: await base64ToBytes(shareData.encrypted_nonce),
          }
          fileKey = await unwrapDek(wrappedKey, shareKey)
          chunksData = shareData.chunks
          encryptionHeader = shareData.encryption_header || ''
        } else {
          if (!targetFile.file_key) throw new Error('Missing file key for download.')
          fileKey = await base64ToBytes(targetFile.file_key)
          const { data } = await apiClient.get(
            `/api/v1/shares/${shareId}/files/${targetFile.file_id}`
          )
          chunksData = data.chunks
          encryptionHeader = data.encryption_header
        }

        if (!fileKey) throw new Error('Failed to decrypt file key')

        const blob = await decryptAndAssembleFile(chunksData, fileKey, encryptionHeader)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = targetFile.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error(err)
      }
    },
    [shareData, shareKey, shareId, decryptAndAssembleFile, activeFile]
  )

  // ─── Render States ──────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <VaultLoader size={48} />
      </div>
    )
  }

  if (view === 'error') {
    return (
      <div className="bg-background text-destructive flex h-screen flex-col items-center justify-center gap-3">
        <AlertCircle className="h-10 w-10" />
        <p className="text-lg font-medium">{error}</p>
      </div>
    )
  }

  const renderFolderList = () => {
    if (shareData?.item_type !== 'folder') return null

    return (
      <div
        className={cn('bg-background text-foreground min-h-screen', view === 'preview' && 'hidden')}
      >
        <div className="bg-background/80 border-border/60 absolute top-0 right-0 left-0 z-10 border-b backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <FolderIcon className="text-primary h-5 w-5" />
              <span className="text-sm font-medium">Shared Folder</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant={listViewMode === 'grid' ? 'secondary' : 'ghost'}
                className="h-8 w-8"
                onClick={() => setListViewMode('grid')}
              >
                <Grid2x2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon-sm"
                variant={listViewMode === 'list' ? 'secondary' : 'ghost'}
                className="h-8 w-8"
                onClick={() => setListViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pt-20">
          {folderFiles.length === 0 ? (
            <div className="text-muted-foreground flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
              <FolderIcon className="h-16 w-16 opacity-20" />
              <p className="font-medium">This shared folder is empty.</p>
              <p className="text-xs">(Or files were uploaded before sharing was supported)</p>
            </div>
          ) : (
            <>
              {listViewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3 md:grid-cols-4">
                  {folderFiles.map((file) => {
                    const category = getFileCategory(file.name)
                    const Icon = getFileIcon(category)
                    return (
                      <div
                        key={file.file_id}
                        className="group hover:bg-accent/30 flex flex-col items-center gap-2 rounded-lg border border-transparent p-4 text-center transition-colors"
                      >
                        <button
                          onClick={() => loadPreview(file)}
                          className="relative flex flex-col items-center gap-2"
                        >
                          <div className="bg-primary/5 group-hover:bg-primary/10 flex h-16 w-16 items-center justify-center rounded-xl transition-colors">
                            <Icon className="text-primary h-8 w-8" />
                          </div>
                          <p className="text-foreground line-clamp-2 text-[13px] font-medium">
                            {file.name}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            {formatBytes(file.size)}
                          </p>
                        </button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="mt-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(file)
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-4">
                  {folderFiles.map((file) => {
                    const category = getFileCategory(file.name)
                    const Icon = getFileIcon(category)
                    return (
                      <div
                        key={file.file_id}
                        className="group hover:bg-accent/30 flex items-center justify-between gap-3 rounded-lg p-2 transition-colors"
                      >
                        <button
                          onClick={() => loadPreview(file)}
                          className="hover:text-primary flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="bg-primary/5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                            <Icon className="text-primary h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground truncate text-[13px] font-medium">
                              {file.name}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              {formatBytes(file.size)}
                            </p>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => loadPreview(file)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleDownload(file)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  const renderPreview = () => {
    if (view !== 'preview' || !activeFile) return null

    const category = getFileCategory(activeFile.name)
    const isUnsupported = category === 'archive' || category === 'other'

    return createPortal(
      <div className="bg-background fixed inset-0 z-50 flex flex-col">
        <div className="border-border/60 bg-background/80 absolute top-0 right-0 left-0 z-10 flex h-14 items-center justify-between border-b px-4 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            {shareData?.item_type === 'folder' && (
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0"
                onClick={() => setView('list')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
              <span className="truncate text-sm font-medium">{activeFile.name}</span>
            </div>
          </div>
          <Button
            onClick={() => handleDownload(activeFile)}
            className="h-9 gap-2"
            disabled={isFileLoading}
          >
            {isFileLoading ? <VaultLoader size={16} /> : <Download className="h-4 w-4" />}
            Download
          </Button>
        </div>

        <div className="flex h-full items-center justify-center p-4 pt-14">
          {isFileLoading && (
            <div className="flex flex-col items-center gap-3">
              <VaultLoader size={32} />
              <p className="text-muted-foreground text-sm">Decrypting secure file...</p>
            </div>
          )}

          {!isFileLoading && fileError && (
            <div className="text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8" />
              <p>{fileError}</p>
            </div>
          )}

          {!isFileLoading && !fileError && previewUrl && (
            <div className="h-full w-full">
              {category === 'image' && (
                <img
                  src={previewUrl}
                  alt={activeFile.name}
                  className="h-full w-full object-contain"
                />
              )}
              {category === 'pdf' && (
                <iframe
                  src={previewUrl}
                  title={activeFile.name}
                  className="h-full w-full border-none"
                />
              )}
              {category === 'video' && (
                <video
                  src={previewUrl}
                  controls
                  autoPlay
                  className="h-full w-full object-contain"
                />
              )}
              {category === 'audio' && (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4">
                  <Music className="text-muted-foreground h-16 w-16" />
                  <audio src={previewUrl} controls autoPlay />
                </div>
              )}
            </div>
          )}

          {!isFileLoading && !fileError && previewText !== null && (
            <div className="bg-card border-border/60 h-full w-full max-w-4xl overflow-auto rounded-lg border p-6">
              <pre className="text-foreground font-mono text-sm whitespace-pre-wrap">
                {previewText}
              </pre>
            </div>
          )}

          {!isFileLoading && !fileError && isUnsupported && previewUrl && (
            <div className="bg-card border-border/60 flex h-full w-full max-w-md flex-col items-center justify-center gap-4 rounded-lg border p-6 text-center">
              <FileArchive className="text-muted-foreground h-16 w-16" />
              <div>
                <p className="text-foreground font-medium">Preview not available</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  This file type cannot be displayed in the browser. Please download to view.
                </p>
              </div>
              <Button onClick={() => handleDownload(activeFile)} className="gap-2">
                <Download className="h-4 w-4" /> Download File
              </Button>
            </div>
          )}
        </div>
      </div>,
      document.body
    )
  }

  return (
    <>
      {renderFolderList()}
      {renderPreview()}
    </>
  )
}
