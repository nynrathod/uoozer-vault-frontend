/**
 * Download Orchestrator
 */

import { ZipWriter, BlobReader, BlobWriter } from '@zip.js/zip.js'
import { fileService } from './fileService'
import { folderService } from '@services/folders/folderService'
import {
  initFileDecryption,
  decryptFileChunk,
  cleanupFileStream,
  decryptMetadataObject,
} from '@lib/crypto'

export interface DownloadOptions {
  dek: Uint8Array
  fileId: string
  versionId?: string
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
  signal?: AbortSignal
}

/** Downloads and decrypts a single file, returning a Blob. */
export async function downloadFile(options: DownloadOptions): Promise<Blob> {
  const { dek, fileId, versionId, onProgress, signal } = options
  const manifest = await fileService.getDownloadManifest(fileId, versionId)

  const { base64ToBytes } = await import('@lib/crypto')
  const header = await base64ToBytes(manifest.encryption_header)
  await initFileDecryption(header, dek)

  const decryptedChunks: Uint8Array[] = []
  let downloadedBytes = 0

  for (const chunkInfo of manifest.chunks) {
    if (signal?.aborted) {
      await cleanupFileStream()
      throw new Error('Download cancelled')
    }
    const ciphertext = await fileService.downloadChunkFromR2(chunkInfo.presigned_url)
    const plaintext = await decryptFileChunk(ciphertext)
    decryptedChunks.push(plaintext)
    downloadedBytes += chunkInfo.chunk_size
    onProgress?.(downloadedBytes, manifest.total_size)
  }

  await cleanupFileStream()
  return new Blob(decryptedChunks as BlobPart[])
}

/** Downloads a file and triggers a browser download. */
export async function downloadFileToDisk(
  fileName: string,
  options: DownloadOptions
): Promise<void> {
  const blob = await downloadFile(options)
  triggerBrowserDownload(fileName, blob)
}

export async function downloadFolderAsZip(
  folderId: string,
  folderName: string,
  dek: Uint8Array
): Promise<void> {
  async function addFolderContentsToZip(
    currentFolderId: string | null,
    zipWriter: ZipWriter<Blob>,
    basePath: string
  ) {
    const filesRes = await fileService.list(currentFolderId)
    for (const backendFile of filesRes.files) {
      const metadata = await decryptMetadataObject<{ name: string }>(
        backendFile.encrypted_metadata,
        backendFile.metadata_nonce,
        dek
      )
      const fileName = metadata?.name || 'Unnamed File'

      const blob = await downloadFile({ dek, fileId: backendFile.file_id })

      const fullPath = basePath ? `${basePath}/${fileName}` : fileName
      await zipWriter.add(fullPath, new BlobReader(blob))
    }

    const foldersRes = await folderService.list(currentFolderId)
    for (const backendFolder of foldersRes) {
      const folderMetadata = await decryptMetadataObject<{ name: string }>(
        backendFolder.encrypted_metadata,
        backendFolder.metadata_nonce,
        dek
      )
      const subFolderName = folderMetadata?.name || 'Unnamed Folder'
      const newBasePath = basePath ? `${basePath}/${subFolderName}` : subFolderName
      await addFolderContentsToZip(backendFolder.folder_id, zipWriter, newBasePath)
    }
  }

  const zipWriter = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: true })

  await addFolderContentsToZip(folderId, zipWriter, '')

  const zipBlob = await zipWriter.close()
  triggerBrowserDownload(`${folderName}.zip`, zipBlob)
}

function triggerBrowserDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
