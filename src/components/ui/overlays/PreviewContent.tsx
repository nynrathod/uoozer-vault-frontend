import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { PdfPreview } from './PdfPreview'
import { FilePreviewer } from './FilePreviewer'
import { ZipPreview } from './ZipPreview'
import { PreviewEmpty } from './PreviewEmpty'
import { PreviewDetailsPanel, type PreviewTab } from './PreviewDetailsPanel'
import { usePreviewStore } from '@stores/previewStore'
import { useAuthStore } from '@stores/authStore'
import { useShareContext } from '@/contexts/ShareContext'
import { apiClient, skipAuthRefresh } from '@services/api/client'
import { downloadFileToDisk, downloadSharedFileToDisk } from '@services/files/downloadOrchestrator'
import {
  base64ToBytes,
  unwrapDek,
  initFileDecryption,
  decryptFileChunk,
  cleanupFileStream,
} from '@lib/crypto'
import { VaultLoader } from '@/components/ui/feedback/VaultLoader'
import { getCategory, getPreviewIcon } from './previewCategories'
import { cn } from '@lib/utils'
import type { FileItem } from '@/types/files'

interface PreviewContentProps {
  file: FileItem
  canPreview: boolean
  detailsOpen: boolean
  activeTab: PreviewTab
  onTabChange: (tab: PreviewTab) => void
  /** Viewer → header meta channel ("1920×1280" / "2 pages"). */
  onDetailLoaded: (detail: string | null) => void
}

const TEXT_EXTS = new Set([
  'md',
  'markdown',
  'txt',
  'log',
  'csv',
  'tsv',
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
  'env',
  'ini',
  'conf',
  'config',
  'vue',
  'svelte',
  'graphql',
  'gql',
])

/**
 * Preview drawer body (Files-Preview sheet). The decryption pipeline is
 * unchanged (chunk stream → local Blob); the chrome is now the sheet:
 * viewer r10 on Hover fill, zoom/page pills inside, details tabs below,
 * and the exact no-preview + archive contents layout for .zip / unknown
 * types.
 */
export function PreviewContent({
  file,
  canPreview,
  detailsOpen,
  activeTab,
  onTabChange,
  onDetailLoaded,
}: PreviewContentProps) {
  const fileId = usePreviewStore((s) => s.fileId)
  const dek = useAuthStore((s) => s.cryptoState.dek)
  const shareCtx = useShareContext()
  const isShareMode = !!shareCtx
  const shareId = shareCtx?.shareId ?? null
  const treeData = shareCtx?.treeData ?? null

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const handleDownload = () => {
    if (isShareMode && shareId && treeData) {
      const node = treeData.find((n: any) => n.id === file.id)
      if (node?.file_key) {
        void downloadSharedFileToDisk(file.name, file.totalSize, {
          shareId,
          fileId: file.id,
          fileKeyB64: node.file_key,
        })
      }
      return
    }
    if (dek) {
      void downloadFileToDisk(file.name, file.totalSize, { dek, fileId: file.id })
    }
  }

  /** "Open with" — hands the decrypted blob to the browser/OS (sheet copy). */
  const handleOpenWith = () => {
    const blob = previewBlob ?? (pdfData ? new Blob([pdfData], { type: 'application/pdf' }) : null)
    if (!blob) {
      toast.info('Still decrypting — try again in a moment.')
      return
    }
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (!win) {
      toast.error('Allow pop-ups to open this file in another app.')
      URL.revokeObjectURL(url)
      return
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  useEffect(() => {
    if (!fileId) {
      setIsLoading(false)
      setError(null)
      return
    }
    if (!file) {
      setIsLoading(false)
      setError('File not found.')
      return
    }
    if (!isShareMode && !dek) {
      setIsLoading(false)
      setError('Vault is locked. Unlock to preview files.')
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    let streamId: string | null = null

    const loadPreview = async () => {
      setIsLoading(true)
      setError(null)
      setPreviewUrl(null)
      setPreviewBlob(null)
      setPreviewText(null)
      setPdfData(null)
      onDetailLoaded(null)
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      try {
        let manifest: any
        let fileKey: Uint8Array | null = null

        if (isShareMode && shareId && treeData) {
          const node = treeData.find((n: any) => n.id === fileId)
          if (!node || !node.file_key) {
            throw new Error('Missing file key for shared file.')
          }
          const { data } = await apiClient.get(
            `/api/v1/shares/${shareId}/files/${fileId}`,
            skipAuthRefresh({ signal: controller.signal })
          )
          manifest = data
          fileKey = await base64ToBytes(node.file_key)
        } else if (dek) {
          const { data } = await apiClient.get(`/api/v1/files/${fileId}/download`, {
            signal: controller.signal,
          })
          manifest = data
          if (!manifest.wrapped_file_key || !manifest.wrapped_file_key_nonce) {
            throw new Error('Missing file key in manifest.')
          }
          const wrappedKey = {
            ciphertext: await base64ToBytes(manifest.wrapped_file_key),
            nonce: await base64ToBytes(manifest.wrapped_file_key_nonce),
          }
          fileKey = await unwrapDek(wrappedKey, dek)
        } else {
          throw new Error('Vault is locked.')
        }

        if (!fileKey) throw new Error('Failed to decrypt file key.')
        if (!manifest.chunks || manifest.chunks.length === 0) {
          throw new Error('No chunks found for this file.')
        }

        const header = await base64ToBytes(manifest.encryption_header)
        streamId = await initFileDecryption(header, fileKey)
        const sortedChunks = [...manifest.chunks].sort((a, b) => a.chunk_index - b.chunk_index)
        const decryptedParts: Uint8Array[] = []
        for (const chunk of sortedChunks) {
          if (controller.signal.aborted) return
          const response = await fetch(chunk.presigned_url, { signal: controller.signal })
          if (!response.ok) {
            throw new Error(`Storage returned ${response.status}. File chunk is missing.`)
          }
          const arrayBuffer = await response.arrayBuffer()
          const ciphertext = new Uint8Array(arrayBuffer)
          if (
            chunk.chunk_size !== undefined &&
            chunk.chunk_size !== null &&
            ciphertext.length !== chunk.chunk_size
          ) {
            throw new Error(
              `Chunk ${chunk.chunk_index} size mismatch! ` +
                `Expected ${chunk.chunk_size}, got ${ciphertext.length}.`
            )
          }
          const plaintext = await decryptFileChunk(streamId, ciphertext)
          decryptedParts.push(plaintext)
        }
        if (controller.signal.aborted) return

        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        const isPdf = ext === 'pdf' || file.mimeType === 'application/pdf'
        const isText = !isPdf && TEXT_EXTS.has(ext)

        const blob = new Blob(decryptedParts as BlobPart[], {
          type: isPdf ? 'application/pdf' : file.mimeType || 'application/octet-stream',
        })
        if (isPdf) {
          setPreviewBlob(blob)
          const pdfArrayBuffer = await blob.arrayBuffer()
          if (!controller.signal.aborted) setPdfData(pdfArrayBuffer)
        } else if (isText) {
          setPreviewBlob(blob)
          const text = await blob.text()
          if (!controller.signal.aborted) setPreviewText(text)
        } else {
          const url = URL.createObjectURL(blob)
          objectUrlRef.current = url
          setPreviewBlob(blob)
          if (!controller.signal.aborted) setPreviewUrl(url)
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || controller.signal.aborted) return
        console.error('Preview failed:', err)
        setError(err?.response?.data?.error?.message ?? err.message ?? 'Failed to load preview.')
      } finally {
        if (streamId) await cleanupFileStream(streamId)
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    loadPreview()
    return () => {
      controller.abort()
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, dek, file?.id, file?.name, file?.mimeType, isShareMode, shareId, treeData])

  const category = getCategory(file.name)

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {canPreview && (
          <div className="uv-preview-viewer">
            <div className="flex h-full w-full items-center justify-center">
              <VaultLoader size={32} />
            </div>
          </div>
        )}
        {!canPreview && (
          <div className="flex flex-1 items-center justify-center py-14">
            <VaultLoader size={32} />
          </div>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {canPreview && (
          <div className="uv-preview-viewer">
            <div className="flex flex-col items-center justify-center gap-3 px-8 text-center">
              <AlertCircle className="text-failed h-7 w-7" strokeWidth={1.6} aria-hidden="true" />
              <div>
                <p className="text-[14px] leading-5 font-semibold text-ink">Preview failed</p>
                <p className="text-muted-foreground mt-1 text-[12.5px] leading-[18px]">{error}</p>
              </div>
            </div>
          </div>
        )}
        {!canPreview && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-14 text-center">
            <AlertCircle className="text-failed h-7 w-7" strokeWidth={1.6} aria-hidden="true" />
            <div>
              <p className="text-[14px] leading-5 font-semibold text-ink">Preview failed</p>
              <p className="text-muted-foreground mt-1 text-[12.5px] leading-[18px]">{error}</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ---- No-preview layout (sheet panel 3): empty block + contents ---- */
  if (!canPreview) {
    const ext = `.${file.name.split('.').pop()?.toLowerCase() || 'file'}`
    const EmptyIcon = category === 'zip' ? Archive : getPreviewIcon(category)
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <PreviewEmpty
          icon={EmptyIcon}
          title={`No preview for ${ext}`}
          onDownload={handleDownload}
          onOpenWith={handleOpenWith}
        />
        {category === 'zip' && <ZipPreview blob={previewBlob} fileName={file.name} />}
      </div>
    )
  }

  /* ---- Previewable layout: viewer (+ details tabs when open) ---- */
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn('uv-preview-viewer', detailsOpen && 'uv-preview-viewer-open')}>
        {pdfData ? (
          <PdfPreview
            data={pdfData}
            fileName={file.name}
            onDownload={handleDownload}
            onPageCount={(count) => onDetailLoaded(`${count} ${count === 1 ? 'page' : 'pages'}`)}
          />
        ) : (
          <FilePreviewer
            fileName={file.name}
            fileUrl={previewUrl}
            fileText={previewText}
            onDownload={handleDownload}
            onOpenWith={handleOpenWith}
            onImageMeta={(width, height) => onDetailLoaded(`${width}×${height}`)}
          />
        )}
      </div>
      {detailsOpen && !isShareMode && (
        <PreviewDetailsPanel file={file} activeTab={activeTab} onTabChange={onTabChange} />
      )}
    </div>
  )
}

export type { PreviewTab }
