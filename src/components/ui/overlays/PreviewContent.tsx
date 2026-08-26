import { useState, useEffect, useRef } from 'react'
import { FilePreviewer } from './FilePreviewer'
import { usePreviewStore } from '@stores/previewStore'
import { useFileStore, selectFileById } from '@stores/fileStore'
import { useAuthStore } from '@stores/authStore'
import { apiClient } from '@services/api/client'
import { downloadFileToDisk } from '@services/files/downloadOrchestrator'
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

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!fileId || !dek || !file) {
      setIsLoading(false)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    let streamId: string | null = null
    let objectUrl: string | null = null

    const loadPreview = async () => {
      setIsLoading(true)
      setError(null)
      setPreviewUrl(null)
      setPreviewText(null)

      try {
        const { data: manifest } = await apiClient.get(`/api/v1/files/${fileId}/download`, {
          signal: controller.signal,
        })
        if (!manifest.chunks || manifest.chunks.length === 0) {
          throw new Error('No chunks found for this file.')
        }

        const wrappedKey = {
          ciphertext: await base64ToBytes(manifest.wrapped_file_key),
          nonce: await base64ToBytes(manifest.wrapped_file_key_nonce),
        }
        const fileKey = await unwrapDek(wrappedKey, dek)
        if (!fileKey) throw new Error('Failed to decrypt file key.')

        const header = await base64ToBytes(manifest.encryption_header)
        streamId = await initFileDecryption(header, fileKey)

        const decryptedParts: Uint8Array[] = []
        for (const chunk of manifest.chunks) {
          if (controller.signal.aborted) return

          const response = await fetch(chunk.presigned_url, { signal: controller.signal })
          if (!response.ok) {
            throw new Error(`Storage returned ${response.status}. File chunk is missing.`)
          }
          const arrayBuffer = await response.arrayBuffer()
          const ciphertext = new Uint8Array(arrayBuffer)
          const plaintext = await decryptFileChunk(streamId, ciphertext)
          decryptedParts.push(plaintext)
        }

        if (controller.signal.aborted) return

        const blob = new Blob(decryptedParts as BlobPart[], {
          type: file.mimeType || 'application/octet-stream',
        })

        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        const isText = [
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
        ].includes(ext)

        if (isText) {
          const text = await blob.text()
          if (!controller.signal.aborted) setPreviewText(text)
        } else {
          objectUrl = URL.createObjectURL(blob)
          if (!controller.signal.aborted) setPreviewUrl(objectUrl)
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || controller.signal.aborted) return
        console.error('Preview failed:', err)
        setError(err.message || 'Failed to load preview.')
      } finally {
        if (streamId) await cleanupFileStream(streamId)
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    loadPreview()

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fileId, dek, file])

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

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-4">
      <FilePreviewer
        fileName={file?.name || ''}
        fileUrl={previewUrl}
        fileText={previewText}
        onDownload={() =>
          file && dek && downloadFileToDisk(file.name, file.totalSize, { dek, fileId: file.id })
        }
      />
    </div>
  )
}
