import { useState, useCallback, useRef } from 'react'
import { useAuthStore } from '@stores/authStore'
import { fileService } from '@services/files/fileService'
import {
  base64ToBytes,
  bytesToBase64,
  unwrapDek,
  initFileEncryption,
  encryptFileChunk,
  cleanupFileStream,
  blake3HashBytes,
} from '@lib/crypto'
import { UPLOAD_CONFIG } from '@/config/upload.config'
import { validateFile } from '@/lib/fileValidation'
import type { CreateFileRequest, ChunkPlan } from '@/types/files'

type UploadStatus = 'idle' | 'preparing' | 'uploading' | 'completing' | 'done' | 'error'

interface VersionUploadState {
  status: UploadStatus
  progress: number
  error: string | null
}

const initialState: VersionUploadState = {
  status: 'idle',
  progress: 0,
  error: null,
}

export function useVersionUpload() {
  const [state, setState] = useState<VersionUploadState>(initialState)
  const createdVersionRef = useRef<{ fileId: string; versionId: string } | null>(null)

  const updateState = useCallback((patch: Partial<VersionUploadState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const uploadVersion = useCallback(
    async (file: File, fileId: string): Promise<void> => {
      try {
        updateState({ status: 'preparing', progress: 0, error: null })
        createdVersionRef.current = null

        const dek = useAuthStore.getState().cryptoState.dek
        if (!dek) throw new Error('Vault is locked. Please unlock and try again.')

        const fileMeta = await fileService.getById(fileId)

        if (fileMeta.is_uploading) {
          throw new Error('A previous upload is still in progress for this file.')
        }
        if (fileMeta.deleted_at) {
          throw new Error('This file has been deleted.')
        }
        if (!fileMeta.wrapped_file_key || !fileMeta.wrapped_file_key_nonce) {
          throw new Error(
            'File encryption key is missing. This file may have been created with an older version of the app.'
          )
        }

        const wrappedKey = {
          ciphertext: await base64ToBytes(fileMeta.wrapped_file_key),
          nonce: await base64ToBytes(fileMeta.wrapped_file_key_nonce),
        }
        const fileKey = await unwrapDek(wrappedKey, dek)
        if (!fileKey) throw new Error('Failed to decrypt file key.')

        const validation = await validateFile(file)
        if (!validation.valid) {
          throw new Error(validation.errors[0]?.message || 'File validation failed.')
        }

        const fileBuffer = await file.arrayBuffer()
        const fileBytes = new Uint8Array(fileBuffer)

        const plaintextBlake3Bytes = await blake3HashBytes(fileBytes)
        const plaintextBlake3 = await bytesToBase64(plaintextBlake3Bytes)

        const { header, streamId } = await initFileEncryption(fileKey)
        const encryptionHeader = await bytesToBase64(header)

        const chunkSize = UPLOAD_CONFIG.CHUNK_SIZE
        const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize))
        const chunks: ChunkPlan[] = []
        const ciphertextChunks: Map<number, Uint8Array> = new Map()

        for (let i = 0; i < totalChunks; i++) {
          const offset = i * chunkSize
          const end = Math.min(offset + chunkSize, file.size)
          const plaintext = fileBytes.slice(offset, end)
          const isFinal = i === totalChunks - 1

          const { ciphertext, blake3Hash } = await encryptFileChunk(streamId, plaintext, isFinal)

          chunks.push({
            chunk_index: i,
            segment_index: 0,
            chunk_size: ciphertext.length,
            chunk_blake3: await bytesToBase64(blake3Hash),
          })
          ciphertextChunks.set(i, ciphertext)
        }
        await cleanupFileStream(streamId)

        const createReq: CreateFileRequest = {
          folder_id: fileMeta.folder_id,
          encrypted_metadata: fileMeta.encrypted_metadata,
          metadata_nonce: fileMeta.metadata_nonce,
          plaintext_blake3: plaintextBlake3,
          total_size: file.size,
          total_chunks: totalChunks,
          encryption_header: encryptionHeader,
          chunks,
          wrapped_file_key: fileMeta.wrapped_file_key,
          wrapped_file_key_nonce: fileMeta.wrapped_file_key_nonce,
        }

        updateState({ status: 'uploading', progress: 0 })

        const createResp = await fileService.createVersion(fileId, createReq)

        if (createResp.deduplicated) {
          updateState({ status: 'done', progress: 100 })
          return
        }

        createdVersionRef.current = { fileId, versionId: createResp.version_id }

        const etags: Record<string, string> = {}
        const batchSize = UPLOAD_CONFIG.MAX_CONCURRENT_UPLOADS
        let uploadedCount = 0

        for (let i = 0; i < createResp.upload_urls.length; i += batchSize) {
          const batch = createResp.upload_urls.slice(i, i + batchSize)

          await Promise.all(
            batch.map(async (url) => {
              const chunkData = ciphertextChunks.get(url.chunk_index)
              if (!chunkData) throw new Error(`Chunk ${url.chunk_index} not found in local cache.`)

              const response = await fetch(url.presigned_url, {
                method: 'PUT',
                body: new Blob([chunkData as unknown as BlobPart]),
              })

              if (!response.ok) {
                throw new Error(`Failed to upload chunk ${url.chunk_index}.`)
              }

              const etag = response.headers.get('ETag')?.replace(/"/g, '') || ''
              etags[url.chunk_index] = etag
            })
          )

          uploadedCount += batch.length
          const progress = Math.round((uploadedCount / createResp.upload_urls.length) * 100)
          updateState({ progress })
        }

        updateState({ status: 'completing' })

        await fileService.completeUpload(fileId, {
          version_id: createResp.version_id,
          r2_etags: etags,
        })

        createdVersionRef.current = null
        updateState({ status: 'done', progress: 100 })
      } catch (error: any) {
        if (createdVersionRef.current) {
          const { fileId, versionId } = createdVersionRef.current
          try {
            await fileService.cancelUpload(fileId, versionId)
          } catch {}
          createdVersionRef.current = null
        }

        updateState({
          status: 'error',
          error: error?.message || 'Failed to upload new version.',
        })
        throw error
      }
    },
    [updateState]
  )

  const resetUpload = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    uploadState: state,
    uploadVersion,
    resetUpload,
  }
}
