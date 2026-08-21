/** Tracks a single chunk's encryption + upload lifecycle. */
export interface UploadChunk {
  index: number
  segmentIndex: number
  status: 'pending' | 'encrypting' | 'uploading' | 'done' | 'error'
  progress: number
  size: number
  ciphertextSize: number
  blake3Hash: string | null
  r2Etag: string | null
  r2Key: string | null
  presignedUrl: string | null
  error: string | null
  retries: number
}

/** Top-level upload entry tracked in the upload store. */
export interface UploadFile {
  id: string
  file: File
  fileId: string | null
  versionId: string | null
  folderId: string | null
  totalSize: number
  totalChunks: number
  chunks: UploadChunk[]
  status:
    'queued' | 'encrypting' | 'uploading' | 'completing' | 'done' | 'error' | 'cancelled' | 'paused'
  overallProgress: number
  errorMessage: string | null
  startedAt: number
  completedAt: number | null
  deduplicated: boolean
}
