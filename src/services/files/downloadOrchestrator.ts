import { ZipWriter, BlobWriter, BlobReader } from '@zip.js/zip.js'
import { fileService } from './fileService'
import { folderService } from '@services/folders/folderService'
import {
  initFileDecryption,
  decryptFileChunk,
  cleanupFileStream,
  decryptMetadataObject,
  base64ToBytes,
  unwrapDek,
} from '@lib/crypto'
import type { DownloadManifest } from '@/types/files'
import { apiClient } from '../api/client'

export interface DownloadOptions {
  dek: Uint8Array
  fileId: string
  versionId?: string
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
  signal?: AbortSignal
}

export class DownloadError extends Error {
  readonly code:
    | 'VAULT_LOCKED'
    | 'FILE_NOT_FOUND'
    | 'MISSING_CHUNKS'
    | 'CHUNK_CORRUPTED'
    | 'DECRYPTION_FAILED'
    | 'NETWORK_ERROR'
    | 'CANCELLED'

  constructor(code: DownloadError['code'], message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'DownloadError'
    this.code = code
    if (options?.cause) (this as any).cause = options.cause
  }
}

function verifyChunkSize(
  chunkIndex: number,
  ciphertext: Uint8Array,
  expectedEncryptedSize: number | undefined
): void {
  if (expectedEncryptedSize === undefined || expectedEncryptedSize === null) {
    return
  }

  if (ciphertext.length !== expectedEncryptedSize) {
    throw new DownloadError(
      'CHUNK_CORRUPTED',
      `Chunk ${chunkIndex} size mismatch! Expected ${expectedEncryptedSize}, got ${ciphertext.length}.`
    )
  }
}

export async function downloadFile(options: DownloadOptions): Promise<Blob> {
  const { dek, fileId, versionId, onProgress, signal } = options

  if (!dek || dek.length === 0) {
    throw new DownloadError('VAULT_LOCKED', 'Vault is locked. Please unlock to download.')
  }

  const controller = new AbortController()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let manifest: DownloadManifest
  try {
    manifest = await fileService.getDownloadManifest(fileId, versionId)
  } catch (error: any) {
    if (error?.code === 'NOT_FOUND')
      throw new DownloadError('FILE_NOT_FOUND', 'This file no longer exists.')
    throw new DownloadError('NETWORK_ERROR', 'Failed to fetch download manifest.', { cause: error })
  }

  if (manifest.chunks.length === 0) throw new DownloadError('MISSING_CHUNKS', 'File has no chunks.')

  if (!manifest.wrapped_file_key || !manifest.wrapped_file_key_nonce) {
    throw new DownloadError('DECRYPTION_FAILED', 'Missing file key in manifest.')
  }

  const wrappedFileKey = {
    ciphertext: await base64ToBytes(manifest.wrapped_file_key),
    nonce: await base64ToBytes(manifest.wrapped_file_key_nonce),
  }
  const fileKey = await unwrapDek(wrappedFileKey, dek)

  if (!fileKey) throw new DownloadError('DECRYPTION_FAILED', 'Failed to unwrap file key.')

  const header = await base64ToBytes(manifest.encryption_header)
  const streamId = await initFileDecryption(header, fileKey)

  const sortedChunks = [...manifest.chunks].sort((a, b) => a.chunk_index - b.chunk_index)
  const decryptedParts: Uint8Array[] = []
  let downloadedBytes = 0
  const totalBytes = manifest.total_size

  try {
    for (const chunkInfo of sortedChunks) {
      if (signal?.aborted) {
        await cleanupFileStream(streamId)
        throw new DownloadError('CANCELLED', 'Download cancelled')
      }

      const response = await fetch(chunkInfo.presigned_url, { signal })
      if (!response.ok) {
        throw new DownloadError(
          'NETWORK_ERROR',
          `Failed to download chunk ${chunkInfo.chunk_index}`
        )
      }

      const arrayBuffer = await response.arrayBuffer()
      const ciphertext = new Uint8Array(arrayBuffer)

      verifyChunkSize(chunkInfo.chunk_index, ciphertext, chunkInfo.chunk_size)

      const plaintext = await decryptFileChunk(streamId, ciphertext)
      decryptedParts.push(plaintext)
      downloadedBytes += plaintext.byteLength
      onProgress?.(downloadedBytes, totalBytes)
    }
    await cleanupFileStream(streamId)
  } catch (error) {
    await cleanupFileStream(streamId)
    throw error
  }

  return new Blob(decryptedParts as BlobPart[], { type: 'application/octet-stream' })
}

export async function downloadFileToDisk(
  fileName: string,
  _totalSize: number,
  params: { dek: Uint8Array; fileId: string; versionId?: string }
) {
  const blob = await downloadFile(params)
  triggerBrowserDownload(fileName, blob)
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

  let zipWriter: any
  let writableStream: any | null = null

  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${folderName}.zip`,
      })
      writableStream = await handle.createWritable()
      zipWriter = new ZipWriter(writableStream, { useWebWorkers: true })
    } else {
      zipWriter = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: true })
    }

    async function addFolderContents(currentFolderId: string | null, basePath: string) {
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
        const fullPath = basePath ? `${basePath}/${fileName}` : fileName

        const blob = await downloadFile({ dek, fileId: backendFile.file_id, signal })
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
        await addFolderContents(
          backendFolder.folder_id,
          basePath ? `${basePath}/${subFolderName}` : subFolderName
        )
      }
    }

    await addFolderContents(folderId, '')

    const zipBlob = await zipWriter.close()

    if (!writableStream && zipBlob) {
      triggerBrowserDownload(`${folderName}.zip`, zipBlob as Blob)
    }
  } catch (error: any) {
    await zipWriter?.close().catch(() => {})
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DownloadError('CANCELLED', 'Download cancelled by user.')
    }
    throw error
  }
}

export async function downloadItemsAsZip(
  items: Array<{ id: string; name: string; isFolder: boolean; size?: number }>,
  dek: Uint8Array
): Promise<void> {
  if (!dek || dek.length === 0) {
    throw new DownloadError('VAULT_LOCKED', 'Vault is locked. Please unlock to download.')
  }

  let zipWriter: any
  let writableStream: any | null = null

  const totalFileSize = items.reduce((acc, item) => acc + (item.size || 0), 0)
  const hasFolder = items.some((item) => item.isFolder)

  const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024
  const shouldStreamToDisk =
    (hasFolder || totalFileSize > LARGE_FILE_THRESHOLD) && 'showSaveFilePicker' in window

  try {
    if (shouldStreamToDisk) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `uoozer-vault-${Date.now()}.zip`,
      })
      writableStream = await handle.createWritable()
      zipWriter = new ZipWriter(writableStream, { useWebWorkers: true })
    } else {
      zipWriter = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: true })
    }

    async function addFolderContents(currentFolderId: string | null, basePath: string) {
      const filesRes = await fileService.list(currentFolderId)
      for (const backendFile of filesRes.files) {
        const metadata = await decryptMetadataObject<{ name: string }>(
          backendFile.encrypted_metadata,
          backendFile.metadata_nonce,
          dek
        )
        const fileName = sanitizeZipPath(metadata?.name || 'Unnamed File')
        const fullPath = basePath ? `${basePath}/${fileName}` : fileName
        const blob = await downloadFile({ dek, fileId: backendFile.file_id })
        await zipWriter.add(fullPath, new BlobReader(blob))
      }

      const foldersRes = await folderService.list(currentFolderId)
      for (const backendFolder of foldersRes) {
        const folderMetadata = await decryptMetadataObject<{ name: string }>(
          backendFolder.encrypted_metadata,
          backendFolder.metadata_nonce,
          dek
        )
        const subFolderName = sanitizeZipPath(folderMetadata?.name || 'Unnamed Folder')
        await addFolderContents(
          backendFolder.folder_id,
          basePath ? `${basePath}/${subFolderName}` : subFolderName
        )
      }
    }

    for (const item of items) {
      if (item.isFolder) {
        await addFolderContents(item.id, item.name)
      } else {
        const blob = await downloadFile({ dek, fileId: item.id })
        await zipWriter.add(item.name, new BlobReader(blob))
      }
    }

    const zipBlob = await zipWriter.close()

    if (!writableStream && zipBlob) {
      triggerBrowserDownload(`uoozer-vault-${Date.now()}.zip`, zipBlob as Blob)
    }
  } catch (error: any) {
    await zipWriter?.close().catch(() => {})
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DownloadError('CANCELLED', 'Download cancelled by user.')
    }
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

export async function downloadSharedFileToDisk(
  fileName: string,
  _fileSize: number,
  options: {
    shareId: string
    fileId: string
    fileKeyB64: string
    onProgress?: (d: number, t: number) => void
    signal?: AbortSignal
  }
): Promise<void> {
  const { shareId, fileId, fileKeyB64, onProgress, signal } = options

  try {
    const { data: manifest } = await apiClient.get(`/api/v1/shares/${shareId}/files/${fileId}`)

    const fileKey = await base64ToBytes(fileKeyB64)
    const header = await base64ToBytes(manifest.encryption_header)
    const streamId = await initFileDecryption(header, fileKey)

    const sortedChunks = [...manifest.chunks].sort((a, b) => a.chunk_index - b.chunk_index)
    const decryptedParts: Uint8Array[] = []
    let downloadedBytes = 0

    for (const chunkInfo of sortedChunks) {
      if (signal?.aborted) {
        await cleanupFileStream(streamId)
        throw new DownloadError('CANCELLED', 'Download cancelled')
      }

      const response = await fetch(chunkInfo.presigned_url, { signal })
      if (!response.ok) throw new Error('Network error')

      const arrayBuffer = await response.arrayBuffer()
      const ciphertext = new Uint8Array(arrayBuffer)

      verifyChunkSize(chunkInfo.chunk_index, ciphertext, chunkInfo.chunk_size)

      const plaintext = await decryptFileChunk(streamId, ciphertext)

      decryptedParts.push(plaintext)
      downloadedBytes += plaintext.byteLength
      onProgress?.(downloadedBytes, manifest.total_size)
    }

    await cleanupFileStream(streamId)
    const blob = new Blob(decryptedParts as BlobPart[], { type: 'application/octet-stream' })
    triggerBrowserDownload(fileName, blob)
  } catch (error: any) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DownloadError('CANCELLED', 'Download cancelled by user.')
    }
    throw error
  }
}

export async function downloadSharedFolderAsZip(
  rootFolderId: string,
  rootFolderName: string,
  treeData: any[],
  shareId: string
): Promise<void> {
  let zipWriter: any
  let writableStream: any = null

  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${rootFolderName}.zip`,
      })
      writableStream = await handle.createWritable()
      zipWriter = new ZipWriter(writableStream, { useWebWorkers: true })
    } else {
      zipWriter = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: true })
    }

    async function addContents(currentFolderId: string | null, basePath: string) {
      const items = treeData.filter((n) => n.parent_id === currentFolderId)
      for (const item of items) {
        if (item.type === 'folder') {
          await addContents(item.id, basePath ? `${basePath}/${item.name}` : item.name)
        } else {
          const response = await apiClient.get(`/api/v1/shares/${shareId}/files/${item.id}`)
          const manifest = response.data

          const fileKey = await base64ToBytes(item.file_key)
          const header = await base64ToBytes(manifest.encryption_header)
          const streamId = await initFileDecryption(header, fileKey)

          const sortedChunks = [...manifest.chunks].sort((a, b) => a.chunk_index - b.chunk_index)
          const decryptedParts: Uint8Array[] = []

          for (const chunkInfo of sortedChunks) {
            const chunkRes = await fetch(chunkInfo.presigned_url)
            const arrBuf = await chunkRes.arrayBuffer()
            const ciphertext = new Uint8Array(arrBuf)

            verifyChunkSize(chunkInfo.chunk_index, ciphertext, chunkInfo.chunk_size)

            const plaintext = await decryptFileChunk(streamId, ciphertext)
            decryptedParts.push(plaintext)
          }
          await cleanupFileStream(streamId)

          const blob = new Blob(decryptedParts as BlobPart[], { type: 'application/octet-stream' })
          const fullPath = basePath ? `${basePath}/${item.name}` : item.name
          await zipWriter.add(fullPath, new BlobReader(blob))
        }
      }
    }

    await addContents(rootFolderId, '')
    const zipBlob = await zipWriter.close()
    if (!writableStream && zipBlob) {
      triggerBrowserDownload(`${rootFolderName}.zip`, zipBlob as Blob)
    }
  } catch (error: any) {
    await zipWriter?.close().catch(() => {})
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DownloadError('CANCELLED', 'Download cancelled by user.')
    }
    throw error
  }
}
