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
import { uploadSync } from '@services/upload/uploadSync'
import type { CreateFileRequest, ChunkPlan, ResumeInfo } from '@/types/files'
import { uploadDb, type PersistedUploadState } from '../upload/uploadDatabase'

export interface UploadProgressCallback {
  (uploadedBytes: number, speedBps: number, etaSeconds: number): void
}

export interface UploadOptions {
  dek: Uint8Array
  folderId: string | null
  onProgress?: UploadProgressCallback
  onChunkStatus?: (chunkIndex: number, status: 'uploading' | 'done' | 'error') => void
  onPersisted?: (state: PersistedUploadState) => void
  signal?: AbortSignal
  resumeState?: PersistedUploadState
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

function uploadChunkXHR(
  presignedUrl: string,
  ciphertext: Uint8Array,
  signal: AbortSignal,
  onChunkProgress: (loaded: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', presignedUrl, true)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onChunkProgress(event.loaded)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag')?.replace(/"/g, '') || ''
        if (!etag) reject(new Error('Missing ETag from R2'))
        else resolve(etag)
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

    if (signal.aborted) xhr.abort()
    else signal.addEventListener('abort', () => xhr.abort(), { once: true })

    xhr.send(ciphertext as unknown as XMLHttpRequestBodyInit)
  })
}

async function uploadSingleChunk(
  presignedUrl: string,
  ciphertext: Uint8Array,
  signal: AbortSignal,
  onChunkProgress: (loaded: number) => void
): Promise<{ etag: string }> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
    if (signal.aborted) throw new DOMException('Upload cancelled', 'AbortError')

    try {
      const etag = await uploadChunkXHR(presignedUrl, ciphertext, signal, onChunkProgress)
      return { etag }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      lastError = error as Error

      if (error instanceof Error && error.message.includes('R2 rejected chunk')) {
        throw error
      }

      const delay = Math.min(
        UPLOAD_CONFIG.RETRY_MAX_DELAY,
        UPLOAD_CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt)
      )
      await sleep(delay + Math.random() * 100)
      onChunkProgress(0)
    }
  }

  throw new Error(`Chunk failed after ${UPLOAD_CONFIG.MAX_RETRIES} attempts: ${lastError?.message}`)
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
  signal: AbortSignal
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0

  async function runNext(): Promise<void> {
    while (nextIndex < tasks.length) {
      if (signal.aborted) throw new DOMException('Upload cancelled', 'AbortError')
      const index = nextIndex++
      results[index] = await tasks[index]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext())
  await Promise.all(workers)
  return results
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
  )
}

export async function uploadFile(file: File, options: UploadOptions): Promise<UploadResult> {
  const { dek, folderId, onProgress, onChunkStatus, onPersisted, signal, resumeState } = options

  const controller = new AbortController()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  const internalSignal = controller.signal

  const validation = await validateFile(file)
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join('; ')}`)
  }

  const sanitizedName = sanitizeFileName(file.name)
  const mimeType = validation.detectedMimeType
  const totalChunks = validation.totalChunks

  const fullFileBuffer = await file.arrayBuffer()
  const plaintextBlake3Bytes = await blake3HashBytes(new Uint8Array(fullFileBuffer))
  const plaintextBlake3 = await bytesToBase64(plaintextBlake3Bytes)

  if (resumeState && resumeState.plaintextBlake3 !== plaintextBlake3) {
    throw new Error('File has been modified locally since the previous attempt')
  }

  const { encryptedMetadata, metadataNonce } = await encryptMetadataObject(
    { name: sanitizedName, mimeType, size: file.size },
    dek
  )

  let streamId: string
  let encryptionHeaderB64: string
  let chunkPlans: ChunkPlan[] = []
  let fileId: string = ''
  let versionId: string = ''
  let uploadUrls: any[] = []
  let deduplicated = false
  let alreadyUploadedChunks = new Set<number>()

  if (resumeState && resumeState.versionId && resumeState.streamId) {
    const resumeInfo: ResumeInfo = await fileService.getResumeInfo(resumeState.versionId)
    fileId = resumeState.fileId!
    versionId = resumeState.versionId
    streamId = resumeState.streamId
    encryptionHeaderB64 = resumeState.encryptionHeader
    chunkPlans = resumeState.chunkPlans
    deduplicated = false
    alreadyUploadedChunks = new Set(resumeInfo.uploaded_chunks)

    if (resumeInfo.upload_urls && resumeInfo.upload_urls.length > 0) {
      uploadUrls = resumeInfo.upload_urls
    } else {
      throw new Error('Failed to get resume URLs from server.')
    }
  } else {
    const initResult = await initFileEncryption(dek)
    streamId = initResult.streamId
    encryptionHeaderB64 = await bytesToBase64(initResult.header)
  }

  const encryptedChunks: (Uint8Array | null)[] = new Array(totalChunks).fill(null)

  for (let i = 0; i < totalChunks; i++) {
    if (internalSignal.aborted) throw new DOMException('Upload cancelled', 'AbortError')

    const start = i * UPLOAD_CONFIG.CHUNK_SIZE
    const end = Math.min(start + UPLOAD_CONFIG.CHUNK_SIZE, file.size)
    const plaintext = await readFileChunk(file, start, end)
    const isFinal = i === totalChunks - 1

    const { ciphertext, blake3Hash } = await encryptFileChunk(streamId, plaintext, isFinal)

    if (!resumeState) {
      chunkPlans.push({
        chunk_index: i,
        segment_index: 0,
        chunk_size: ciphertext.byteLength,
        chunk_blake3: await bytesToBase64(blake3Hash),
      })
    }

    if (!alreadyUploadedChunks.has(i)) {
      encryptedChunks[i] = ciphertext
    } else {
      ciphertext.fill(0)
    }
  }

  if (internalSignal.aborted) throw new DOMException('Upload cancelled', 'AbortError')

  if (!resumeState) {
    const createReq: CreateFileRequest = {
      folder_id: folderId,
      encrypted_metadata: encryptedMetadata,
      metadata_nonce: metadataNonce,
      plaintext_blake3: plaintextBlake3,
      total_size: file.size,
      total_chunks: chunkPlans.length,
      encryption_header: encryptionHeaderB64,
      chunks: chunkPlans,
    }

    const createResp = await fileService.createFile(createReq)
    fileId = createResp.file_id
    versionId = createResp.version_id
    uploadUrls = createResp.upload_urls
    deduplicated = createResp.deduplicated

    if (deduplicated) {
      await cleanupFileStream(streamId)
      return { fileId, versionId, deduplicated: true }
    }
  }

  const persistedState: PersistedUploadState = {
    uploadId: resumeState?.uploadId || crypto.randomUUID(),
    fileId,
    versionId,
    folderId,
    fileName: sanitizedName,
    fileSize: file.size,
    totalChunks,
    uploadedChunks: Array.from(alreadyUploadedChunks),
    encryptionHeader: encryptionHeaderB64,
    streamId,
    plaintextBlake3,
    chunkPlans,
    status: 'uploading',
    lastError: null,
    createdAt: resumeState?.createdAt || Date.now(),
    updatedAt: Date.now(),
  }
  await uploadDb.saveUpload(persistedState)
  uploadSync.notifyUpdate(persistedState.uploadId)
  onPersisted?.(persistedState)

  const chunkSizes: Record<number, number> = {}
  for (const plan of chunkPlans) chunkSizes[plan.chunk_index] = plan.chunk_size

  const chunkProgress: Record<number, number> = {}
  const r2Etags: Record<string, string> = {}
  for (const idx of alreadyUploadedChunks) {
    chunkProgress[idx] = chunkSizes[idx] || 0
  }

  const startTime = Date.now()
  const updateOverallProgress = () => {
    let uploadedBytes = 0
    for (const idx in chunkProgress) uploadedBytes += chunkProgress[idx]
    const elapsed = (Date.now() - startTime) / 1000
    const speed = elapsed > 0 ? uploadedBytes / elapsed : 0
    const remaining = Math.max(0, file.size - uploadedBytes)
    const eta = speed > 0 ? remaining / speed : 0
    onProgress?.(uploadedBytes, speed, eta)
  }

  const uploadTasks = uploadUrls.map((urlInfo) => {
    return async () => {
      if (alreadyUploadedChunks.has(urlInfo.chunk_index)) {
        r2Etags[String(urlInfo.chunk_index)] = 'resumed'
        return
      }
      if (internalSignal.aborted) throw new DOMException('Upload cancelled', 'AbortError')

      onChunkStatus?.(urlInfo.chunk_index, 'uploading')

      const ciphertext = encryptedChunks[urlInfo.chunk_index]
      if (!ciphertext) throw new Error('Ciphertext missing for chunk')

      const result = await uploadSingleChunk(
        urlInfo.presigned_url,
        ciphertext,
        internalSignal,
        (loaded) => {
          chunkProgress[urlInfo.chunk_index] = Math.min(loaded, chunkSizes[urlInfo.chunk_index])
          updateOverallProgress()
        }
      )

      chunkProgress[urlInfo.chunk_index] = chunkSizes[urlInfo.chunk_index]
      updateOverallProgress()

      ciphertext.fill(0)
      encryptedChunks[urlInfo.chunk_index] = null

      r2Etags[String(urlInfo.chunk_index)] = result.etag
      alreadyUploadedChunks.add(urlInfo.chunk_index)

      await uploadDb.appendUploadedChunk(persistedState.uploadId, urlInfo.chunk_index)
      uploadSync.notifyUpdate(persistedState.uploadId)

      onChunkStatus?.(urlInfo.chunk_index, 'done')
    }
  })

  try {
    await runWithConcurrency(uploadTasks, UPLOAD_CONFIG.MAX_CONCURRENT_UPLOADS, internalSignal)
  } catch (error) {
    if (isAbortError(error)) {
      await uploadDb.patchUpload(persistedState.uploadId, {
        status: 'paused',
        uploadedChunks: Array.from(alreadyUploadedChunks),
      })
      uploadSync.notifyUpdate(persistedState.uploadId)
    } else {
      await uploadDb.patchUpload(persistedState.uploadId, {
        status: 'error',
        lastError: (error as Error).message,
        uploadedChunks: Array.from(alreadyUploadedChunks),
      })
    }
    await cleanupFileStream(streamId)
    throw error
  }

  if (internalSignal.aborted) throw new DOMException('Upload cancelled', 'AbortError')

  await fileService.completeUpload(fileId, {
    version_id: versionId,
    r2_etags: r2Etags,
  })

  await cleanupFileStream(streamId)
  await uploadDb.patchUpload(persistedState.uploadId, { status: 'done' })
  uploadSync.notifyUpdate(persistedState.uploadId)

  return { fileId, versionId, deduplicated: false }
}

export async function cancelUpload(fileId: string, versionId: string): Promise<void> {
  try {
    await fileService.cancelUpload(fileId, versionId)
  } catch (error) {
    console.warn('Server-side cancel failed, continuing with local cleanup', error)
  }
  const persisted = await uploadDb.getByVersionId(versionId)
  if (persisted) {
    if (persisted.streamId) {
      await cleanupFileStream(persisted.streamId)
    }
    await uploadDb.patchUpload(persisted.uploadId, { status: 'cancelled' })
    uploadSync.notifyRemove(persisted.uploadId)
  }
}
