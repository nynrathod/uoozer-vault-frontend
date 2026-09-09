import { useState, useEffect, useRef } from 'react'
import { FilePreviewer } from './FilePreviewer'
import { PdfPreview } from './PdfPreview'
import { usePreviewStore } from '@stores/previewStore'
import { useFileStore, selectFileById } from '@stores/fileStore'
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
import { AlertCircle } from 'lucide-react'

export function PreviewContent() {
  const fileId = usePreviewStore((s) => s.fileId)
  const file = useFileStore(selectFileById(fileId))
  const dek = useAuthStore((s) => s.cryptoState.dek)
  const shareCtx = useShareContext()
  const isShareMode = !!shareCtx
  const shareId = shareCtx?.shareId ?? null
  const treeData = shareCtx?.treeData ?? null

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const handleDownload = () => {
    if (!file) return
    if (isShareMode && shareId && treeData) {
      const node = treeData.find((n: any) => n.id === file.id)
      if (node?.file_key) {
        downloadSharedFileToDisk(file.name, file.totalSize, {
          shareId,
          fileId: file.id,
          fileKeyB64: node.file_key,
        })
      }
      return
    }
    if (dek) {
      downloadFileToDisk(file.name, file.totalSize, { dek, fileId: file.id })
    }
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
      setPreviewText(null)
      setPdfData(null)
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
        const isText =
          !isPdf &&
          [
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
          ].includes(ext)

        const blob = new Blob(decryptedParts as BlobPart[], {
          type: isPdf ? 'application/pdf' : file.mimeType || 'application/octet-stream',
        })
        if (isPdf) {
          const pdfArrayBuffer = await blob.arrayBuffer()
          if (!controller.signal.aborted) setPdfData(pdfArrayBuffer)
        } else if (isText) {
          const text = await blob.text()
          if (!controller.signal.aborted) setPreviewText(text)
        } else {
          const url = URL.createObjectURL(blob)
          objectUrlRef.current = url
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
  }, [fileId, dek, file?.id, file?.name, file?.mimeType, isShareMode, shareId, treeData])

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <VaultLoader size={32} />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-4 text-center">
        <AlertCircle className="text-destructive h-8 w-8" />
        <div>
          <p className="font-medium">Preview Error</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    )
  }
  if (pdfData) {
    return (
      <div className="h-full w-full overflow-hidden">
        <PdfPreview
          data={pdfData}
          fileName={file?.name || 'document.pdf'}
          onDownload={handleDownload}
        />
      </div>
    )
  }
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-4">
      <FilePreviewer
        fileName={file?.name || ''}
        fileUrl={previewUrl}
        fileText={previewText}
        onDownload={handleDownload}
      />
    </div>
  )
}
