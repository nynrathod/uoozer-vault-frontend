import { apiClient } from '@services/api'
import type { Folder, FolderTreeNode, CreateFolderInput, RenameFolderInput } from '@/types/folders'

export const folderService = {
  async list(parentId?: string | null): Promise<Folder[]> {
    const { data } = await apiClient.get('/folders', { params: { parentId } })
    return data
  },

  async getTree(): Promise<FolderTreeNode[]> {
    const { data } = await apiClient.get('/folders/tree')
    return data
  },

  async create(input: CreateFolderInput): Promise<Folder> {
    const { data } = await apiClient.post('/folders', input)
    return data
  },

  async rename(folderId: string, input: RenameFolderInput): Promise<Folder> {
    const { data } = await apiClient.patch(`/folders/${folderId}`, input)
    return data
  },

  async move(folderId: string, parentId: string | null): Promise<Folder> {
    const { data } = await apiClient.patch(`/folders/${folderId}/move`, { parentId })
    return data
  },

  async delete(folderId: string): Promise<void> {
    await apiClient.delete(`/folders/${folderId}`)
  },
}
