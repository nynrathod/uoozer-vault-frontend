import { fileService } from './fileService'
import {
  initFileEncryption,
  encryptFileChunk,
  encryptMetadataObject,
  bytesToBase64,
  cleanupFileStream,
  generateDek,
  wrapDek,
  base64ToBytes,
  unwrapDek,
} from '@lib/crypto'
import { validateFile, sanitizeFileName } from '@lib/fileValidation'
import { UPLOAD_CONFIG } from '@config/upload.config'
import { uploadSync } from '@services/upload/uploadSync'
import type { CreateFileRequest, ChunkPlan, ResumeInfo, CreateFileResponse } from '@/types/files'
import { uploadDb, type PersistedUploadState } from '../upload/uploadDatabase'
import { createBLAKE3 } from 'hash-wasm'
import { PLAINTEXT_CHUNK_BYTES } from '@lib/chunk-constants'
import { apiClient } from '../api/client'

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
  preInitData?: CreateFileResponse
}

export interface UploadResult {
  fileId: string
  versionId: string
  deduplicated: boolean
  r2Etags: Record<string, string>
  plaintextBlake3: string
  encryptionHeader: string
  chunkHashes: Record<string, string>
  wrappedFileKey: string
  wrappedFileKeyNonce: string
}

async function readFileChunk(file: File, start: number, end: number): Promise<Uint8Array> {
  if (start > file.size) {
    throw new Error('File modified or truncated during upload.')
  }
  const adjustedEnd = Math.min(end, file.size)
  const slice = file.slice(start, adjustedEnd)
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
    xhr.timeout = UPLOAD_CONFIG.CHUNK_UPLOAD_TIMEOUT

    let lastProgressTime = Date.now()
    const stallChecker = setInterval(() => {
      if (Date.now() - lastProgressTime > UPLOAD_CONFIG.STALL_TIMEOUT) {
        clearInterval(stallChecker)
        xhr.abort()
        reject(new Error('Chunk upload stalled.'))
      }
    }, 5000)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        lastProgressTime = Date.now()
        onChunkProgress(event.loaded)
      }
    }

    xhr.onload = () => {
      clearInterval(stallChecker)
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag')?.replace(/"/g, '') || ''
        if (!etag) reject(new Error('Missing ETag from R2'))
        else resolve(etag)
      } else if (xhr.status === 429) {
        const retryAfter = xhr.getResponseHeader('Retry-After')
        reject(new Error(`429:${retryAfter || 0}`))
      } else if (xhr.status >= 400 && xhr.status < 500) {
        reject(new Error(`R2 rejected chunk (${xhr.status})`))
      } else {
        reject(new Error(`R2 error: ${xhr.status}`))
      }
    }

    xhr.onerror = () => {
      clearInterval(stallChecker)
      reject(new Error('Network error during chunk upload'))
    }

    xhr.ontimeout = () => {
      clearInterval(stallChecker)
      reject(new Error('Chunk upload timed out'))
    }

    xhr.onabort = () => {
      clearInterval(stallChecker)
      reject(new DOMException('Upload aborted', 'AbortError'))
    }

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

      if (error instanceof Error && error.message.startsWith('429:')) {
        const retryAfter = parseInt(error.message.split(':')[1], 10)
        const delay =
          retryAfter > 0
            ? retryAfter * 1000
            : Math.min(
                UPLOAD_CONFIG.RETRY_MAX_DELAY,
                UPLOAD_CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt)
              )
        await sleep(delay)
      } else {
        const delay = Math.min(
          UPLOAD_CONFIG.RETRY_MAX_DELAY,
          UPLOAD_CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt)
        )
        await sleep(delay + Math.random() * 100)
      }
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
  const {
    dek,
    folderId,
    onProgress,
    onChunkStatus,
    onPersisted,
    signal,
    resumeState,
    preInitData,
  } = options

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

  let wrappedFileKeyB64 = ''
  let wrappedFileKeyNonceB64 = ''

  if (resumeState && resumeState.versionId) {
    const resumeInfo: ResumeInfo = await fileService.getResumeInfo(resumeState.versionId)
    fileId = resumeState.fileId!
    versionId = resumeState.versionId
    deduplicated = false
    alreadyUploadedChunks = new Set(resumeInfo.uploaded_chunks)
    chunkPlans = resumeState.chunkPlans

    const { data: versionData } = await apiClient.get(
      `/api/v1/files/${fileId}/versions/${versionId}`
    )
    const wrappedFileKey = {
      ciphertext: await base64ToBytes(versionData.wrapped_file_key),
      nonce: await base64ToBytes(versionData.wrapped_file_key_nonce),
    }
    const fileKey = await unwrapDek(wrappedFileKey, dek)
    if (!fileKey) throw new Error('Failed to unwrap file key for resume.')

    const initResult = await initFileEncryption(fileKey)
    streamId = initResult.streamId
    encryptionHeaderB64 = await bytesToBase64(initResult.header)

    const newSegmentIndex = resumeState.chunkPlans[0]?.segment_index
      ? resumeState.chunkPlans[0].segment_index + 1
      : 1
    chunkPlans = chunkPlans.map((plan) => ({
      ...plan,
      segment_index: alreadyUploadedChunks.has(plan.chunk_index)
        ? plan.segment_index
        : newSegmentIndex,
    }))

    if (resumeInfo.upload_urls && resumeInfo.upload_urls.length > 0) {
      uploadUrls = resumeInfo.upload_urls
    } else {
      throw new Error('Failed to get resume URLs from server.')
    }
  } else if (preInitData) {
    fileId = preInitData.file_id
    versionId = preInitData.version_id
    uploadUrls = preInitData.upload_urls
    deduplicated = preInitData.deduplicated

    const fileKey = await generateDek()
    const initResult = await initFileEncryption(fileKey)
    streamId = initResult.streamId
    encryptionHeaderB64 = await bytesToBase64(initResult.header)

    const wrappedFileKey = await wrapDek(fileKey, dek)
    wrappedFileKeyB64 = await bytesToBase64(wrappedFileKey.ciphertext)
    wrappedFileKeyNonceB64 = await bytesToBase64(wrappedFileKey.nonce)

    if (deduplicated) {
      await cleanupFileStream(streamId)
      return {
        fileId,
        versionId,
        deduplicated: true,
        r2Etags: {},
        plaintextBlake3: '',
        encryptionHeader: '',
        chunkHashes: {},
        wrappedFileKey: '',
        wrappedFileKeyNonce: '',
      }
    }
  } else {
    const fileKey = await generateDek()
    const initResult = await initFileEncryption(fileKey)
    streamId = initResult.streamId
    encryptionHeaderB64 = await bytesToBase64(initResult.header)

    const wrappedFileKey = await wrapDek(fileKey, dek)
    wrappedFileKeyB64 = await bytesToBase64(wrappedFileKey.ciphertext)
    wrappedFileKeyNonceB64 = await bytesToBase64(wrappedFileKey.nonce)
  }

  const encryptedChunks: (Uint8Array | null)[] = new Array(totalChunks).fill(null)

  const hasher = await createBLAKE3()
  const chunkHashesMap: Record<string, string> = {}

  for (let i = 0; i < totalChunks; i++) {
    if (internalSignal.aborted) throw new DOMException('Upload cancelled', 'AbortError')

    const start = i * PLAINTEXT_CHUNK_BYTES
    const end = start + PLAINTEXT_CHUNK_BYTES
    const plaintext = await readFileChunk(file, start, end)
    const isFinal = i === totalChunks - 1

    hasher.update(plaintext)

    const { ciphertext, blake3Hash } = await encryptFileChunk(streamId, plaintext, isFinal)
    const chunkHashB64 = await bytesToBase64(blake3Hash)
    chunkHashesMap[String(i)] = chunkHashB64
    if (ciphertext.byteLength <= plaintext.byteLength) {
      throw new Error(
        `Chunk ${i} encryption invariant violated: ` +
          `ciphertext (${ciphertext.byteLength} B) must be larger than ` +
          `plaintext (${plaintext.byteLength} B). Refusing to upload.`
      )
    }

    if (!resumeState) {
      chunkPlans.push({
        chunk_index: i,
        segment_index: 0,
        chunk_size: ciphertext.byteLength,
        chunk_blake3: chunkHashB64,
      })
    }

    if (!alreadyUploadedChunks.has(i)) {
      encryptedChunks[i] = ciphertext
    } else {
      ciphertext.fill(0)
    }
  }

  const plaintextBlake3 = await bytesToBase64(new Uint8Array(hasher.digest('binary')))

  if (internalSignal.aborted) throw new DOMException('Upload cancelled', 'AbortError')

  if (!resumeState && !preInitData) {
    const createReq: CreateFileRequest = {
      folder_id: folderId,
      encrypted_metadata: encryptedMetadata,
      metadata_nonce: metadataNonce,
      plaintext_blake3: plaintextBlake3,
      total_size: file.size,
      total_chunks: chunkPlans.length,
      encryption_header: encryptionHeaderB64,
      chunks: chunkPlans,
      wrapped_file_key: wrappedFileKeyB64,
      wrapped_file_key_nonce: wrappedFileKeyNonceB64,
    }

    const createResp = await fileService.createFile(createReq)
    fileId = createResp.file_id
    versionId = createResp.version_id
    uploadUrls = createResp.upload_urls
    deduplicated = createResp.deduplicated

    if (deduplicated) {
      await cleanupFileStream(streamId)
      return {
        fileId: createResp.file_id,
        versionId: createResp.version_id,
        deduplicated: true,
        r2Etags: {},
        plaintextBlake3: '',
        encryptionHeader: '',
        chunkHashes: {},
        wrappedFileKey: wrappedFileKeyB64,
        wrappedFileKeyNonce: wrappedFileKeyNonceB64,
      }
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

  await cleanupFileStream(streamId)
  await uploadDb.patchUpload(persistedState.uploadId, { status: 'done' })
  uploadSync.notifyUpdate(persistedState.uploadId)

  return {
    fileId,
    versionId,
    deduplicated: false,
    r2Etags,
    plaintextBlake3,
    encryptionHeader: encryptionHeaderB64,
    chunkHashes: chunkHashesMap,
    wrappedFileKey: wrappedFileKeyB64,
    wrappedFileKeyNonce: wrappedFileKeyNonceB64,
  }
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
