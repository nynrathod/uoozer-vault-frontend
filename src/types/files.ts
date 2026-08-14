/** Backend file metadata (encrypted, server never sees plaintext). */
export interface FileMetadata {
  name: string
  mimeType: string
  size: number
  createdAt?: string
}

/** Raw file response from backend (all encrypted/opaque). */
export interface BackendFileResponse {
  file_id: string
  folder_id: string | null
  encrypted_metadata: string
  metadata_nonce: string
  total_size: number
  current_version_id: string | null
  is_uploading: boolean
  created_at: string
  updated_at: string
}

/** Decrypted file item used throughout the UI. */
export interface FileItem {
  id: string
  uid: string
  folderId: string | null
  encryptedMetadata: string
  metadataNonce: string
  totalSize: number
  currentVersionId: string | null
  isUploading: boolean
  createdAt: string
  updatedAt: string
  // Decrypted client-side — never sent to server in plaintext
  name: string
  mimeType: string
  version: number
}

/** Backend list response. */
export interface BackendListFilesResponse {
  files: BackendFileResponse[]
  total: number
}

/** Chunk upload URL from backend. */
export interface ChunkUploadUrl {
  chunk_index: number
  segment_index: number
  presigned_url: string
  r2_key: string
  already_uploaded: boolean
}

/** Create file request body. */
export interface CreateFileRequest {
  folder_id: string | null
  encrypted_metadata: string
  metadata_nonce: string
  plaintext_blake3: string
  total_size: number
  total_chunks: number
  encryption_header: string
  chunks: ChunkPlan[]
}

export interface ChunkPlan {
  chunk_index: number
  segment_index: number
  chunk_size: number
  chunk_blake3: string
}

export interface CreateFileResponse {
  file_id: string
  version_id: string
  deduplicated: boolean
  upload_urls: ChunkUploadUrl[]
}

export interface CompleteUploadRequest {
  version_id: string
  r2_etags: Record<string, string>
}

export interface DownloadManifest {
  file_id: string
  version_id: string
  encryption_header: string
  total_size: number
  total_chunks: number
  chunks: DownloadChunkInfo[]
}

export interface DownloadChunkInfo {
  chunk_index: number
  segment_index: number
  chunk_size: number
  presigned_url: string
}

export interface FileVersion {
  version_id: string
  version_number: number
  total_size: number
  total_chunks: number
  is_active: boolean
  is_uploading: boolean
  created_at: string
  created_by_device_id: string
}

export interface ResumeInfo {
  version_id: string
  total_chunks: number
  uploaded_chunks: number[]
  missing_chunks: number[]
  upload_urls: ChunkUploadUrl[] | null
}

export type FileViewMode = 'list' | 'grid'
export type FileSortField = 'name' | 'size' | 'modified' | 'created'
export type FileSortOrder = 'asc' | 'desc'
