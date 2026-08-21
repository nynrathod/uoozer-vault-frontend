import { ZipWriter, BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js'
import { fileService } from './fileService'
import { folderService } from '@services/folders/folderService'
import {
  initFileDecryption,
  decryptFileChunk,
  cleanupFileStream,
  decryptMetadataObject,
  base64ToBytes,
  blake3HashBytes,
} from '@lib/crypto'
import { uploadDb } from '@services/upload/uploadDatabase'
import type { DownloadManifest, DownloadChunkInfo } from '@/types/files'

export interface DownloadOptions {
  dek: Uint8Array
  fileId: string
  versionId?: string
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
  onChunkProgress?: (chunkIndex: number, loaded: number, total: number) => void
  signal?: AbortSignal
}

export interface DownloadResult {
  blob: Blob
  totalSize: number
}

export class DownloadError extends Error {
  readonly code:
    | 'VAULT_LOCKED'
    | 'FILE_NOT_FOUND'
    | 'MISSING_CHUNKS'
    | 'CHUNK_CORRUPTED'
    | 'DECRYPTION_FAILED'
    | 'TAMPER_DETECTED'
    | 'NETWORK_ERROR'
    | 'CANCELLED'

  constructor(code: DownloadError['code'], message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'DownloadError'
    this.code = code
    if (options?.cause) (this as any).cause = options.cause
  }
}

const MAX_CONCURRENT_DOWNLOADS = 4
let activeDownloads = 0

async function acquireDownloadSlot(signal: AbortSignal): Promise<void> {
  while (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    if (signal.aborted) throw new DownloadError('CANCELLED', 'Download cancelled')
    await new Promise((r) => setTimeout(r, 100))
  }
  activeDownloads++
}

function releaseDownloadSlot(): void {
  activeDownloads = Math.max(0, activeDownloads - 1)
}

async function fetchChunkWithResume(
  url: string,
  signal: AbortSignal,
  expectedSize: number,
  onProgress?: (loaded: number) => void
): Promise<Uint8Array> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal.aborted) throw new DownloadError('CANCELLED', 'Download cancelled')

    try {
      const response = await fetch(url, { signal })
      if (!response.ok) {
        if (response.status === 404) {
          throw new DownloadError(
            'MISSING_CHUNKS',
            `Chunk not found in storage (${response.status})`
          )
        }
        throw new DownloadError('NETWORK_ERROR', `R2 download failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        const buffer = await response.arrayBuffer()
        return new Uint8Array(buffer)
      }

      const chunks: Uint8Array[] = []
      let received = 0
      while (true) {
        if (signal.aborted) {
          reader.cancel().catch(() => {})
          throw new DownloadError('CANCELLED', 'Download cancelled')
        }
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.byteLength
          onProgress?.(received)
        }
      }

      const merged = new Uint8Array(received)
      let offset = 0
      for (const c of chunks) {
        merged.set(c, offset)
        offset += c.byteLength
      }
      return merged
    } catch (error) {
      if (error instanceof DownloadError) throw error
      lastError = error as Error
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }

  throw new DownloadError('NETWORK_ERROR', `Chunk download failed: ${lastError?.message}`)
}

export async function downloadFile(options: DownloadOptions): Promise<DownloadResult> {
  const { dek, fileId, versionId, onProgress, onChunkProgress, signal } = options

  if (!dek || dek.length === 0) {
    throw new DownloadError('VAULT_LOCKED', 'Vault is locked. Please unlock to download.')
  }

  const controller = new AbortController()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  await acquireDownloadSlot(controller.signal)
  try {
    let manifest: DownloadManifest
    try {
      manifest = await fileService.getDownloadManifest(fileId, versionId)
    } catch (error: any) {
      if (error?.code === 'NOT_FOUND') {
        throw new DownloadError('FILE_NOT_FOUND', 'This file no longer exists.')
      }
      throw new DownloadError('NETWORK_ERROR', 'Failed to fetch download manifest.', {
        cause: error,
      })
    }

    if (manifest.chunks.length === 0) {
      throw new DownloadError('MISSING_CHUNKS', 'File has no chunks.')
    }

    const missingChunks: number[] = []
    for (const chunk of manifest.chunks) {
      if (!chunk.presigned_url) missingChunks.push(chunk.chunk_index)
    }
    if (missingChunks.length > 0) {
      throw new DownloadError(
        'MISSING_CHUNKS',
        `File is incomplete. Missing chunks: ${missingChunks.join(', ')}`
      )
    }

    const header = await base64ToBytes(manifest.encryption_header)
    const streamId = await initFileDecryption(header, dek)

    const decryptedChunks: Uint8Array[] = []
    let downloadedBytes = 0
    const totalBytes = manifest.total_size

    for (const chunkInfo of manifest.chunks) {
      if (controller.signal.aborted) {
        await cleanupFileStream(streamId)
        throw new DownloadError('CANCELLED', 'Download cancelled')
      }

      let ciphertext: Uint8Array
      try {
        ciphertext = await fetchChunkWithResume(
          chunkInfo.presigned_url,
          controller.signal,
          chunkInfo.chunk_size,
          (loaded) => onChunkProgress?.(chunkInfo.chunk_index, loaded, chunkInfo.chunk_size)
        )
      } catch (error) {
        await cleanupFileStream(streamId)
        if (error instanceof DownloadError) throw error
        throw new DownloadError(
          'NETWORK_ERROR',
          `Failed to download chunk ${chunkInfo.chunk_index}`,
          {
            cause: error,
          }
        )
      }

      const computedHash = await blake3HashBytes(ciphertext)
      const expectedHashB64 = (chunkInfo as any).chunk_blake3
      if (expectedHashB64) {
        const expectedHash = await base64ToBytes(expectedHashB64)
        const computedHex = Array.from(computedHash)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        const expectedHex = Array.from(expectedHash)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        if (computedHex !== expectedHex) {
          await cleanupFileStream(streamId)
          throw new DownloadError(
            'CHUNK_CORRUPTED',
            `Chunk ${chunkInfo.chunk_index} is corrupted (hash mismatch)`
          )
        }
      }

      let plaintext: Uint8Array
      try {
        plaintext = await decryptFileChunk(streamId, ciphertext)
      } catch (error) {
        await cleanupFileStream(streamId)
        throw new DownloadError(
          'DECRYPTION_FAILED',
          `Failed to decrypt chunk ${chunkInfo.chunk_index}. File may be tampered.`,
          { cause: error }
        )
      }

      decryptedChunks.push(plaintext)
      downloadedBytes += chunkInfo.chunk_size
      onProgress?.(downloadedBytes, totalBytes)
    }

    await cleanupFileStream(streamId)
    return { blob: new Blob(decryptedChunks as BlobPart[]), totalSize: totalBytes }
  } finally {
    releaseDownloadSlot()
  }
}

export async function downloadFileToDisk(
  fileName: string,
  options: DownloadOptions
): Promise<void> {
  if (!options.dek || options.dek.length === 0) {
    throw new DownloadError('VAULT_LOCKED', 'Vault is locked. Please unlock to download.')
  }

  try {
    const { blob } = await downloadFile(options)
    triggerBrowserDownload(fileName, blob)
  } catch (error) {
    if (error instanceof DownloadError && error.code === 'CANCELLED') return
    throw error
  }
}

export async function downloadFileToPath(
  fileName: string,
  options: DownloadOptions
): Promise<void> {
  if (!('showSaveFilePicker' in window)) {
    return downloadFileToDisk(fileName, options)
  }

  const extension = fileName.split('.').pop() || ''
  const handle = await (window as any).showSaveFilePicker({
    suggestedName: fileName,
    types: extension
      ? [{ description: 'File', accept: { 'application/octet-stream': ['.' + extension] } }]
      : undefined,
  })

  const writable = await handle.createWritable()
  try {
    const { blob } = await downloadFile(options)
    await writable.write(blob)
  } finally {
    await writable.close()
  }
}

export async function downloadFolderAsZip(
  folderId: string,
  folderName: string,
  dek: Uint8Array,
  signal?: AbortSignal
): Promise<void> {
  if (!dek || dek.length === 0) {
    throw new DownloadError('VAULT_LOCKED', 'Vault is locked. Please unlock to download.')
  }

  async function addFolderContents(
    currentFolderId: string | null,
    zipWriter: ZipWriter<Blob>,
    basePath: string
  ): Promise<void> {
    if (signal?.aborted) throw new DownloadError('CANCELLED', 'Download cancelled')

    const filesRes = await fileService.list(currentFolderId)
    for (const backendFile of filesRes.files) {
      if (signal?.aborted) throw new DownloadError('CANCELLED', 'Download cancelled')

      const metadata = await decryptMetadataObject<{ name: string }>(
        backendFile.encrypted_metadata,
        backendFile.metadata_nonce,
        dek
      )
      const fileName = sanitizeZipPath(metadata?.name || 'Unnamed File')

      const { blob } = await downloadFile({ dek, fileId: backendFile.file_id, signal })
      const fullPath = basePath ? `${basePath}/${fileName}` : fileName
      await zipWriter.add(fullPath, new BlobReader(blob))
    }

    const foldersRes = await folderService.list(currentFolderId)
    for (const backendFolder of foldersRes) {
      if (signal?.aborted) throw new DownloadError('CANCELLED', 'Download cancelled')

      const folderMetadata = await decryptMetadataObject<{ name: string }>(
        backendFolder.encrypted_metadata,
        backendFolder.metadata_nonce,
        dek
      )
      const subFolderName = sanitizeZipPath(folderMetadata?.name || 'Unnamed Folder')
      const newBasePath = basePath ? `${basePath}/${subFolderName}` : subFolderName
      await addFolderContents(backendFolder.folder_id, zipWriter, newBasePath)
    }
  }

  const zipWriter = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: true })
  try {
    await addFolderContents(folderId, zipWriter, '')
    const zipBlob = await zipWriter.close()
    triggerBrowserDownload(`${folderName}.zip`, zipBlob)
  } catch (error) {
    await zipWriter.close().catch(() => {})
    throw error
  }
}

function sanitizeZipPath(name: string): string {
  return name.replace(/\.\./g, '_').replace(/[\\]/g, '/').replace(/^\/+/, '')
}

function triggerBrowserDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function verifyZipIntegrity(fileId: string, dek: Uint8Array): Promise<boolean> {
  try {
    const { blob } = await downloadFile({ dek, fileId })
    const reader = new ZipReader(new BlobReader(blob))
    const entries = await reader.getEntries()
    for (const entry of entries) {
      if (entry.filename.includes('..') || entry.filename.startsWith('/')) {
        await reader.close()
        return false
      }
    }
    await reader.close()
    return true
  } catch {
    return false
  }
}
