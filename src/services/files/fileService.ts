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
    offset: number = 0
  ): Promise<BackendListFilesResponse> {
    try {
      const params: Record<string, any> = { limit, offset }
      if (folderId) {
        params.folder_id = folderId
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
      throw handleApiError(error, 'Failed to create new version.')
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

  async bulkDelete(payload: { file_ids: string[]; folder_ids: string[] }): Promise<void> {
    try {
      await apiClient.post('/api/v1/files/bulk-delete', payload)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to delete items.')
    }
  },
}
