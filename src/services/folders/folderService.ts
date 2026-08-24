import { apiClient } from '@services/api/client'
import type {
  BackendFolderResponse,
  CreateFolderRequest,
  UpdateFolderRequest,
} from '@/types/folders'
import { AuthError, AUTH_ERROR_CODES } from '@/services/auth/error'

function handleApiError(error: any, defaultMessage: string): AuthError {
  const status = error?.response?.status ?? 500
  const code = error?.response?.data?.error?.code
  const message = error?.response?.data?.error?.message ?? defaultMessage
  return new AuthError(code ?? AUTH_ERROR_CODES.INTERNAL_ERROR, status, { message })
}

export const folderService = {
  async list(
    parentFolderId?: string | null,
    trashed: boolean = false
  ): Promise<BackendFolderResponse[]> {
    try {
      const params: Record<string, string> = {}
      if (parentFolderId) {
        params.parent_folder_id = parentFolderId
      }
      const { data } = await apiClient.get('/api/v1/folders', { params })
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to fetch folders.')
    }
  },

  async getById(folderId: string): Promise<BackendFolderResponse> {
    try {
      const { data } = await apiClient.get(`/api/v1/folders/${folderId}`)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Folder not found.')
    }
  },

  async create(req: CreateFolderRequest): Promise<BackendFolderResponse> {
    try {
      const { data } = await apiClient.post('/api/v1/folders', req)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to create folder.')
    }
  },

  async update(folderId: string, req: UpdateFolderRequest): Promise<BackendFolderResponse> {
    try {
      const { data } = await apiClient.patch(`/api/v1/folders/${folderId}`, req)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to update folder.')
    }
  },

  async delete(folderId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/folders/${folderId}`)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to delete folder.')
    }
  },

  async restore(folderId: string): Promise<void> {
    try {
      await apiClient.post(`/api/v1/folders/${folderId}/restore`)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to restore folder.')
    }
  },

  async permanentDelete(folderId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/folders/${folderId}/permanent`)
    } catch (error: any) {
      throw handleApiError(error, 'Failed to permanently delete folder.')
    }
  },
  async bulkCreate(req: CreateFolderRequest[]): Promise<BackendFolderResponse[]> {
    try {
      const { data } = await apiClient.post('/api/v1/folders/bulk', { folders: req })
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to bulk create folders.')
    }
  },
  async getFolderFileTree(folderId: string): Promise<any[]> {
    try {
      const { data } = await apiClient.get(`/api/v1/folders/${folderId}/tree`)
      return data
    } catch (error: any) {
      throw handleApiError(error, 'Failed to fetch folder tree.')
    }
  },
}
