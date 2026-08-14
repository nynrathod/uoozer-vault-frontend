import { useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fileService } from '@services/files/fileService'
import { folderService } from '@services/folders/folderService'
import { useFileStore } from '@stores/fileStore'
import { useAuthStore } from '@stores/authStore'
import { decryptMetadataObject } from '@lib/crypto'
import { QUERY_KEYS } from '@lib/constants'
import type { BackendFileResponse, FileItem } from '@/types/files'
import type { BackendFolderResponse, Folder, FolderMetadata } from '@/types/folders'

/** Maps a backend file response to a UI FileItem by decrypting metadata. */
async function mapFileResponse(backend: BackendFileResponse, dek: Uint8Array): Promise<FileItem> {
  let name = 'Encrypted File'
  let mimeType = 'application/octet-stream'

  try {
    const metadata = await decryptMetadataObject<{ name: string; mimeType: string }>(
      backend.encrypted_metadata,
      backend.metadata_nonce,
      dek
    )
    if (metadata) {
      name = metadata.name
      mimeType = metadata.mimeType
    }
  } catch {}

  return {
    id: backend.file_id,
    uid: backend.file_id,
    folderId: backend.folder_id,
    encryptedMetadata: backend.encrypted_metadata,
    metadataNonce: backend.metadata_nonce,
    totalSize: backend.total_size,
    currentVersionId: backend.current_version_id,
    isUploading: backend.is_uploading,
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
    name,
    mimeType,
    version: 1,
  }
}

/** Maps a backend folder response to a UI Folder by decrypting metadata. */
async function mapFolderResponse(backend: BackendFolderResponse, dek: Uint8Array): Promise<Folder> {
  let name = 'Encrypted Folder'

  try {
    const metadata = await decryptMetadataObject<FolderMetadata>(
      backend.encrypted_metadata,
      backend.metadata_nonce,
      dek
    )
    if (metadata) {
      name = metadata.name
    }
  } catch {}

  return {
    id: backend.folder_id,
    uid: backend.folder_id,
    parentId: backend.parent_folder_id,
    encryptedMetadata: backend.encrypted_metadata,
    metadataNonce: backend.metadata_nonce,
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
    name,
  }
}

/** Hook for fetching and managing vault files/folders with zero-knowledge decryption. */
export function useVaultFiles(folderId: string | null) {
  const queryClient = useQueryClient()
  const dek = useAuthStore((s) => s.cryptoState.dek)

  const setFiles = useFileStore((s) => s.setFiles)
  const setFolders = useFileStore((s) => s.setFolders)
  const setCurrentFolderId = useFileStore((s) => s.setCurrentFolderId)

  const filesQuery = useQuery({
    queryKey: [QUERY_KEYS.FILES.LIST, folderId],
    queryFn: async () => {
      if (!dek) throw new Error('Vault is locked')
      const response = await fileService.list(folderId)
      const mapped = await Promise.all(response.files.map((f) => mapFileResponse(f, dek)))
      return { files: mapped, total: response.total }
    },
    enabled: !!dek,
    staleTime: 10_000,
  })

  const foldersQuery = useQuery({
    queryKey: [QUERY_KEYS.FOLDERS.LIST, folderId],
    queryFn: async () => {
      if (!dek) throw new Error('Vault is locked')
      const response = await folderService.list(folderId)
      return Promise.all(response.map((f) => mapFolderResponse(f, dek)))
    },
    enabled: !!dek,
    staleTime: 10_000,
  })

  // Direct sync from React Query cache to Zustand
  useEffect(() => {
    if (filesQuery.data) {
      setFiles(filesQuery.data.files)
    }
  }, [filesQuery.data, setFiles])

  useEffect(() => {
    if (foldersQuery.data) {
      setFolders(foldersQuery.data)
    }
  }, [foldersQuery.data, setFolders])

  useEffect(() => {
    setCurrentFolderId(folderId)
  }, [folderId, setCurrentFolderId])

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
  }, [queryClient])

  return {
    isLoading: filesQuery.isLoading || foldersQuery.isLoading,
    isError: filesQuery.isError || foldersQuery.isError,
    error: filesQuery.error || foldersQuery.error,
    refresh,
  }
}
