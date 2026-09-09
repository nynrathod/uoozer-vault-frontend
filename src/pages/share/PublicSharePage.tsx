import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { apiClient, skipAuthRefresh } from '@services/api/client'
import { useFileStore, selectCurrentFiles, selectCurrentFolders } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
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
import { FilePreviewDialog } from '@/components/ui/overlays/FilePreviewDialog'
import { FileGrid } from '@/components/features/vault/fileList/FileGrid'
import { FileList } from '@/components/features/vault/fileList/FileList'
import { ShareContext } from '@/contexts/ShareContext'
import { downloadSharedItemsAsZip } from '@services/files/downloadOrchestrator'
import { toast } from 'sonner'
import {
  Download,
  FileText,
  Folder as FolderIcon,
  AlertCircle,
  Lock,
  ChevronRight,
  X,
} from 'lucide-react'
import { ROUTES } from '@lib/constants'
import type { Folder } from '@/types'

export function PublicSharePage() {
  const { shareId } = useParams()
  const navigate = useNavigate()
  const [view, setView] = useState<'loading' | 'error' | 'list' | 'file' | 'auth'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [, setShareData] = useState<any | null>(null)
  const [shareKey, setShareKey] = useState<Uint8Array | null>(null)
  const [treeData, setTreeData] = useState<any[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string | null; name: string }>>([])
  const [activeFileName, setActiveFileName] = useState('Shared File')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [isFileLoading, setIsFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isBulkDownloading, setIsBulkDownloading] = useState(false)

  const setFiles = useFileStore((s) => s.setFiles)
  const setFolders = useFileStore((s) => s.setFolders)
  const setStoreFolderId = useFileStore((s) => s.setCurrentFolderId)
  const viewMode = useFileStore((s) => s.viewMode)
  const files = useFileStore(useShallow(selectCurrentFiles))
  const folders = useFileStore(useShallow(selectCurrentFolders))
  const selectedFileIds = useFileStore((s) => s.selectedFileIds)
  const clearSelection = useFileStore((s) => s.clearSelection)
  const toggleFileSelection = useFileStore((s) => s.toggleFileSelection)

  const openPreview = usePreviewStore((s) => s.open)
  const isPreviewOpen = usePreviewStore((s) => !!s.fileId)

  useEffect(() => {
    async function init() {
      if (!shareId) return
      setIsPaused(false)
      setError(null)
      if (retryCount === 0) setView('loading')
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
          skipAuthRefresh({ params: { _ts: Date.now() } })
        )
        if (status === 401) {
          setView('auth')
          return
        }
        setShareData(data)
        if (data.item_type === 'file') {
          setView('file')
          await loadDirectFile(data, keyBytes)
        } else {
          const manifestBytes = await base64ToBytes(data.encrypted_payload)
          const nonceBytes = await base64ToBytes(data.encrypted_nonce)
          const decryptedManifest = await decryptMetadata(manifestBytes, nonceBytes, keyBytes)
          if (!decryptedManifest) throw new Error('Failed to decrypt folder manifest')
          const nodes = JSON.parse(new TextDecoder().decode(decryptedManifest))
          setTreeData(nodes)
          setCurrentFolderId(null)
          const rootNode = nodes.find((n: any) => n.parent_id === null)
          setBreadcrumb([{ id: null, name: rootNode ? rootNode.name : 'Shared Content' }])
          const now = new Date().toISOString()
          setFiles(
            nodes
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
          )
          setFolders(
            nodes
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
          )
          setView('list')
        }
      } catch (err: any) {
        console.error('[Share Load Error]', err)
        if (err?.response?.status === 401) {
          setView('auth')
        } else if (
          err?.response?.status === 410 ||
          err?.response?.data?.error?.code === 'SHARED_ITEM_DELETED'
        ) {
          setIsPaused(true)
          setError('The owner deleted this item. If it is restored, this link will work again.')
          setView('error')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId, setFiles, setFolders, retryCount])

  useEffect(() => {
    if (view !== 'error' || !isPaused) return
    const t = setInterval(() => setRetryCount((c) => c + 1), 15_000)
    return () => clearInterval(t)
  }, [view, isPaused])

  useEffect(() => {
    setStoreFolderId(currentFolderId)
  }, [currentFolderId, setStoreFolderId])

  const loadDirectFile = useCallback(
    async (sData: any, sKey: Uint8Array) => {
      setIsFileLoading(true)
      setFileError(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setPreviewBlob(null)
      try {
        const payloadBytes = await base64ToBytes(sData.encrypted_payload)
        const nonceBytes = await base64ToBytes(sData.encrypted_nonce)
        let fileKey: Uint8Array | null = null
        let fileName = 'Shared File'
        let mimeType = 'application/octet-stream'
        const decrypted = await decryptMetadata(payloadBytes, nonceBytes, sKey)
        if (decrypted) {
          try {
            const parsed = JSON.parse(new TextDecoder().decode(decrypted))
            if (parsed && typeof parsed.file_key === 'string') {
              fileKey = await base64ToBytes(parsed.file_key)
              if (typeof parsed.name === 'string' && parsed.name) fileName = parsed.name
              if (typeof parsed.mime_type === 'string' && parsed.mime_type) {
                mimeType = parsed.mime_type
              }
            }
          } catch {}
        }
        if (!fileKey) {
          fileKey = await unwrapDek({ ciphertext: payloadBytes, nonce: nonceBytes }, sKey)
        }
        if (!fileKey) throw new Error('Failed to decrypt file key')

        if (!sData.chunks || sData.chunks.length === 0) throw new Error('No chunks available')
        const header = await base64ToBytes(sData.encryption_header || '')
        const streamId = await initFileDecryption(header, fileKey)
        const decryptedParts: Uint8Array[] = []
        const sortedChunks = [...sData.chunks].sort(
          (a: any, b: any) => a.chunk_index - b.chunk_index
        )
        for (const chunk of sortedChunks) {
          const response = await fetch(chunk.presigned_url)
          if (!response.ok) throw new Error('Failed to download chunk')
          const ciphertext = new Uint8Array(await response.arrayBuffer())
          const plaintext = await decryptFileChunk(streamId, ciphertext)
          decryptedParts.push(plaintext)
        }
        await cleanupFileStream(streamId)

        setActiveFileName(fileName)
        const blob = new Blob(decryptedParts as BlobPart[], { type: mimeType })
        setPreviewBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
      } catch (err: any) {
        console.error(err)
        setFileError(err.message || 'Failed to decrypt or display file.')
      } finally {
        setIsFileLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewUrl]
  )

  const downloadDirectFile = () => {
    if (!previewBlob) return
    const url = previewUrl ?? URL.createObjectURL(previewBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    if (!previewUrl) setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

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
    if (!shareId || isBulkDownloading) return
    const state = useFileStore.getState()
    const items = Array.from(selectedFileIds)
      .map((id) => {
        const folder = state.folders.get(id)
        if (folder) return { id, name: folder.name, isFolder: true }
        const file = state.files.get(id)
        if (file) return { id, name: file.name, isFolder: false }
        return null
      })
      .filter((i): i is { id: string; name: string; isFolder: boolean } => i !== null)
    if (items.length === 0) return
    setIsBulkDownloading(true)
    try {
      await downloadSharedItemsAsZip(items, treeData, shareId)
      toast.success('Download started')
    } catch (err: any) {
      toast.error(err?.message ?? 'Download failed')
    } finally {
      setIsBulkDownloading(false)
      clearSelection()
    }
  }

  if (view === 'loading')
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <VaultLoader size={48} />
      </div>
    )

  if (view === 'error')
    return (
      <div className="bg-background text-destructive flex h-screen flex-col items-center justify-center gap-3 p-4">
        <AlertCircle className="h-10 w-10" />
        <p className="text-lg font-medium">{error}</p>
        {isPaused && (
          <p className="text-muted-foreground text-sm">
            Checking automatically — the preview returns the moment the item is restored.
          </p>
        )}
        <Button
          variant="secondary"
          className="mt-2 rounded-lg"
          onClick={() => setRetryCount((c) => c + 1)}
        >
          Try again
        </Button>
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

  if (view === 'file') {
    return (
      <div className="bg-background flex h-screen flex-col">
        <div className="border-border/60 bg-background/80 fixed top-0 right-0 left-0 z-10 flex h-14 items-center justify-between border-b px-4 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
            <span className="truncate text-sm font-medium">{activeFileName}</span>
          </div>
          <Button
            type="button"
            className="h-9 gap-2"
            onClick={downloadDirectFile}
            disabled={isFileLoading || !previewBlob}
          >
            <Download className="h-4 w-4" />
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
          {!isFileLoading && !fileError && (
            <FilePreviewer
              fileName={activeFileName}
              fileUrl={previewUrl}
              fileText={null}
              onDownload={downloadDirectFile}
            />
          )}
        </div>
      </div>
    )
  }

  const shareContextValue = { shareId: shareId!, shareKey, treeData, isShareMode: true }
  return (
    <ShareContext.Provider value={shareContextValue}>
      <div className="bg-background text-foreground flex h-screen flex-col">
        <div className="border-border/60 bg-background/80 fixed top-0 right-0 left-0 z-10 border-b backdrop-blur-xl">
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
        <div className="flex min-h-0 flex-1 pt-14">
          <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 py-4">
            {viewMode === 'list' ? (
              <FileList
                files={files}
                folders={folders}
                onFolderClick={handleFolderClick}
                onFileClick={(file) => openPreview(file.id)}
                onFileSelect={toggleFileSelection}
                onShare={() => {}}
              />
            ) : (
              <FileGrid files={files} folders={folders} />
            )}
          </main>
          {isPreviewOpen && (
            <aside className="border-border bg-background fixed inset-0 z-40 border-l md:static md:z-auto md:h-full md:w-[440px] md:shrink-0">
              <FilePreviewDialog />
            </aside>
          )}
        </div>
        {selectedFileIds.size > 0 && (
          <div className="border-border/60 bg-card fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border p-2 pl-4 shadow-xl">
            <span className="text-sm font-medium">{selectedFileIds.size} selected</span>
            <div className="bg-border h-6 w-px" />
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-2 rounded-lg"
              loading={isBulkDownloading}
              disabled={isBulkDownloading}
              onClick={handleBulkDownload}
            >
              <Download className="h-4 w-4" />
              Download (zip)
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
      </div>
    </ShareContext.Provider>
  )
}
