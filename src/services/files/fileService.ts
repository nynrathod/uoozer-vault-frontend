import type { FileItem, FileVersion } from '@/types/files'
import type { PresignedUrlResponse } from '@/types/upload'
import { apiClient } from '@services/api'

export const fileService = {
  async list(folderId?: string | null): Promise<FileItem[]> {
    const { data } = await apiClient.get('/files', { params: { folderId } })
    return data
  },

  async getById(fileId: string): Promise<FileItem> {
    const { data } = await apiClient.get(`/files/${fileId}`)
    return data
  },

  async createMetadata(payload: {
    folderId: string | null
    encryptedName: string
    encryptedMimeType: string
    size: number
    blake3Hash: string
    totalChunks: number
  }): Promise<FileItem> {
    const { data } = await apiClient.post('/files', payload)
    return data
  },

  async getPresignedUrl(fileId: string, chunkIndex: number): Promise<PresignedUrlResponse> {
    const { data } = await apiClient.post(`/files/${fileId}/chunks/${chunkIndex}/presigned`)
    return data
  },

  async completeChunk(
    fileId: string,
    chunkIndex: number,
    payload: { etag: string; blake3Hash: string }
  ): Promise<void> {
    await apiClient.post(`/files/${fileId}/chunks/${chunkIndex}/complete`, payload)
  },

  async completeUpload(fileId: string): Promise<void> {
    await apiClient.post(`/files/${fileId}/complete`)
  },

  async delete(fileId: string): Promise<void> {
    await apiClient.delete(`/files/${fileId}`)
  },

  async getVersions(fileId: string): Promise<FileVersion[]> {
    const { data } = await apiClient.get(`/files/${fileId}/versions`)
    return data
  },

  async restoreVersion(fileId: string, versionId: string): Promise<void> {
    await apiClient.post(`/files/${fileId}/versions/${versionId}/restore`)
  },

  async getDownloadUrl(fileId: string, chunkIndex: number): Promise<string> {
    const { data } = await apiClient.get(`/files/${fileId}/chunks/${chunkIndex}/download`)
    return data.url
  },
}
