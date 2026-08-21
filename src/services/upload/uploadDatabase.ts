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
  streamId: string | null
  chunkPlans: Array<{
    chunk_index: number
    segment_index: number
    chunk_size: number
    chunk_blake3: string
  }>
  status: 'queued' | 'uploading' | 'paused' | 'error' | 'done' | 'cancelled'
  lastError: string | null
  createdAt: number
  updatedAt: number
}

export class UploadDatabase extends Dexie {
  uploads!: Table<PersistedUploadState, string>

  constructor() {
    super('UoozerVaultUploads')
    this.version(3).stores({
      uploads: 'uploadId, status, createdAt, versionId',
    })
  }

  async saveUpload(state: PersistedUploadState): Promise<void> {
    await this.uploads.put({ ...state, updatedAt: Date.now() })
  }

  async patchUpload(uploadId: string, patch: Partial<PersistedUploadState>): Promise<void> {
    const existing = await this.uploads.get(uploadId)
    if (!existing) return
    await this.uploads.put({ ...existing, ...patch, updatedAt: Date.now() })
  }

  async appendUploadedChunk(uploadId: string, chunkIndex: number): Promise<void> {
    const existing = await this.uploads.get(uploadId)
    if (!existing) return
    if (!existing.uploadedChunks.includes(chunkIndex)) {
      existing.uploadedChunks.push(chunkIndex)
      existing.uploadedChunks.sort((a, b) => a - b)
    }
    await this.uploads.put({ ...existing, updatedAt: Date.now() })
  }

  async getUpload(uploadId: string): Promise<PersistedUploadState | undefined> {
    return this.uploads.get(uploadId)
  }

  async getByVersionId(versionId: string): Promise<PersistedUploadState | undefined> {
    return this.uploads.where('versionId').equals(versionId).first()
  }

  async getPendingUploads(): Promise<PersistedUploadState[]> {
    return this.uploads.where('status').anyOf(['queued', 'uploading', 'paused', 'error']).toArray()
  }

  async getAllUploads(): Promise<PersistedUploadState[]> {
    return this.uploads.toArray()
  }

  async deleteUpload(uploadId: string): Promise<void> {
    await this.uploads.delete(uploadId)
  }

  async deleteOlderThan(timestamp: number): Promise<number> {
    return this.uploads.where('createdAt').below(timestamp).delete()
  }
}

export const uploadDb = new UploadDatabase()
