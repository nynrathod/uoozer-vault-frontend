/**
 * Download Orchestrator
 *
 * Handles the full zero-knowledge chunked download flow:
 * 1. Get download manifest (presigned GET URLs + encryption header)
 * 2. Initialize secretstream decryption with DEK
 * 3. Download each chunk from R2
 * 4. Decrypt each chunk sequentially
 * 5. Assemble into a Blob for download/preview
 */

import { fileService } from './fileService'
import { initFileDecryption, decryptFileChunk, cleanupFileStream } from '@lib/crypto'

export interface DownloadOptions {
  dek: Uint8Array
  fileId: string
  versionId?: string
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
  signal?: AbortSignal
}

/** Downloads and decrypts a file, returning a Blob. */
export async function downloadFile(options: DownloadOptions): Promise<Blob> {
  const { dek, fileId, versionId, onProgress, signal } = options

  // ── 1. Get download manifest ────────────────────────────────
  const manifest = await fileService.getDownloadManifest(fileId, versionId)

  // Actually, the manifest returns encryption_header as base64 string
  // We need to decode it to bytes for initFileDecryption
  const { base64ToBytes } = await import('@lib/crypto')
  const header = await base64ToBytes(manifest.encryption_header)
  await initFileDecryption(header, dek)

  // ── 3. Download + decrypt chunks sequentially ───────────────
  const decryptedChunks: Uint8Array[] = []
  let downloadedBytes = 0

  for (const chunkInfo of manifest.chunks) {
    if (signal?.aborted) {
      await cleanupFileStream()
      throw new Error('Download cancelled')
    }

    // Download encrypted chunk from R2
    const ciphertext = await fileService.downloadChunkFromR2(chunkInfo.presigned_url)

    // Decrypt chunk
    const plaintext = await decryptFileChunk(ciphertext)
    decryptedChunks.push(plaintext)

    downloadedBytes += chunkInfo.chunk_size
    onProgress?.(downloadedBytes, manifest.total_size)
  }

  // ── 4. Clean up decryption state ────────────────────────────
  await cleanupFileStream()

  // ── 5. Assemble into Blob ───────────────────────────────────
  return new Blob(decryptedChunks as BlobPart[])
}

/** Downloads a file and triggers a browser download. */
export async function downloadFileToDisk(
  fileName: string,
  options: DownloadOptions
): Promise<void> {
  const blob = await downloadFile(options)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
