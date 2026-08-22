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
import type { UploadFile } from '@/types/upload'
import type { CreateFileRequest } from '@/types/files'

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

      const validFiles = files.filter((file) => !isJunkFile(file.name))
      if (validFiles.length === 0) {
        toast.info('No valid files found for upload.')
        return
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
          for (const f of foldersToCreate) {
            const parentId = f.parentPath ? folderMap.get(f.parentPath) : currentFolderId
            const { encryptedMetadata, metadataNonce } = await encryptMetadataObject(
              { name: f.name },
              dek
            )
            const created = await folderService.create({
              encrypted_metadata: encryptedMetadata,
              metadata_nonce: metadataNonce,
              parent_folder_id: parentId ?? null,
            })
            folderMap.set(f.path, created.folder_id)
          }

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
        } catch (err) {
          toast.error('Failed to create folder structure. Upload aborted.')
          return
        }
      }

      const validUploads: { upload: UploadFile; file: File; initReq: CreateFileRequest }[] = []

      for (const file of validFiles) {
        const validation = await validateFile(file)
        if (!validation.valid) {
          toast.error(`${file.name}: ${validation.errors[0].message}`)
          continue
        }

        const targetFolderId = (file as any)._targetFolderId || currentFolderId
        const { encryptedMetadata, metadataNonce } = await encryptMetadataObject(
          { name: file.name, mimeType: validation.detectedMimeType, size: file.size },
          dek
        )

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
          encrypted_metadata: encryptedMetadata,
          metadata_nonce: metadataNonce,
          plaintext_blake3: 'pending',
          total_size: file.size,
          total_chunks: validation.totalChunks,
          encryption_header: 'pending',
          chunks: chunkPlans,
        }

        const uploadId = crypto.randomUUID()
        const upload: UploadFile = {
          id: uploadId,
          file,
          fileId: null,
          versionId: null,
          folderId: targetFolderId,
          totalSize: file.size,
          totalChunks: validation.totalChunks,
          chunks: Array.from({ length: validation.totalChunks }, (_, i) => ({
            index: i,
            segmentIndex: 0,
            status: 'pending' as const,
            progress: 0,
            size: Math.min(UPLOAD_CONFIG.CHUNK_SIZE, file.size - i * UPLOAD_CONFIG.CHUNK_SIZE),
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
        validUploads.push({ upload, file, initReq })
      }

      try {
        const initResults = await fileService.bulkInitUploads(validUploads.map((v) => v.initReq))

        for (let i = 0; i < validUploads.length; i++) {
          const { upload, file } = validUploads[i]
          const result = initResults[i]

          updateUpload(upload.id, {
            status: 'encrypting',
            fileId: result.file_id,
            versionId: result.version_id,
            deduplicated: result.deduplicated,
          })

          if (result.deduplicated) {
            updateUpload(upload.id, {
              status: 'done',
              completedAt: Date.now(),
              overallProgress: 100,
            })
            continue
          }

          const controller = new AbortController()
          abortControllers.current.set(upload.id, controller)

          uploadFile(file, {
            dek,
            folderId: upload.folderId,
            signal: controller.signal,
            preInitData: result,
            onProgress: (uploadedBytes, speed, eta) => {
              const overallProgress = Math.min(99, Math.round((uploadedBytes / file.size) * 100))
              updateUpload(upload.id, { overallProgress })
            },
            onChunkStatus: (chunkIndex, status) => {
              updateChunk(upload.id, String(chunkIndex), { status })
            },
          })
            .then((res) => {
              if (res.deduplicated) {
                updateUpload(upload.id, {
                  status: 'done',
                  completedAt: Date.now(),
                  overallProgress: 100,
                })
                return
              }
              updateUpload(upload.id, { status: 'completing' })
              fileService
                .bulkCompleteUploads([
                  {
                    file_id: res.fileId,
                    version_id: res.versionId,
                    r2_etags: res.r2Etags,
                    plaintext_blake3: res.plaintextBlake3,
                    encryption_header: res.encryptionHeader,
                    chunk_hashes: res.chunkHashes,
                  },
                ])
                .then(() => {
                  updateUpload(upload.id, {
                    status: 'done',
                    completedAt: Date.now(),
                    overallProgress: 100,
                  })
                  abortControllers.current.delete(upload.id)
                })
            })
            .catch((error) => {
              updateUpload(upload.id, {
                status: 'error',
                errorMessage: error.message ?? 'Upload failed',
              })
            })
        }

        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
      } catch (error: any) {
        toast.error(error.message ?? 'Bulk upload initialization failed')
      }
    },
    [dek, addUpload, updateUpload, updateChunk, queryClient]
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
