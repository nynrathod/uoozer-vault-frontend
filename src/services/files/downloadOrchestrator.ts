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

export async function downloadFile(options: DownloadOptions): Promise<Response> {
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
  const streamId = await initFileDecryption(header, fileKey) // Use fileKey, NOT dek!

  const stream = new ReadableStream({
    async start(controller) {
      let downloadedBytes = 0
      const totalBytes = manifest.total_size

      try {
        for (const chunkInfo of manifest.chunks) {
          if (signal?.aborted) {
            await cleanupFileStream(streamId)
            controller.error(new DownloadError('CANCELLED', 'Download cancelled'))
            return
          }

          const response = await fetch(chunkInfo.presigned_url, { signal })
          if (!response.ok || !response.body) {
            throw new DownloadError(
              'NETWORK_ERROR',
              `Failed to download chunk ${chunkInfo.chunk_index}`
            )
          }

          const reader = response.body.getReader()
          const chunks: Uint8Array[] = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) {
              chunks.push(value)
              downloadedBytes += value.byteLength
              onProgress?.(downloadedBytes, totalBytes)
            }
          }

          const merged = new Uint8Array(chunks.reduce((acc, c) => acc + c.byteLength, 0))
          let offset = 0
          for (const c of chunks) {
            merged.set(c, offset)
            offset += c.byteLength
          }

          const plaintext = await decryptFileChunk(streamId, merged)
          controller.enqueue(plaintext)
        }
        await cleanupFileStream(streamId)
        controller.close()
      } catch (error) {
        await cleanupFileStream(streamId)
        controller.error(error)
      }
    },
  })

  return new Response(stream)
}

// src/services/files/downloadOrchestrator.ts

export async function downloadFileToDisk(
  fileName: string,
  fileSize: number,
  options: DownloadOptions
): Promise<void> {
  if (!options.dek || options.dek.length === 0) {
    throw new DownloadError('VAULT_LOCKED', 'Vault is locked. Please unlock to download.')
  }

  // 500MB threshold. Files larger than this will use the streaming "Save As"
  // method to prevent the browser tab from crashing (Out of Memory).
  const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024

  try {
    if (fileSize > LARGE_FILE_THRESHOLD && 'showSaveFilePicker' in window) {
      // HYBRID APPROACH 1: Large File -> Stream directly to disk (0 RAM used)
      const handle = await (window as any).showSaveFilePicker({ suggestedName: fileName })
      const writable = await handle.createWritable()
      const response = await downloadFile(options)

      // Pipe the decrypted stream directly to the hard drive
      await response.body!.pipeTo(writable)
    } else {
      // HYBRID APPROACH 2: Small File -> Load into memory and use native browser UI
      const response = await downloadFile(options)
      const blob = await response.blob()
      triggerBrowserDownload(fileName, blob)
    }
  } catch (error: any) {
    // Silently handle the user clicking "Cancel" on the native save window
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DownloadError('CANCELLED', 'Download cancelled by user.')
    }
    if (error instanceof DownloadError && error.code === 'CANCELLED') {
      throw error
    }
    throw error
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

        const response = await downloadFile({ dek, fileId: backendFile.file_id, signal })
        const blob = await response.blob()
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
        const response = await downloadFile({ dek, fileId: backendFile.file_id })
        const blob = await response.blob()
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
        const response = await downloadFile({ dek, fileId: item.id })
        const blob = await response.blob()
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
