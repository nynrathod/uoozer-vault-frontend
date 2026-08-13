import type { FileItem, FileVersion } from '@/types/files'
import type { PresignedUrlResponse } from '@/types/upload'
import { apiClient } from '@services/api'
import { AuthError, AUTH_ERROR_CODES } from '@/services/auth/error'

export const fileService = {
  async list(folderId?: string | null): Promise<FileItem[]> {
    try {
      const { data } = await apiClient.get('/files', { params: { folderId } })
      return data
    } catch (error: any) {
      throw new AuthError(AUTH_ERROR_CODES.INTERNAL_ERROR, error?.response?.status || 500, {
        message: 'Failed to fetch files.',
      })
    }
  },

  async getById(fileId: string): Promise<FileItem> {
    try {
      const { data } = await apiClient.get(`/files/${fileId}`)
      return data
    } catch (error: any) {
      throw new AuthError(AUTH_ERROR_CODES.NOT_FOUND, error?.response?.status || 404, {
        message: 'File not found.',
      })
    }
  },

  async createMetadata(payload: {
    folderId: string | null
    encryptedName: string
    encryptedMimeType: string
    size: number
    blake3Hash: string
    totalChunks: number
  }): Promise<FileItem> {
    try {
      const { data } = await apiClient.post('/files', payload)
      return data
    } catch (error: any) {
      throw new AuthError(AUTH_ERROR_CODES.INTERNAL_ERROR, error?.response?.status || 500, {
        message: 'Failed to create file metadata.',
      })
    }
  },

  async getPresignedUrl(fileId: string, chunkIndex: number): Promise<PresignedUrlResponse> {
    try {
      const { data } = await apiClient.post(`/files/${fileId}/chunks/${chunkIndex}/presigned`)
      return data
    } catch (error: any) {
      throw new AuthError(AUTH_ERROR_CODES.INTERNAL_ERROR, error?.response?.status || 500, {
        message: 'Failed to get upload URL.',
      })
    }
  },

  async completeChunk(
    fileId: string,
    chunkIndex: number,
    payload: { etag: string; blake3Hash: string }
  ): Promise<void> {
    try {
      await apiClient.post(`/files/${fileId}/chunks/${chunkIndex}/complete`, payload)
    } catch (error: any) {
      throw new AuthError(AUTH_ERROR_CODES.INTERNAL_ERROR, error?.response?.status || 500, {
        message: `Failed to complete chunk ${chunkIndex}.`,
      })
    }
  },

  async completeUpload(fileId: string): Promise<void> {
    try {
      await apiClient.post(`/files/${fileId}/complete`)
    } catch (error: any) {
      throw new AuthError(AUTH_ERROR_CODES.INTERNAL_ERROR, error?.response?.status || 500, {
        message: 'Failed to complete upload.',
      })
    }
  },

  async delete(fileId: string): Promise<void> {
    try {
      await apiClient.delete(`/files/${fileId}`)
    } catch (error: any) {
      throw new AuthError(AUTH_ERROR_CODES.INTERNAL_ERROR, error?.response?.status || 500, {
        message: 'Failed to delete file.',
      })
    }
  },

  async getVersions(fileId: string): Promise<FileVersion[]> {
    try {
      const { data } = await apiClient.get(`/files/${fileId}/versions`)
      return data
    } catch (error: any) {
      throw new AuthError(AUTH_ERROR_CODES.NOT_FOUND, error?.response?.status || 404, {
        message: 'Failed to fetch version history.',
      })
    }
  },

  async restoreVersion(fileId: string, versionId: string): Promise<void> {
    try {
      await apiClient.post(`/files/${fileId}/versions/${versionId}/restore`)
    } catch (error: any) {
      throw new AuthError(AUTH_ERROR_CODES.INTERNAL_ERROR, error?.response?.status || 500, {
        message: 'Failed to restore version.',
      })
    }
  },

  async getDownloadUrl(fileId: string, chunkIndex: number): Promise<string> {
    try {
      const { data } = await apiClient.get(`/files/${fileId}/chunks/${chunkIndex}/download`)
      return data.url
    } catch (error: any) {
      throw new AuthError(AUTH_ERROR_CODES.INTERNAL_ERROR, error?.response?.status || 500, {
        message: 'Failed to get download URL.',
      })
    }
  },
}
