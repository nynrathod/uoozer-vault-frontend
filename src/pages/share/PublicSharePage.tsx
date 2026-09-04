import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { apiClient, skipAuthRefresh } from '@services/api/client'
import { useShallow } from 'zustand/react/shallow'
import { useFileStore, selectCurrentFiles, selectCurrentFolders } from '@stores/fileStore'
import {
  base64ToBytes,
  unwrapDek,
  initFileDecryption,
  decryptFileChunk,
  cleanupFileStream,
  decryptMetadata,
  initCrypto,
} from '@lib/crypto'
import { VaultLoader } from '@/components/ui/feedback/VaultLoader'
import { Button } from '@ui/Button'
import { FilePreviewer } from '@/components/ui/overlays/FilePreviewer'
import { FileGrid } from '@/components/features/vault/fileList/FileGrid'
import { FileList } from '@/components/features/vault/fileList/FileList'
import { ShareContext } from '@/contexts/ShareContext'
import {
  Download,
  FileText,
  Folder as FolderIcon,
  ArrowLeft,
  AlertCircle,
  Lock,
  ChevronRight,
  X,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { useItemActions } from '@hooks/useItemActions'
import {
  downloadSharedFileToDisk,
  downloadSharedFolderAsZip,
} from '@services/files/downloadOrchestrator'
import type { Folder } from '@/types'

export function PublicSharePage() {
  const { shareId } = useParams()
  const navigate = useNavigate()

  const [view, setView] = useState<'loading' | 'error' | 'list' | 'preview' | 'auth'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [shareData, setShareData] = useState<any | null>(null)
  const [shareKey, setShareKey] = useState<Uint8Array | null>(null)
  const [treeData, setTreeData] = useState<any[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string | null; name: string }>>([])

  const [activeFile, setActiveFile] = useState<any | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [isFileLoading, setIsFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const setFiles = useFileStore((s) => s.setFiles)
  const setFolders = useFileStore((s) => s.setFolders)
  const setStoreFolderId = useFileStore((s) => s.setCurrentFolderId)
  const viewMode = useFileStore((s) => s.viewMode)

  const files = useFileStore(useShallow(selectCurrentFiles))
  const folders = useFileStore(useShallow(selectCurrentFolders))

  const selectedFileIds = useFileStore((s) => s.selectedFileIds)
  const clearSelection = useFileStore((s) => s.clearSelection)
  const toggleFileSelection = useFileStore((s) => s.toggleFileSelection)

  useEffect(() => {
    async function init() {
      if (!shareId) return
      await initCrypto()
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

        const { data, status } = await apiClient.get(
          `/api/v1/shares/${shareId}`,
          skipAuthRefresh({})
        )
        if (status === 401) {
          setView('auth')
          return
        }

        setShareData(data)

        if (data.item_type === 'file') {
          const fileNode = {
            id: '',
            parent_id: null,
            type: 'file',
            name: 'Shared File',
            file_key: '',
            size: data.total_size || 0,
          }
          await loadPreview(fileNode, data, keyBytes)
        } else {
          const manifestBytes = await base64ToBytes(data.encrypted_payload)
          const nonceBytes = await base64ToBytes(data.encrypted_nonce)
          const decryptedManifest = await decryptMetadata(manifestBytes, nonceBytes, keyBytes)

          if (decryptedManifest) {
            const text = new TextDecoder().decode(decryptedManifest)
            const nodes = JSON.parse(text)
            setTreeData(nodes)

            setCurrentFolderId(null)

            const rootNode = nodes.find((n: any) => n.parent_id === null)
            const startName = rootNode ? rootNode.name : 'Shared Content'
            setBreadcrumb([{ id: null, name: startName }])

            const now = new Date().toISOString()
            const mappedFiles = nodes
              .filter((n: any) => n.type === 'file')
              .map((f: any) => ({
                id: f.id,
                uid: f.id,
                folderId: f.parent_id,
                encryptedMetadata: '',
                metadataNonce: '',
                totalSize: f.size,
                currentVersionId: null,
                isUploading: false,
                createdAt: now,
                updatedAt: now,
                name: f.name,
                mimeType: 'application/octet-stream',
                version: 1,
              }))
            const mappedFolders = nodes
              .filter((n: any) => n.type === 'folder')
              .map((f: any) => ({
                id: f.id,
                uid: f.id,
                parentId: f.parent_id,
                encryptedMetadata: '',
                metadataNonce: '',
                createdAt: now,
                updatedAt: now,
                name: f.name,
              }))
            setFiles(mappedFiles)
            setFolders(mappedFolders)

            setView('list')
          } else {
            throw new Error('Failed to decrypt folder manifest')
          }
        }
      } catch (err: any) {
        console.error('[Share Load Error]', err)

        if (err?.response?.status === 401) {
          setView('auth')
        } else if (err?.response?.status === 404) {
          setError('Share link not found, expired, or revoked.')
          setView('error')
        } else if (err?.response?.status === 429) {
          setError('Too many requests. Please wait a moment and try again.')
          setView('error')
        } else if (err?.message) {
          setError(err.message)
          setView('error')
        } else {
          setError('Failed to load share link. Please try again later.')
          setView('error')
        }
      }
    }
    init()
  }, [shareId, setFiles, setFolders])

  useEffect(() => {
    setStoreFolderId(currentFolderId)
  }, [currentFolderId, setStoreFolderId])

  const decryptAndAssembleFile = useCallback(
    async (chunksData: any, fileKey: Uint8Array, encryptionHeaderB64: string): Promise<Blob> => {
      if (!chunksData || chunksData.length === 0) throw new Error('No chunks available')
      const header = await base64ToBytes(encryptionHeaderB64)
      const streamId = await initFileDecryption(header, fileKey)
      const decryptedParts: Uint8Array[] = []
      const sortedChunks = [...chunksData].sort((a, b) => a.chunk_index - b.chunk_index)

      for (const chunk of sortedChunks) {
        const response = await fetch(chunk.presigned_url)
        if (!response.ok) throw new Error('Failed to download chunk')
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
    async (file: any, currentShareData?: any, currentShareKey?: Uint8Array) => {
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
        let chunksData: any
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
          const node = treeData.find((n) => n.id === file.id)
          if (!node || !node.file_key) throw new Error('Missing file key for shared file.')

          fileKey = await base64ToBytes(node.file_key)
          const { data } = await apiClient.get(
            `/api/v1/shares/${shareId}/files/${file.id}`,
            skipAuthRefresh({})
          )
          chunksData = data.chunks
          encryptionHeader = data.encryption_header
        }

        if (!fileKey) throw new Error('Failed to decrypt file key')
        const blob = await decryptAndAssembleFile(chunksData, fileKey, encryptionHeader)

        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        const isText = [
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

        if (isText) {
          const text = await blob.text()
          setPreviewText(text)
        } else {
          const url = URL.createObjectURL(blob)
          setPreviewUrl(url)
        }
      } catch (err: any) {
        console.error(err)
        setFileError(err.message || 'Failed to decrypt or display file.')
      } finally {
        setIsFileLoading(false)
      }
    },
    [shareData, shareKey, shareId, decryptAndAssembleFile, previewUrl, treeData]
  )

  const handleFolderClick = (folder: Folder) => {
    setCurrentFolderId(folder.id)
    setBreadcrumb([...breadcrumb, { id: folder.id, name: folder.name }])
  }

  const handleBreadcrumbClick = (id: string | null) => {
    setCurrentFolderId(id)
    const index = breadcrumb.findIndex((b) => b.id === id)
    if (index !== -1) setBreadcrumb(breadcrumb.slice(0, index + 1))
  }

  const handleBulkDownload = async () => {
    const state = useFileStore.getState()
    const allFiles = Array.from(state.files.values())
    const allFolders = Array.from(state.folders.values())

    const selectedFolders = allFolders.filter((f) => selectedFileIds.has(f.id))
    const selectedFiles = allFiles.filter((f) => selectedFileIds.has(f.id))

    for (const folder of selectedFolders) {
      await downloadSharedFolderAsZip(folder.id, folder.name, treeData, shareId!)
    }
    for (const file of selectedFiles) {
      const node = treeData.find((n) => n.id === file.id)
      if (node?.file_key) {
        await downloadSharedFileToDisk(file.name, file.totalSize, {
          shareId: shareId!,
          fileId: file.id,
          fileKeyB64: node.file_key,
        })
      }
    }
    clearSelection()
  }

  if (view === 'loading')
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <VaultLoader size={48} />
      </div>
    )
  if (view === 'error')
    return (
      <div className="bg-background text-destructive flex h-screen flex-col items-center justify-center gap-3">
        <AlertCircle className="h-10 w-10" />
        <p className="text-lg font-medium">{error}</p>
      </div>
    )
  if (view === 'auth')
    return (
      <div className="bg-background text-foreground flex h-screen flex-col items-center justify-center gap-4 p-4">
        <Lock className="text-primary h-8 w-8" />
        <h1 className="text-xl font-semibold">Login Required</h1>
        <Button onClick={() => navigate(ROUTES.LOGIN)}>Go to Login</Button>
      </div>
    )

  const shareContextValue = { shareId: shareId!, shareKey, treeData, isShareMode: true }

  function PreviewHeaderActions({ file }: { file: any }) {
    const { handleDownload } = useItemActions(file, () => {})
    return (
      <Button
        type="button"
        onClick={() => handleDownload()}
        className="h-9 gap-2"
        disabled={isFileLoading}
      >
        {isFileLoading ? <VaultLoader size={16} /> : <Download className="h-4 w-4" />}
        Download
      </Button>
    )
  }

  return (
    <ShareContext.Provider value={shareContextValue}>
      <div
        className={cn('bg-background text-foreground min-h-screen', view === 'preview' && 'hidden')}
      >
        <div className="bg-background/80 border-border/60 absolute top-0 right-0 left-0 z-10 border-b backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <div className="flex items-center gap-2 overflow-hidden">
              <FolderIcon className="text-primary h-5 w-5 shrink-0" />
              <div className="flex items-center gap-1 overflow-hidden">
                {breadcrumb.map((b, i) => (
                  <div key={i} className="flex items-center gap-1 truncate">
                    <button
                      onClick={() => handleBreadcrumbClick(b.id)}
                      className="hover:text-primary truncate text-sm font-medium"
                    >
                      {b.name}
                    </button>
                    {i < breadcrumb.length - 1 && (
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pt-20">
          {viewMode === 'list' ? (
            <FileList
              files={files}
              folders={folders}
              onFolderClick={handleFolderClick}
              onFileClick={(file) => loadPreview(file)}
              onFileSelect={toggleFileSelection}
              onShare={() => {}}
            />
          ) : (
            <FileGrid files={files} folders={folders} />
          )}
        </div>
      </div>

      {selectedFileIds.size > 0 && view === 'list' && (
        <div className="border-border/60 bg-card fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border p-2 pl-4 shadow-xl">
          <span className="text-sm font-medium">{selectedFileIds.size} selected</span>
          <div className="bg-border h-6 w-px" />
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-2 rounded-lg"
            onClick={handleBulkDownload}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-lg"
            onClick={clearSelection}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {view === 'preview' &&
        activeFile &&
        createPortal(
          <div className="bg-background fixed inset-0 z-50 flex flex-col">
            <div className="border-border/60 bg-background/80 absolute top-0 right-0 left-0 z-10 flex h-14 items-center justify-between border-b px-4 backdrop-blur-xl">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setView('list')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
                  <span className="truncate text-sm font-medium">{activeFile.name}</span>
                </div>
              </div>
              <PreviewHeaderActions file={activeFile} />
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
              {!isFileLoading && !fileError && (
                <FilePreviewer
                  fileName={activeFile.name}
                  fileUrl={previewUrl}
                  fileText={previewText}
                  onDownload={() => {}}
                />
              )}
            </div>
          </div>,
          document.body
        )}
    </ShareContext.Provider>
  )
}
