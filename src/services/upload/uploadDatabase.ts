import Dexie, { type Table } from 'dexie'

export interface PersistedUploadState {
  uploadId: string
  fileId: string | null
  versionId: string | null
  folderId: string | null
  fileName: string
  fileSize: number
  totalChunks: number
  uploadedChunks: number[]
  encryptionHeader: string
  plaintextBlake3: string
  chunkPlans: any[]
  status: 'queued' | 'uploading' | 'paused' | 'error'
  createdAt: number
  updatedAt: number
}

export interface PersistedChunk {
  id: string // Format: `${uploadId}-${chunkIndex}`
  data: Uint8Array
}

/**
 * IndexedDB wrapper for persisting upload state across browser sessions.
 */
export class UploadDatabase extends Dexie {
  uploads!: Table<PersistedUploadState, string>
  chunks!: Table<PersistedChunk, string>

  constructor() {
    super('UoozerVaultUploads')
    this.version(2).stores({
      uploads: 'uploadId, status, createdAt',
      chunks: 'id', // Store raw bytes here
    })
  }

  async saveUpload(state: PersistedUploadState) {
    await this.uploads.put({ ...state, updatedAt: Date.now() })
  }

  async getUpload(uploadId: string): Promise<PersistedUploadState | undefined> {
    return this.uploads.get(uploadId)
  }

  async getPendingUploads(): Promise<PersistedUploadState[]> {
    return this.uploads.where('status').anyOf(['queued', 'uploading', 'paused', 'error']).toArray()
  }

  async deleteUpload(uploadId: string) {
    await this.uploads.delete(uploadId)
  }
}

export const uploadDb = new UploadDatabase()
