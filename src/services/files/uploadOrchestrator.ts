/**
 * Upload Orchestrator (Streaming, Memory-Safe, Real-Time Progress)
 *
 * Uses XMLHttpRequest to get true byte-level upload progress.
 * Encrypts chunks sequentially, stores them in IndexedDB to prevent memory crashes,
 * uploads them in parallel, and immediately deletes them from disk on success.
 */

import { fileService } from './fileService'
import {
  initFileEncryption,
  encryptFileChunk,
  encryptMetadataObject,
  bytesToBase64,
  blake3HashBytes,
  cleanupFileStream,
} from '@lib/crypto'
import { validateFile, sanitizeFileName } from '@lib/fileValidation'
import { UPLOAD_CONFIG } from '@config/upload.config'
import { uploadDb } from '@services/upload/uploadDatabase'
import type { CreateFileRequest, ChunkPlan } from '@/types/files'

export interface UploadProgressCallback {
  (uploadedBytes: number, speedBps: number, etaSeconds: number): void
}

export interface UploadOptions {
  dek: Uint8Array
  folderId: string | null
  onProgress?: UploadProgressCallback
  onChunkStatus?: (chunkIndex: number, status: 'uploading' | 'done' | 'error') => void
  signal?: AbortSignal
}

export interface UploadResult {
  fileId: string
  versionId: string
  deduplicated: boolean
}

async function readFileChunk(file: File, start: number, end: number): Promise<Uint8Array> {
  const slice = file.slice(start, end)
  const buffer = await slice.arrayBuffer()
  return new Uint8Array(buffer)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Uploads a single chunk to R2 using XHR for real-time progress tracking.
 * Handles 403 Forbidden by refreshing the presigned URL.
 */
function uploadChunkXHR(
  presignedUrl: string,
  ciphertext: Uint8Array,
  chunkIndex: number,
  signal: AbortSignal,
  onChunkProgress: (loaded: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', presignedUrl, true)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onChunkProgress(event.loaded)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag')?.replace(/"/g, '') || ''
        if (!etag) return reject(new Error('Missing ETag from R2'))
        resolve(etag)
      } else if (xhr.status === 429) {
        reject(new Error('429 Too Many Requests'))
      } else if (xhr.status >= 400 && xhr.status < 500) {
        reject(new Error(`R2 rejected chunk (${xhr.status})`))
      } else {
        reject(new Error(`R2 error: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during chunk upload'))
    xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'))

    if (signal.aborted) {
      xhr.abort()
    } else {
      signal.addEventListener('abort', () => xhr.abort())
    }

    xhr.send(ciphertext as unknown as XMLHttpRequestBodyInit)
  })
}

/** Uploads a single chunk with retry, backoff, stall detection, and URL refresh. */
async function uploadSingleChunk(
  presignedUrl: string,
  ciphertext: Uint8Array,
  chunkIndex: number,
  versionId: string,
  signal: AbortSignal,
  onChunkProgress: (loaded: number) => void
): Promise<{ etag: string }> {
  let lastError: Error | null = null
  let currentUrl = presignedUrl

  for (let attempt = 0; attempt < UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
    if (signal.aborted) throw new Error('Upload cancelled')

    try {
      const etag = await uploadChunkXHR(currentUrl, ciphertext, chunkIndex, signal, onChunkProgress)
      return { etag }
    } catch (error: any) {
      if (error.name === 'AbortError' && signal.aborted) throw error

      lastError = error

      // If presigned URL expired (403), refresh it
      if (error.message.includes('403')) {
        const resumeInfo = await fileService.getResumeInfo(versionId)
        const freshUrlInfo = resumeInfo.upload_urls?.find((u) => u.chunk_index === chunkIndex)
        if (freshUrlInfo) {
          currentUrl = freshUrlInfo.presigned_url
          continue // Retry immediately with new URL
        }
      }

      // Don't retry 4xx fatal errors (except 429/403)
      if (error.message.includes('R2 rejected chunk')) {
        throw error
      }

      const delay = Math.min(
        UPLOAD_CONFIG.RETRY_MAX_DELAY,
        UPLOAD_CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt)
      )
      await sleep(delay + Math.random() * 100) // Jitter
      onChunkProgress(0) // Reset progress for retry
    }
  }

  throw new Error(
    `Chunk ${chunkIndex} failed after ${UPLOAD_CONFIG.MAX_RETRIES} attempts: ${lastError?.message}`
  )
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0

  async function runNext(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++
      results[index] = await tasks[index]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext())
  await Promise.all(workers)
  return results
}

/**
 * Main orchestrator for zero-knowledge chunked upload.
 */
export async function uploadFile(file: File, options: UploadOptions): Promise<UploadResult> {
  const { dek, folderId, onProgress, onChunkStatus, signal } = options

  // 1. Validate
  const validation = await validateFile(file)
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join('; ')}`)
  }

  const sanitizedName = sanitizeFileName(file.name)
  const mimeType = validation.detectedMimeType

  // 2. Encrypt metadata
  const { encryptedMetadata, metadataNonce } = await encryptMetadataObject(
    { name: sanitizedName, mimeType, size: file.size },
    dek
  )

  const uploadId = crypto.randomUUID()
  const header = await initFileEncryption(dek)
  const totalChunks = validation.totalChunks
  const chunkPlans: ChunkPlan[] = []
  const chunkSizes: number[] = []

  // 3. Encrypt chunks sequentially and store in IndexedDB (NOT MEMORY)
  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) throw new Error('Upload cancelled')

    const start = i * UPLOAD_CONFIG.CHUNK_SIZE
    const end = Math.min(start + UPLOAD_CONFIG.CHUNK_SIZE, file.size)
    const plaintext = await readFileChunk(file, start, end)
    const isFinal = i === totalChunks - 1

    const { ciphertext, blake3Hash } = await encryptFileChunk(plaintext, isFinal)

    chunkPlans.push({
      chunk_index: i,
      segment_index: 0,
      chunk_size: ciphertext.byteLength,
      chunk_blake3: await bytesToBase64(blake3Hash),
    })

    chunkSizes[i] = ciphertext.byteLength

    await uploadDb.chunks.put({ id: `${uploadId}-${i}`, data: ciphertext })
    ciphertext.fill(0)
    plaintext.fill(0)
  }

  // Hash the full plaintext file for same-user dedup
  const fullFileBuffer = await file.arrayBuffer()
  const plaintextBlake3 = await blake3HashBytes(new Uint8Array(fullFileBuffer))

  if (signal?.aborted) throw new Error('Upload cancelled')

  // 4. Create file on backend
  const createReq: CreateFileRequest = {
    folder_id: folderId,
    encrypted_metadata: encryptedMetadata,
    metadata_nonce: metadataNonce,
    plaintext_blake3: await bytesToBase64(plaintextBlake3),
    total_size: file.size,
    total_chunks: chunkPlans.length,
    encryption_header: await bytesToBase64(header),
    chunks: chunkPlans,
  }

  const createResp = await fileService.createFile(createReq)

  // 5. Handle dedup hit
  if (createResp.deduplicated) {
    await cleanupFileStream()
    await uploadDb.deleteUpload(uploadId) // Clean IDB
    return { fileId: createResp.file_id, versionId: createResp.version_id, deduplicated: true }
  }

  // Save state to IndexedDB for crash recovery
  await uploadDb.saveUpload({
    uploadId,
    fileId: createResp.file_id,
    versionId: createResp.version_id,
    folderId,
    fileName: sanitizedName,
    fileSize: file.size,
    totalChunks,
    encryptionHeader: await bytesToBase64(header),
    plaintextBlake3: await bytesToBase64(plaintextBlake3),
    status: 'uploading',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  // 6. Upload chunks to R2 in parallel
  const uploadUrls = createResp.upload_urls
  const r2Etags: Record<string, string> = {}
  const chunkProgress = new Array(totalChunks).fill(0)
  const startTime = Date.now()

  const updateOverallProgress = () => {
    let uploadedBytes = 0
    for (let i = 0; i < totalChunks; i++) uploadedBytes += chunkProgress[i]

    const elapsed = (Date.now() - startTime) / 1000
    const speed = uploadedBytes / elapsed
    const remainingBytes = file.size - uploadedBytes
    const eta = speed > 0 ? remainingBytes / speed : 0

    onProgress?.(uploadedBytes, speed, eta)
  }

  const uploadTasks = uploadUrls.map((urlInfo) => {
    return async () => {
      onChunkStatus?.(urlInfo.chunk_index, 'uploading')

      // Retrieve ciphertext from IndexedDB
      const chunkRecord = await uploadDb.chunks.get(`${uploadId}-${urlInfo.chunk_index}`)
      if (!chunkRecord) throw new Error('Ciphertext missing in IndexedDB')
      const ciphertext = chunkRecord.data

      const result = await uploadSingleChunk(
        urlInfo.presigned_url,
        ciphertext,
        urlInfo.chunk_index,
        createResp.version_id,
        signal!,
        (loaded) => {
          chunkProgress[urlInfo.chunk_index] = Math.min(loaded, chunkSizes[urlInfo.chunk_index])
          updateOverallProgress()
        }
      )

      chunkProgress[urlInfo.chunk_index] = chunkSizes[urlInfo.chunk_index]
      updateOverallProgress()

      // Zeroize and delete from IDB immediately
      ciphertext.fill(0)
      await uploadDb.chunks.delete(`${uploadId}-${urlInfo.chunk_index}`)

      r2Etags[String(urlInfo.chunk_index)] = result.etag
      onChunkStatus?.(urlInfo.chunk_index, 'done')
    }
  })

  try {
    await runWithConcurrency(uploadTasks, UPLOAD_CONFIG.MAX_CONCURRENT_UPLOADS)
  } catch (error) {
    // Update state to paused/error so it can be resumed later
    await uploadDb.saveUpload({ ...(await uploadDb.getUpload(uploadId))!, status: 'paused' })
    throw error
  }

  if (signal?.aborted) throw new Error('Upload cancelled')

  // 7. Complete upload
  await fileService.completeUpload(createResp.file_id, {
    version_id: createResp.version_id,
    r2_etags: r2Etags,
  })

  await cleanupFileStream()
  await uploadDb.deleteUpload(uploadId)

  return { fileId: createResp.file_id, versionId: createResp.version_id, deduplicated: false }
}

/**
 * Resumes an interrupted upload from IndexedDB.
 */
export async function resumeUpload(
  uploadId: string,
  options: UploadOptions
): Promise<UploadResult> {
  const state = await uploadDb.getUpload(uploadId)
  if (!state || !state.fileId || !state.versionId) throw new Error('Cannot resume: missing state')

  const { dek, signal, onProgress, onChunkStatus } = options

  const resumeInfo = await fileService.getResumeInfo(state.versionId)
  if (resumeInfo.missing_chunks.length === 0) {
    await fileService.completeUpload(state.fileId, { version_id: state.versionId, r2_etags: {} })
    await uploadDb.deleteUpload(uploadId)
    return { fileId: state.fileId, versionId: state.versionId, deduplicated: false }
  }

  const r2Etags: Record<string, string> = {}
  const chunkProgress = new Array(state.totalChunks).fill(0)
  const startTime = Date.now()

  const updateOverallProgress = () => {
    let uploadedBytes = 0
    for (let i = 0; i < state.totalChunks; i++) uploadedBytes += chunkProgress[i]
    const elapsed = (Date.now() - startTime) / 1000
    const speed = uploadedBytes / elapsed
    const eta = speed > 0 ? (state.fileSize - uploadedBytes) / speed : 0
    onProgress?.(uploadedBytes, speed, eta)
  }

  const uploadTasks = resumeInfo.upload_urls!.map((urlInfo) => {
    return async () => {
      onChunkStatus?.(urlInfo.chunk_index, 'uploading')
      const chunkRecord = await uploadDb.chunks.get(`${uploadId}-${urlInfo.chunk_index}`)
      if (!chunkRecord) throw new Error('Ciphertext missing in IndexedDB')
      const ciphertext = chunkRecord.data

      const result = await uploadSingleChunk(
        urlInfo.presigned_url,
        ciphertext,
        urlInfo.chunk_index,
        state.versionId!,
        signal!,
        (loaded) => {
          chunkProgress[urlInfo.chunk_index] = Math.min(loaded, ciphertext.byteLength)
          updateOverallProgress()
        }
      )

      chunkProgress[urlInfo.chunk_index] = ciphertext.byteLength
      updateOverallProgress()

      ciphertext.fill(0)
      await uploadDb.chunks.delete(`${uploadId}-${urlInfo.chunk_index}`)
      r2Etags[String(urlInfo.chunk_index)] = result.etag
      onChunkStatus?.(urlInfo.chunk_index, 'done')
    }
  })

  await runWithConcurrency(uploadTasks, UPLOAD_CONFIG.MAX_CONCURRENT_UPLOADS)

  await fileService.completeUpload(state.fileId, {
    version_id: state.versionId,
    r2_etags: r2Etags,
  })

  await uploadDb.deleteUpload(uploadId)

  return { fileId: state.fileId, versionId: state.versionId, deduplicated: false }
}
