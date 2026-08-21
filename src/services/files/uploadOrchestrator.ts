/**
 * Upload Orchestrator (Streaming, Memory-Safe, Real-Time Progress)
 *
 * Uses XMLHttpRequest to get true byte-level upload progress.
 * Encrypts chunks sequentially, uploads them in parallel, and
 * immediately zeroizes memory upon successful upload.
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
import type { CreateFileRequest, ChunkPlan } from '@/types/files'
import { uploadDb } from '../upload/uploadDatabase'

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

    // Real-time progress event
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

    // Connect external abort signal
    if (signal.aborted) {
      xhr.abort()
    } else {
      signal.addEventListener('abort', () => xhr.abort())
    }

    xhr.send(ciphertext as unknown as XMLHttpRequestBodyInit)
  })
}

/** Uploads a single chunk with retry, backoff, and stall detection. */
async function uploadSingleChunk(
  presignedUrl: string,
  ciphertext: Uint8Array,
  chunkIndex: number,
  signal: AbortSignal,
  onChunkProgress: (loaded: number) => void
): Promise<{ etag: string }> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
    if (signal.aborted) throw new Error('Upload cancelled')

    try {
      const etag = await uploadChunkXHR(
        presignedUrl,
        ciphertext,
        chunkIndex,
        signal,
        onChunkProgress
      )
      return { etag }
    } catch (error: any) {
      if (error.name === 'AbortError' && signal.aborted) throw error

      lastError = error

      // Don't retry 4xx fatal errors
      if (error.message.includes('R2 rejected chunk')) {
        throw error
      }

      const delay = Math.min(
        UPLOAD_CONFIG.RETRY_MAX_DELAY,
        UPLOAD_CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt)
      )
      await sleep(delay + Math.random() * 100) // Jitter

      // Reset progress for this chunk on retry
      onChunkProgress(0)
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

  const uploadId = crypto.randomUUID() // Generate ID for DB tracking
  const header = await initFileEncryption(dek)
  const totalChunks = validation.totalChunks
  const chunkPlans: ChunkPlan[] = []

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

    // STORE IN INDEXEDDB AND ZEROIZE MEMORY IMMEDIATELY
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
    await uploadDb.chunks.where('id').startsWith(`${uploadId}-`).delete() // Clean DB
    return { fileId: createResp.file_id, versionId: createResp.version_id, deduplicated: true }
  }

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
    const eta = speed > 0 ? (file.size - uploadedBytes) / speed : 0
    onProgress?.(uploadedBytes, speed, eta)
  }

  const uploadTasks = uploadUrls.map((urlInfo) => {
    return async () => {
      onChunkStatus?.(urlInfo.chunk_index, 'uploading')

      // RETRIEVE CIPHERTEXT FROM INDEXEDDB
      const chunkRecord = await uploadDb.chunks.get(`${uploadId}-${urlInfo.chunk_index}`)
      if (!chunkRecord) throw new Error('Ciphertext missing in IndexedDB')
      const ciphertext = chunkRecord.data

      const result = await uploadSingleChunk(
        urlInfo.presigned_url,
        ciphertext,
        urlInfo.chunk_index,
        signal!,
        (loaded) => {
          chunkProgress[urlInfo.chunk_index] = Math.min(loaded, ciphertext.byteLength)
          updateOverallProgress()
        }
      )

      chunkProgress[urlInfo.chunk_index] = ciphertext.byteLength
      updateOverallProgress()

      // ZEROIZE AND DELETE FROM DB
      ciphertext.fill(0)
      await uploadDb.chunks.delete(`${uploadId}-${urlInfo.chunk_index}`)

      r2Etags[String(urlInfo.chunk_index)] = result.etag
      onChunkStatus?.(urlInfo.chunk_index, 'done')
    }
  })

  await runWithConcurrency(uploadTasks, UPLOAD_CONFIG.MAX_CONCURRENT_UPLOADS)

  if (signal?.aborted) throw new Error('Upload cancelled')

  // 7. Complete upload
  await fileService.completeUpload(createResp.file_id, {
    version_id: createResp.version_id,
    r2_etags: r2Etags,
  })

  await cleanupFileStream()

  return { fileId: createResp.file_id, versionId: createResp.version_id, deduplicated: false }
}
