import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
      if (!dek) return

      const folderMap = new Map<string, string | null>()
      folderMap.set('', currentFolderId)

      for (const file of files) {
        const rawPath = (file as any).path || (file as any).webkitRelativePath || ''
        let normalizedPath = rawPath
          .replace(/\\/g, '/')
          .replace(/^[a-zA-Z]:/, '')
          .replace(/^\/+/, '')

        if (!normalizedPath.includes('/')) {
          ;(file as any)._targetFolderId = currentFolderId
          continue
        }

        const parts = normalizedPath.split('/').filter((p: string) => p && p !== '.' && p !== '..')
        parts.pop()

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
            }
          }
        }
        ;(file as any)._targetFolderId = currentParent
      }

      const validUploads: { upload: UploadFile; file: File }[] = []

      for (const file of files) {
        const validation = await validateFile(file)
        if (!validation.valid) continue

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
        validUploads.push({ upload, file })
      }

      for (const { upload, file } of validUploads) {
        const uploadId = upload.id
        const targetFolderId = upload.folderId

        const controller = new AbortController()
        abortControllers.current.set(uploadId, controller)

        try {
          updateUpload(uploadId, { status: 'encrypting' })
          const result = await uploadFile(file, {
            dek,
            folderId: targetFolderId,
            signal: controller.signal,

            // Map the new byte-based progress to the store's overall progress (0-100)
            onProgress: (uploadedBytes, speedBps, etaSeconds) => {
              const overallProgress = Math.min(99, Math.round((uploadedBytes / file.size) * 100))
              updateUpload(uploadId, {
                overallProgress,
                // If you want to display speed/ETA in your UI later, add these to your UploadFile type:
                // speedBps,
                // etaSeconds
              })
            },

            onChunkStatus: (chunkIndex, status) => {
              // This is still useful for the UI to know which specific chunks are done
              updateChunk(uploadId, String(chunkIndex), { status })
            },
          })

          updateUpload(uploadId, {
            status: 'done',
            fileId: result.fileId,
            versionId: result.versionId,
            deduplicated: result.deduplicated,
            completedAt: Date.now(),
            overallProgress: 100, // Force 100% on success
          })

          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
        } catch (error: any) {
          if (controller.signal.aborted) {
            updateUpload(uploadId, { status: 'cancelled' })
          } else {
            updateUpload(uploadId, {
              status: 'error',
              errorMessage: error.message ?? 'Upload failed',
            })
          }
        } finally {
          abortControllers.current.delete(uploadId)
        }
      }
    },
    [dek, addUpload, updateUpload, updateChunk, queryClient]
  )

  const cancelUpload = useCallback((uploadId: string) => {
    const controller = abortControllers.current.get(uploadId)
    if (controller) controller.abort()
  }, [])

  return { uploadFiles, cancelUpload }
}
