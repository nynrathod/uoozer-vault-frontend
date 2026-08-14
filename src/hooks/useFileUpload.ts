import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@stores/authStore'
import { useUploadStore } from '@stores/uploadStore'
import { uploadFile } from '@services/files/uploadOrchestrator'
import { validateFile } from '@lib/fileValidation'
import { QUERY_KEYS } from '@lib/constants'
import { folderService } from '@services/folders/folderService'
import { encryptMetadataObject } from '@lib/crypto'
import type { UploadFile } from '@/types/upload'

/** Manages file upload lifecycle: validation, encryption, upload, progress. */
export function useFileUpload() {
  const dek = useAuthStore((s) => s.cryptoState.dek)
  const addUpload = useUploadStore((s) => s.addUpload)
  const updateUpload = useUploadStore((s) => s.updateUpload)
  const updateChunk = useUploadStore((s) => s.updateChunk)
  const abortControllers = useRef<Map<string, AbortController>>(new Map())

  const queryClient = useQueryClient()

  const uploadFiles = useCallback(
    async (files: File[], currentFolderId: string | null) => {
      if (!dek) {
        toast.error('Vault is locked. Please unlock to upload files.')
        return
      }

      const folderMap = new Map<string, string | null>()
      folderMap.set('', currentFolderId)

      // 1. Parse paths and create folders sequentially if needed
      for (const file of files) {
        const rawPath = (file as any).path || (file as any).webkitRelativePath || ''

        // Normalize path: replace backslashes, remove leading slashes, remove drive letters
        let normalizedPath = rawPath
          .replace(/\\/g, '/')
          .replace(/^[a-zA-Z]:/, '')
          .replace(/^\/+/, '')

        // If it doesn't contain a slash, it's a loose file at the root
        if (!normalizedPath.includes('/')) {
          ;(file as any)._targetFolderId = currentFolderId
          continue
        }

        const parts = normalizedPath.split('/').filter((p: string) => p && p !== '.' && p !== '..')
        parts.pop() // Remove filename

        // If no directory parts remain, it's a loose file
        if (parts.length === 0) {
          ;(file as any)._targetFolderId = currentFolderId
          continue
        }

        let currentParent = currentFolderId
        let currentPath = ''

        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part
          if (folderMap.has(currentPath)) {
            currentParent = folderMap.get(currentPath)!
          } else {
            try {
              const { encryptedMetadata, metadataNonce } = await encryptMetadataObject(
                { name: part },
                dek
              )
              const folder = await folderService.create({
                encrypted_metadata: encryptedMetadata,
                metadata_nonce: metadataNonce,
                parent_folder_id: currentParent,
              })
              folderMap.set(currentPath, folder.folder_id)
              currentParent = folder.folder_id
            } catch (err) {
              console.error('Failed to create folder:', part, err)
              toast.error(`Failed to create folder: ${part}`)
            }
          }
        }
        ;(file as any)._targetFolderId = currentParent
      }

      // 2. Upload files SEQUENTIALLY
      for (const file of files) {
        const validation = validateFile(file)
        if (!validation.valid) {
          toast.error(`${file.name}: ${validation.errors[0].message}`)
          continue
        }

        const uploadId = crypto.randomUUID()
        const totalChunks = validation.totalChunks
        const targetFolderId = (file as any)._targetFolderId || currentFolderId

        const upload: UploadFile = {
          id: uploadId,
          file,
          fileId: null,
          versionId: null,
          folderId: targetFolderId,
          totalSize: file.size,
          totalChunks,
          chunks: Array.from({ length: totalChunks }, (_, i) => ({
            index: i,
            segmentIndex: 0,
            status: 'pending' as const,
            progress: 0,
            size: Math.min(4 * 1024 * 1024, file.size - i * 4 * 1024 * 1024),
            ciphertextSize: 0,
            blake3Hash: null,
            r2Etag: null,
            r2Key: null,
            presignedUrl: null,
            error: null,
            retries: 0,
          })),
          status: 'queued',
          overallProgress: 0,
          errorMessage: null,
          startedAt: Date.now(),
          completedAt: null,
          deduplicated: false,
        }

        addUpload(upload)

        const controller = new AbortController()
        abortControllers.current.set(uploadId, controller)

        try {
          updateUpload(uploadId, { status: 'encrypting' })

          const result = await uploadFile(file, {
            dek,
            folderId: targetFolderId,
            signal: controller.signal,
            onProgress: (_uploadId, chunkIndex, progress) => {
              updateChunk(uploadId, String(chunkIndex), { progress })
            },
            onChunkStatus: (_uploadId, chunkIndex, status) => {
              updateChunk(uploadId, String(chunkIndex), { status })
            },
          })

          updateUpload(uploadId, {
            status: 'done',
            fileId: result.fileId,
            versionId: result.versionId,
            deduplicated: result.deduplicated,
            completedAt: Date.now(),
            overallProgress: 100,
          })

          if (result.deduplicated) {
            toast.success(`${file.name} — already uploaded (deduplicated)`)
          } else {
            toast.success(`${file.name} uploaded successfully`)
          }
        } catch (error: any) {
          if (controller.signal.aborted) {
            updateUpload(uploadId, { status: 'cancelled' })
            toast.info(`${file.name} upload cancelled`)
          } else {
            updateUpload(uploadId, {
              status: 'error',
              errorMessage: error.message ?? 'Upload failed',
            })
            toast.error(`${file.name}: ${error.message ?? 'Upload failed'}`)
          }
        } finally {
          abortControllers.current.delete(uploadId)
        }
      }

      // Refresh file list
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
    },
    [dek, addUpload, updateUpload, updateChunk, queryClient]
  )

  const cancelUpload = useCallback((uploadId: string) => {
    const controller = abortControllers.current.get(uploadId)
    if (controller) {
      controller.abort()
    }
  }, [])

  return { uploadFiles, cancelUpload }
}
