import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@stores/authStore'
import { useUploadStore } from '@stores/uploadStore'
import { uploadFile } from '@services/files/uploadOrchestrator'
import { validateFile, isJunkFile } from '@lib/fileValidation'
import { UPLOAD_CONFIG } from '@config/upload.config'
import { QUERY_KEYS } from '@lib/constants'
import { folderService } from '@services/folders/folderService'
import { fileService } from '@services/files/fileService'
import { encryptMetadataObject } from '@lib/crypto'
import type { UploadChunk } from '@/types/upload'
import type { CreateFileRequest } from '@/types/files'
import type { CreateFolderRequest } from '@/types/folders'

function buildChunks(totalChunks: number, fileSize: number): UploadChunk[] {
  return Array.from({ length: totalChunks }, (_, i) => ({
    index: i,
    segmentIndex: 0,
    status: 'pending' as const,
    progress: 0,
    size: Math.min(UPLOAD_CONFIG.CHUNK_SIZE, fileSize - i * UPLOAD_CONFIG.CHUNK_SIZE),
    ciphertextSize: 0,
    blake3Hash: null,
    r2Etag: null,
    r2Key: null,
    presignedUrl: null,
    error: null,
    retries: 0,
  }))
}

export function useFileUpload() {
  const dek = useAuthStore((s) => s.cryptoState.dek)
  const addUpload = useUploadStore((s) => s.addUpload)
  const updateUpload = useUploadStore((s) => s.updateUpload)
  const updateChunk = useUploadStore((s) => s.updateChunk)
  const removeUpload = useUploadStore((s) => s.removeUpload)
  const abortControllers = useRef<Map<string, AbortController>>(new Map())
  const queryClient = useQueryClient()

  const uploadFiles = useCallback(
    async (files: File[], currentFolderId: string | null) => {
      if (!dek) {
        toast.error('Vault is locked. Please unlock to upload files.')
        return
      }

      const validFiles = files.filter((file) => !isJunkFile(file.name))
      if (validFiles.length === 0) {
        toast.info('No valid files found for upload.')
        return
      }

      const uploadIdByFile = new Map<File, string>()
      for (const file of validFiles) {
        const uploadId = crypto.randomUUID()
        uploadIdByFile.set(file, uploadId)
        const estimatedChunks = Math.max(1, Math.ceil(file.size / UPLOAD_CONFIG.CHUNK_SIZE))
        addUpload({
          id: uploadId,
          file,
          fileId: null,
          versionId: null,
          folderId: currentFolderId,
          totalSize: file.size,
          totalChunks: estimatedChunks,
          chunks: buildChunks(estimatedChunks, file.size),
          status: 'queued',
          overallProgress: 0,
          errorMessage: null,
          startedAt: Date.now(),
          completedAt: null,
          deduplicated: false,
        })
      }
      const failQueuedRows = (message: string) => {
        for (const id of uploadIdByFile.values()) {
          const row = useUploadStore.getState().uploads.get(id)
          if (row && (row.status === 'queued' || row.status === 'encrypting')) {
            updateUpload(id, { status: 'error', errorMessage: message })
          }
        }
      }

      const totalBulkSize = validFiles.reduce((acc, file) => acc + file.size, 0)
      try {
        const precheck = await fileService.precheckUpload(
          '00000000000000000000000000000000',
          totalBulkSize
        )
        if (!precheck.allowed) throw new Error('Storage quota exceeded')
      } catch (error: any) {
        toast.error(error.message ?? 'Quota check failed')
        failQueuedRows(error.message ?? 'Quota check failed')
        return
      }

      const folderMap = new Map<string, string | null>()
      folderMap.set('', currentFolderId)
      const foldersToCreate: { path: string; name: string; parentPath: string; depth: number }[] =
        []

      for (const file of validFiles) {
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

        if (parts.length > UPLOAD_CONFIG.MAX_FOLDER_DEPTH) {
          toast.error(`Folder depth exceeds limit of ${UPLOAD_CONFIG.MAX_FOLDER_DEPTH}`)
          continue
        }

        let currentPath = ''
        let parentPath = ''
        let depth = 0

        for (const part of parts) {
          parentPath = currentPath
          currentPath = currentPath ? `${currentPath}/${part}` : part
          depth++

          if (!folderMap.has(currentPath)) {
            foldersToCreate.push({ path: currentPath, name: part, parentPath, depth })
            folderMap.set(currentPath, null)
          }
        }
        ;(file as any)._targetFolderId = null
      }

      if (foldersToCreate.length > 0) {
        try {
          foldersToCreate.sort((a, b) => a.depth - b.depth)

          const encryptedMetas = await Promise.all(
            foldersToCreate.map((f) => encryptMetadataObject({ name: f.name }, dek))
          )
          const bulkReqs: CreateFolderRequest[] = foldersToCreate.map((f, i) => {
            const parentId = f.parentPath ? folderMap.get(f.parentPath) : currentFolderId
            const newFolderId = crypto.randomUUID()
            folderMap.set(f.path, newFolderId)
            return {
              encrypted_metadata: encryptedMetas[i].encryptedMetadata,
              metadata_nonce: encryptedMetas[i].metadataNonce,
              parent_folder_id: parentId ?? null,
              folder_id: newFolderId,
            }
          })

          await folderService.bulkCreate(bulkReqs)

          for (const file of validFiles) {
            const rawPath = (file as any).path || (file as any).webkitRelativePath || ''
            let normalizedPath = rawPath
              .replace(/\\/g, '/')
              .replace(/^[a-zA-Z]:/, '')
              .replace(/^\/+/, '')
            const parts = normalizedPath
              .split('/')
              .filter((p: string) => p && p !== '.' && p !== '..')
            parts.pop()
            if (parts.length > 0) {
              ;(file as any)._targetFolderId = folderMap.get(parts.join('/'))
            }
          }
        } catch (err: any) {
          toast.error(err?.message ?? 'Failed to create folder structure. Upload aborted.')
          failQueuedRows('Folder creation failed')
          return
        }
      }

      const prepared = await Promise.all(
        validFiles.map(async (file) => {
          const validation = await validateFile(file)
          if (!validation.valid) return { file, validation, meta: null }
          const meta = await encryptMetadataObject(
            { name: file.name, mimeType: validation.detectedMimeType, size: file.size },
            dek
          )
          return { file, validation, meta }
        })
      )

      const validUploads: { uploadId: string; file: File; initReq: CreateFileRequest }[] = []
      for (const { file, validation, meta } of prepared) {
        const uploadId = uploadIdByFile.get(file)!
        if (!validation.valid || !meta) {
          toast.error(`${file.name}: ${validation.errors[0]?.message ?? 'Validation failed'}`)
          removeUpload(uploadId)
          continue
        }

        const targetFolderId = (file as any)._targetFolderId || currentFolderId

        const chunkPlans = Array.from({ length: validation.totalChunks }, (_, i) => ({
          chunk_index: i,
          segment_index: 0,
          chunk_size:
            Math.min(UPLOAD_CONFIG.CHUNK_SIZE, file.size - i * UPLOAD_CONFIG.CHUNK_SIZE) +
            UPLOAD_CONFIG.SECRETSTREAM_OVERHEAD,
          chunk_blake3: 'pending',
        }))

        const initReq: CreateFileRequest = {
          folder_id: targetFolderId,
          encrypted_metadata: meta.encryptedMetadata,
          metadata_nonce: meta.metadataNonce,
          plaintext_blake3: 'pending',
          total_size: file.size,
          total_chunks: validation.totalChunks,
          encryption_header: 'pending',
          chunks: chunkPlans,
          wrapped_file_key: '',
          wrapped_file_key_nonce: '',
        }

        updateUpload(uploadId, {
          folderId: targetFolderId,
          totalChunks: validation.totalChunks,
          chunks: buildChunks(validation.totalChunks, file.size),
        })
        validUploads.push({ uploadId, file, initReq })
      }
      if (validUploads.length === 0) return

      try {
        const initResults = await fileService.bulkInitUploads(validUploads.map((v) => v.initReq))

        const completionPayloads: any[] = []

        const uploadPromises = validUploads.map(async ({ uploadId, file }, i) => {
          const result = initResults[i]

          updateUpload(uploadId, {
            status: 'encrypting',
            fileId: result.file_id,
            versionId: result.version_id,
            deduplicated: result.deduplicated,
          })

          if (result.deduplicated) {
            updateUpload(uploadId, {
              status: 'done',
              completedAt: Date.now(),
              overallProgress: 100,
            })
            return
          }

          const controller = new AbortController()
          abortControllers.current.set(uploadId, controller)

          try {
            const res = await uploadFile(file, {
              dek,
              folderId: (file as any)._targetFolderId || currentFolderId,
              signal: controller.signal,
              preInitData: result,
              onProgress: (uploadedBytes) => {
                const overallProgress = Math.min(99, Math.round((uploadedBytes / file.size) * 100))
                updateUpload(uploadId, { overallProgress })
              },
              onChunkStatus: (chunkIndex, status) => {
                updateChunk(uploadId, String(chunkIndex), { status })
              },
            })

            completionPayloads.push({
              uploadId,
              file_id: res.fileId,
              version_id: res.versionId,
              r2_etags: res.r2Etags,
              plaintext_blake3: res.plaintextBlake3,
              encryption_header: res.encryptionHeader,
              chunk_hashes: res.chunkHashes,
              wrapped_file_key: res.wrappedFileKey,
              wrapped_file_key_nonce: res.wrappedFileKeyNonce,
            })

            updateUpload(uploadId, { status: 'completing' })
          } catch (error: any) {
            updateUpload(uploadId, {
              status: 'error',
              errorMessage: error.message ?? 'Upload failed',
            })
          } finally {
            abortControllers.current.delete(uploadId)
          }
        })

        await Promise.allSettled(uploadPromises)

        if (completionPayloads.length > 0) {
          const apiPayload = completionPayloads.map(({ uploadId, ...rest }) => rest)
          await fileService.bulkCompleteUploads(apiPayload)

          for (const payload of completionPayloads) {
            updateUpload(payload.uploadId, {
              status: 'done',
              completedAt: Date.now(),
              overallProgress: 100,
            })
          }
        }

        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
      } catch (error: any) {
        toast.error(error.message ?? 'Bulk upload initialization failed')
        failQueuedRows(error.message ?? 'Upload failed')
      }
    },
    [dek, addUpload, updateUpload, updateChunk, removeUpload, queryClient]
  )

  const cancelUpload = useCallback((uploadId: string) => {
    const controller = abortControllers.current.get(uploadId)
    if (controller) controller.abort()
  }, [])

  const cancelAllUploads = useCallback(() => {
    abortControllers.current.forEach((controller) => controller.abort())
    abortControllers.current.clear()
  }, [])

  return { uploadFiles, cancelUpload, cancelAllUploads }
}
