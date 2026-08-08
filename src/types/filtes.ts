export interface FileItem {
  id: string
  userId: string
  folderId: string | null
  encryptedName: string
  encryptedMimeType: string
  size: number
  blake3Hash: string
  version: number
  createdAt: string
  updatedAt: string
  chunks: FileChunk[]
}

export interface FileChunk {
  id: string
  fileId: string
  chunkIndex: number
  size: number
  blake3Hash: string
  r2Key: string
  r2Etag: string
  createdAt: string
}

export interface FileVersion {
  id: string
  fileId: string
  version: number
  blake3Hash: string
  size: number
  createdAt: string
}

export interface FilePreview {
  url: string
  mimeType: string
  decrypted: boolean
}

export type FileViewMode = 'list' | 'grid'
export type FileSortField = 'name' | 'size' | 'modified' | 'created'
export type FileSortOrder = 'asc' | 'desc'
