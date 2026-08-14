/**
 * Upload Orchestrator
 *
 * Handles the full zero-knowledge chunked upload flow:
 * 1. Validate file
 * 2. Encrypt metadata (filename, mime type) with DEK
 * 3. Hash plaintext file with BLAKE3
 * 4. Initialize secretstream encryption
 * 5. Encrypt each chunk sequentially, hash ciphertext with BLAKE3
 * 6. Send create-file request with chunk plan → get presigned URLs
 * 7. Upload encrypted chunks to R2 in parallel (concurrency-limited)
 * 8. Complete upload (verify all chunks, activate version)
 *
 * Encryption is sequential (secretstream requirement), upload is parallel.
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
import { validateFile, sanitizeFileName, detectMimeType, CHUNK_SIZE } from '@lib/fileValidation'
import type { CreateFileRequest, ChunkPlan, ChunkUploadUrl } from '@/types/files'
import type { UploadChunk } from '@/types/upload'

/** Concurrency for parallel chunk uploads to R2. */
const MAX_CONCURRENT_UPLOADS = 6

/** Maximum retry attempts per chunk. */
const MAX_RETRIES = 3

/** Retry delay in milliseconds (exponential backoff). */
const RETRY_BASE_DELAY = 1000

export interface UploadProgressCallback {
  (uploadId: string, chunkIndex: number, progress: number): void
}

export interface UploadOptions {
  dek: Uint8Array
  folderId: string | null
  onProgress?: UploadProgressCallback
  onChunkStatus?: (uploadId: string, chunkIndex: number, status: UploadChunk['status']) => void
  signal?: AbortSignal
}

export interface UploadResult {
  fileId: string
  versionId: string
  deduplicated: boolean
}

/** Reads a slice of a File as Uint8Array. */
async function readFileChunk(file: File, start: number, end: number): Promise<Uint8Array> {
  const slice = file.slice(start, end)
  const buffer = await slice.arrayBuffer()
  return new Uint8Array(buffer)
}

/** Sleep helper for retry backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Encrypts all chunks of a file sequentially and returns their ciphertext + hashes.
 * Uses crypto_secretstream_xchacha20poly1305 for tamper-evident streaming encryption.
 */
async function encryptFileChunks(
  file: File,
  dek: Uint8Array,
  onChunkEncrypted?: (index: number, ciphertextSize: number) => void
): Promise<{
  header: Uint8Array
  chunks: Array<{ ciphertext: Uint8Array; blake3Hash: Uint8Array; chunkIndex: number }>
  plaintextBlake3: Uint8Array
}> {
  const header = await initFileEncryption(dek)
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const encryptedChunks: Array<{
    ciphertext: Uint8Array
    blake3Hash: Uint8Array
    chunkIndex: number
  }> = []

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const plaintext = await readFileChunk(file, start, end)
    const isFinal = i === totalChunks - 1

    // Destructure the new return value
    const { ciphertext, blake3Hash } = await encryptFileChunk(plaintext, isFinal)

    encryptedChunks.push({ ciphertext, blake3Hash, chunkIndex: i })
    onChunkEncrypted?.(i, ciphertext.byteLength)
  }

  // Hash the full plaintext file with BLAKE3 (for same-user dedup)
  const fullFileBuffer = await file.arrayBuffer()
  const plaintextBlake3 = await blake3HashBytes(new Uint8Array(fullFileBuffer))

  await cleanupFileStream()

  return { header, chunks: encryptedChunks, plaintextBlake3 }
}

/** Uploads a single chunk to R2 with retry logic. */
async function uploadSingleChunk(
  presignedUrl: string,
  ciphertext: Uint8Array,
  chunkIndex: number,
  signal?: AbortSignal
): Promise<{ etag: string }> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error('Upload cancelled')

    try {
      const result = await fileService.uploadChunkToR2(presignedUrl, ciphertext)
      return result
    } catch (error: any) {
      lastError = error
      // Exponential backoff: 1s, 2s, 4s
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt)
      await sleep(delay)
    }
  }

  throw new Error(`Chunk ${chunkIndex} failed after ${MAX_RETRIES} attempts: ${lastError?.message}`)
}

/** Runs async tasks with a concurrency limit. */
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
 * Orchestrates the full upload flow for a single file.
 * Throws on validation failure, crypto failure, or unrecoverable upload failure.
 */
export async function uploadFile(file: File, options: UploadOptions): Promise<UploadResult> {
  const { dek, folderId, onProgress, onChunkStatus, signal } = options

  // ── 1. Validate ─────────────────────────────────────────────
  const validation = validateFile(file)
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join('; ')}`)
  }

  const sanitizedName = sanitizeFileName(file.name)
  const mimeType = detectMimeType(file)

  // ── 2. Encrypt metadata ─────────────────────────────────────
  const { encryptedMetadata, metadataNonce } = await encryptMetadataObject(
    { name: sanitizedName, mimeType, size: file.size },
    dek
  )

  const {
    header,
    chunks: encryptedChunks,
    plaintextBlake3,
  } = await encryptFileChunks(file, dek, (index, ciphertextSize) => {
    onProgress?.(file.name, index, 0) // Encryption done, upload not started
  })

  if (signal?.aborted) throw new Error('Upload cancelled')

  // ── 4. Build chunk plan for backend ─────────────────────────
  const chunkPlans: ChunkPlan[] = encryptedChunks.map((chunk) => ({
    chunk_index: chunk.chunkIndex,
    segment_index: 0, // POC: single segment per upload session
    chunk_size: chunk.ciphertext.byteLength, // Ciphertext size (includes 17-byte overhead)
    chunk_blake3: '', // Filled below
  }))

  // Convert all BLAKE3 hashes to base64 for the API
  const chunkBlake3B64: string[] = []
  for (const chunk of encryptedChunks) {
    chunkBlake3B64.push(await bytesToBase64(chunk.blake3Hash))
  }
  chunkPlans.forEach((plan, i) => {
    plan.chunk_blake3 = chunkBlake3B64[i]
  })

  const plaintextBlake3B64 = await bytesToBase64(plaintextBlake3)
  const encryptionHeaderB64 = await bytesToBase64(header)

  // ── 5. Create file on backend (get presigned URLs) ──────────
  const createReq: CreateFileRequest = {
    folder_id: folderId,
    encrypted_metadata: encryptedMetadata,
    metadata_nonce: metadataNonce,
    plaintext_blake3: plaintextBlake3B64,
    total_size: file.size,
    total_chunks: encryptedChunks.length,
    encryption_header: encryptionHeaderB64,
    chunks: chunkPlans,
  }

  const createResp = await fileService.createFile(createReq)

  // ── 6. Handle dedup hit ─────────────────────────────────────
  if (createResp.deduplicated) {
    await cleanupFileStream()
    return {
      fileId: createResp.file_id,
      versionId: createResp.version_id,
      deduplicated: true,
    }
  }

  // ── 7. Upload chunks to R2 in parallel ──────────────────────
  const uploadUrls = createResp.upload_urls
  const r2Etags: Record<string, string> = {}

  // Build upload tasks (skip already-uploaded chunks)
  const uploadTasks = uploadUrls
    .filter((urlInfo: ChunkUploadUrl) => !urlInfo.already_uploaded)
    .map((urlInfo: ChunkUploadUrl) => {
      const chunk = encryptedChunks[urlInfo.chunk_index]
      onChunkStatus?.(file.name, urlInfo.chunk_index, 'uploading')

      return async () => {
        const result = await uploadSingleChunk(
          urlInfo.presigned_url,
          chunk.ciphertext,
          urlInfo.chunk_index,
          signal
        )
        r2Etags[String(urlInfo.chunk_index)] = result.etag
        onChunkStatus?.(file.name, urlInfo.chunk_index, 'done')
        onProgress?.(file.name, urlInfo.chunk_index, 100)
      }
    })

  // Also mark already-uploaded chunks as done
  uploadUrls.forEach((urlInfo: ChunkUploadUrl) => {
    if (urlInfo.already_uploaded) {
      r2Etags[String(urlInfo.chunk_index)] = '' // ETag already stored server-side
      onChunkStatus?.(file.name, urlInfo.chunk_index, 'done')
      onProgress?.(file.name, urlInfo.chunk_index, 100)
    }
  })

  await runWithConcurrency(uploadTasks, MAX_CONCURRENT_UPLOADS)

  if (signal?.aborted) throw new Error('Upload cancelled')

  // ── 8. Complete upload ──────────────────────────────────────
  await fileService.completeUpload(createResp.file_id, {
    version_id: createResp.version_id,
    r2_etags: r2Etags,
  })

  // ── 9. Cleanup ──────────────────────────────────────────────
  // Zeroize encrypted chunk buffers (they're no longer needed)
  for (const chunk of encryptedChunks) {
    chunk.ciphertext.fill(0)
    chunk.blake3Hash.fill(0)
  }

  return {
    fileId: createResp.file_id,
    versionId: createResp.version_id,
    deduplicated: false,
  }
}

/**
 * Resumes a partially-uploaded file.
 * Fetches resume info from backend, uploads only missing chunks.
 */
export async function resumeUpload(
  versionId: string,
  file: File,
  dek: Uint8Array,
  options: UploadOptions
): Promise<UploadResult> {
  const { onProgress, onChunkStatus, signal } = options

  // Get resume info from backend
  const resumeInfo = await fileService.getResumeInfo(versionId)

  if (!resumeInfo.upload_urls || resumeInfo.missing_chunks.length === 0) {
    // All chunks uploaded — just complete
    const manifest = await fileService.getDownloadManifest(
      // We need the file_id — it should be passed in or fetched
      '', // This would need to be provided
      versionId
    )
    return {
      fileId: manifest.file_id,
      versionId,
      deduplicated: false,
    }
  }

  // Re-encrypt all chunks (secretstream requires sequential encryption from start)
  const { header, chunks: encryptedChunks } = await encryptFileChunks(file, dek)

  // Upload only missing chunks
  const r2Etags: Record<string, string> = {}
  const uploadTasks = resumeInfo.upload_urls.map((urlInfo: ChunkUploadUrl) => {
    const chunk = encryptedChunks[urlInfo.chunk_index]
    onChunkStatus?.(file.name, urlInfo.chunk_index, 'uploading')

    return async () => {
      const result = await uploadSingleChunk(
        urlInfo.presigned_url,
        chunk.ciphertext,
        urlInfo.chunk_index,
        signal
      )
      r2Etags[String(urlInfo.chunk_index)] = result.etag
      onChunkStatus?.(file.name, urlInfo.chunk_index, 'done')
      onProgress?.(file.name, urlInfo.chunk_index, 100)
    }
  })

  await runWithConcurrency(uploadTasks, MAX_CONCURRENT_UPLOADS)

  // Complete upload
  await fileService.completeUpload('', {
    version_id: versionId,
    r2_etags: r2Etags,
  })

  await cleanupFileStream()

  return {
    fileId: '', // Would need to be fetched
    versionId,
    deduplicated: false,
  }
}
