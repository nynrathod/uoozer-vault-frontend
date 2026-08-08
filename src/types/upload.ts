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

export interface PresignedUrlResponse {
  url: string
  key: string
  expiresAt: string
}

export interface ChunkUploadResult {
  chunkIndex: number
  etag: string
  blake3Hash: string
}
