import { apiClient } from '@services/api/client'
import type {
  BackendFileResponse,
  BackendListFilesResponse,
  CreateFileRequest,
  CreateFileResponse,
  CompleteUploadRequest,
  DownloadManifest,
  FileVersion,
  ResumeInfo,
} from '@/types/files'
import { AuthError, AUTH_ERROR_CODES } from '@/services/auth/error'

/** Maps a backend error response to a typed AuthError. */
function handleApiError(error: any, defaultMessage: string): AuthError {
  const status = error?.response?.status ?? 500
  const code = error?.response?.data?.error?.code
  const message = error?.response?.data?.error?.message ?? defaultMessage
  return new AuthError(code ?? AUTH_ERROR_CODES.INTERNAL_ERROR, status, { message })
}

/** File CRUD, chunked upload orchestration, and version management. */
export const fileService = {
  async list(
    folderId?: string | null,
    limit: number = 100,
    offset: number = 0,
    trashed: boolean = false
  ): Promise<BackendListFilesResponse> {
    try {
      const params: Record<string, string | number | boolean> = {}
      if (folderId) {
        params.folder_id = folderId
      }
      if (trashed) {
        params.trashed = true
      }
      const { data } = await apiClient.get('/api/v1/files', { params })
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to fetch files.')
    }
  },

  async getById(fileId: string): Promise<BackendFileResponse> {
    try {
      const { data } = await apiClient.get(`/api/v1/files/${fileId}`)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'File not found.')
    }
  },

  async createFile(req: CreateFileRequest): Promise<CreateFileResponse> {
    try {
      const { data } = await apiClient.post('/api/v1/files', req)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to initiate upload.')
    }
  },

  async createVersion(fileId: string, req: CreateFileRequest): Promise<CreateFileResponse> {
    try {
      const { data } = await apiClient.post(`/api/v1/files/${fileId}/versions`, req)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to create file version.')
    }
  },

  async listVersions(fileId: string): Promise<FileVersion[]> {
    try {
      const { data } = await apiClient.get(`/api/v1/files/${fileId}/versions`)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to fetch version history.')
    }
  },

  async restoreVersion(fileId: string, versionId: string): Promise<void> {
    try {
      await apiClient.post(`/api/v1/files/${fileId}/versions/${versionId}/restore`)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to restore version.')
    }
  },
  async deleteVersion(fileId: string, versionId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/files/${fileId}/versions/${versionId}`)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to delete version.')
    }
  },

  async completeUpload(fileId: string, req: CompleteUploadRequest): Promise<void> {
    try {
      await apiClient.post(`/api/v1/files/${fileId}/complete`, req)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to complete upload.')
    }
  },

  async getDownloadManifest(fileId: string, versionId?: string): Promise<DownloadManifest> {
    try {
      const { data } = await apiClient.get(`/api/v1/files/${fileId}/download`, {
        params: versionId ? { version_id: versionId } : {},
      })
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to get download manifest.')
    }
  },

  async getResumeInfo(versionId: string): Promise<ResumeInfo> {
    try {
      const { data } = await apiClient.get(`/api/v1/chunks/${versionId}/resume`)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to get resume info.')
    }
  },

  async delete(fileId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/files/${fileId}`)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to delete file.')
    }
  },

  async update(
    fileId: string,
    payload: {
      encrypted_metadata?: string
      metadata_nonce?: string
      folder_id?: string | null
    }
  ): Promise<BackendFileResponse> {
    try {
      const { data } = await apiClient.patch(`/api/v1/files/${fileId}`, payload)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to update file.')
    }
  },

  async uploadChunkToR2(presignedUrl: string, ciphertext: Uint8Array): Promise<{ etag: string }> {
    try {
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: ciphertext as BodyInit,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      })

      if (!response.ok) {
        throw new Error(`R2 upload failed: ${response.status} ${response.statusText}`)
      }

      const etag = response.headers.get('ETag') ?? ''
      return { etag: etag.replace(/"/g, '') }
    } catch (error: any) {
      throw new Error(`Chunk upload failed: ${error.message}`)
    }
  },

  async downloadChunkFromR2(presignedUrl: string): Promise<Uint8Array> {
    try {
      const response = await fetch(presignedUrl)
      if (!response.ok) {
        throw new Error(`R2 download failed: ${response.status} ${response.statusText}`)
      }
      const buffer = await response.arrayBuffer()
      return new Uint8Array(buffer)
    } catch (error: any) {
      throw new Error(`Chunk download failed: ${error.message}`)
    }
  },

  async bulkDelete(req: {
    file_ids: string[]
    folder_ids: string[]
    permanent?: boolean
  }): Promise<void> {
    try {
      await apiClient.post('/api/v1/files/bulk-delete', req)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to delete items.')
    }
  },

  async restoreFile(fileId: string): Promise<void> {
    try {
      await apiClient.post(`/api/v1/files/${fileId}/restore`)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to restore file.')
    }
  },

  async permanentDelete(fileId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/files/${fileId}/permanent`)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to permanently delete file.')
    }
  },

  async cancelUpload(fileId: string, versionId: string): Promise<void> {
    try {
      await apiClient.post(`/api/v1/files/${fileId}/versions/${versionId}/cancel`)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to cancel upload.')
    }
  },

  async bulkCancelUploads(uploads: Array<{ file_id: string; version_id: string }>): Promise<void> {
    try {
      await apiClient.post('/api/v1/files/bulk-cancel', { uploads })
    } catch (error: any) {
      throw handleApiError(error, 'Failed to bulk cancel uploads.')
    }
  },

  async cleanupOrphanedUploads(): Promise<{ deleted: number }> {
    try {
      const { data } = await apiClient.post('/api/v1/files/cleanup-orphans', {})
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to cleanup orphaned uploads.')
    }
  },

  async getDownloadManifestWithCheck(
    fileId: string,
    versionId?: string
  ): Promise<DownloadManifest> {
    try {
      const { data } = await apiClient.get(`/api/v1/files/${fileId}/download`, {
        params: versionId ? { version_id: versionId, verify: true } : { verify: true },
      })
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to get download manifest.')
    }
  },

  async bulkInitUploads(req: CreateFileRequest[]): Promise<CreateFileResponse[]> {
    try {
      const { data } = await apiClient.post('/api/v1/files/bulk-init', { files: req })
      return data.results
    } catch (error: any) {
      throw handleApiError(error, 'Failed to bulk initialize uploads.')
    }
  },

  async bulkCompleteUploads(
    uploads: {
      file_id: string
      version_id: string
      r2_etags: Record<string, string>
      plaintext_blake3: string
      encryption_header: string
      chunk_hashes: Record<string, string>
    }[]
  ): Promise<any> {
    try {
      const { data } = await apiClient.post('/api/v1/files/bulk-complete', { uploads })
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to complete bulk uploads.')
    }
  },

  async verifyChunk(req: {
    version_id: string
    chunk_index: number
    r2_etag: string
  }): Promise<any> {
    try {
      const { data } = await apiClient.post('/api/v1/chunks/verify', req)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to verify chunk.')
    }
  },

  async precheckUpload(
    plaintext_blake3: string,
    total_size: number
  ): Promise<{ allowed: boolean; deduplicated: boolean }> {
    try {
      const { data } = await apiClient.get('/api/v1/files/precheck', {
        params: { plaintext_blake3, total_size },
      })
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Quota check failed.')
    }
  },

  async emptyTrash(): Promise<{ deleted: number }> {
    try {
      const { data } = await apiClient.post('/api/v1/files/empty-trash')
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to empty trash.')
    }
  },
}
