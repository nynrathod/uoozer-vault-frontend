/** Tracks the encryption/upload status of a single chunk. */
export interface UploadChunk {
  id: string
  fileId: string
  index: number
  totalChunks: number
  status: 'pending' | 'encrypting' | 'uploading' | 'done' | 'error'
  progress: number
  size: number
  blake3Hash: string | null
  retries: number
}

/** Top-level upload entry with its chunk breakdown and aggregate progress. */
export interface UploadFile {
  id: string
  localFile: File
  encryptedName: string
  encryptedMimeType: string
  folderId: string | null
  totalSize: number
  chunks: UploadChunk[]
  status: 'pending' | 'encrypting' | 'uploading' | 'processing' | 'done' | 'error' | 'cancelled'
  overallProgress: number
  errorMessage?: string
  createdAt: number
}

export interface PresignedUrlRequest {
  fileId: string
  chunkIndex: number
  contentLength: number
}

/** R2 presigned URL for direct chunk upload. */
export interface PresignedUrlResponse {
  url: string
  key: string
  expiresAt: string
}

/** Returned by the upload handler after a successful PUT to R2. */
export interface ChunkUploadResult {
  chunkIndex: number
  etag: string
  blake3Hash: string
}
