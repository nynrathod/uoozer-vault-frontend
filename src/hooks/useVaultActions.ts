import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fileService } from '@services/files/fileService'
import { folderService } from '@services/folders/folderService'
import { useFileStore } from '@stores/fileStore'
import { usePreviewStore } from '@stores/previewStore'
import { useAuthStore } from '@stores/authStore'
import { encryptMetadataObject } from '@lib/crypto'
import { QUERY_KEYS } from '@lib/constants'
import type { Folder } from '@/types/folders'
import type { FileItem } from '@/types/files'

export function useVaultActions() {
  const queryClient = useQueryClient()
  const closePreview = usePreviewStore((s) => s.close)
  const dek = useAuthStore((s) => s.cryptoState.dek)

  const updateFolderCache = (parentId: string | null, updater: (old: Folder[]) => Folder[]) => {
    queryClient.setQueryData<Folder[]>([QUERY_KEYS.FOLDERS.LIST, parentId], (old = []) =>
      updater(old)
    )
  }

  // ── Create Folder Mutation ──────────────────────────────────
  const createFolderMutation = useMutation({
    mutationFn: async ({
      name,
      parentId,
      tempId,
    }: {
      name: string
      parentId: string | null
      tempId: string
    }) => {
      if (!dek) throw new Error('Vault is locked')
      const { encryptedMetadata, metadataNonce } = await encryptMetadataObject({ name }, dek)
      return folderService.create({
        encrypted_metadata: encryptedMetadata,
        metadata_nonce: metadataNonce,
        parent_folder_id: parentId,
      })
    },
    onSuccess: (backendFolder, variables) => {
      // Swap the temp folder with the real folder IN THE CACHE
      updateFolderCache(variables.parentId, (old) =>
        old.map((f) =>
          f.id === variables.tempId
            ? {
                id: backendFolder.folder_id,
                uid: f.uid,
                parentId: backendFolder.parent_folder_id,
                name: variables.name,
                encryptedMetadata: backendFolder.encrypted_metadata,
                metadataNonce: backendFolder.metadata_nonce,
                createdAt: backendFolder.created_at,
                updatedAt: backendFolder.updated_at,
              }
            : f
        )
      )
    },
    onError: (error: any, variables) => {
      // Remove the temp folder from the cache on error
      updateFolderCache(variables.parentId, (old) => old.filter((f) => f.id !== variables.tempId))
      toast.error(error.message ?? 'Failed to create folder')
    },
  })

  // ── Delete Mutation ─────────────────────────────────────────
  const deleteItemMutation = useMutation({
    mutationFn: async ({ id, isFolder }: { id: string; isFolder: boolean }) => {
      if (isFolder) return folderService.delete(id)
      return fileService.delete(id)
    },
    onMutate: async ({ id, isFolder }) => {
      if (isFolder) {
        queryClient.setQueriesData<Folder[]>({ queryKey: [QUERY_KEYS.FOLDERS.LIST] }, (old = []) =>
          old.filter((f) => f.id !== id)
        )
      } else {
        queryClient.setQueriesData<{ files: FileItem[]; total: number }>(
          { queryKey: [QUERY_KEYS.FILES.LIST] },
          (old) => {
            if (!old) return old
            return { ...old, files: old.files.filter((f) => f.id !== id) }
          }
        )
        closePreview()
      }
    },
    onSuccess: (_data, { isFolder }) => {
      toast.success(`${isFolder ? 'Folder' : 'File'} deleted successfully`)
    },
    onError: (error: any, { isFolder }) => {
      toast.error(error.message ?? `Failed to delete ${isFolder ? 'folder' : 'file'}`)
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
    },
  })

  // ── Rename Mutation ─────────────────────────────────────────
  const renameItemMutation = useMutation({
    mutationFn: async ({
      id,
      isFolder,
      newName,
      currentMimeType,
      currentParentId,
    }: {
      id: string
      isFolder: boolean
      newName: string
      currentMimeType?: string
      currentParentId?: string | null
    }) => {
      if (!dek) throw new Error('Vault is locked')
      const metadata = isFolder
        ? { name: newName }
        : { name: newName, mimeType: currentMimeType || 'application/octet-stream' }
      const { encryptedMetadata, metadataNonce } = await encryptMetadataObject(metadata, dek)

      if (isFolder) {
        return folderService.update(id, {
          encrypted_metadata: encryptedMetadata,
          metadata_nonce: metadataNonce,
          parent_folder_id: currentParentId ?? null,
        })
      } else {
        return fileService.update(id, {
          encrypted_metadata: encryptedMetadata,
          metadata_nonce: metadataNonce,
        })
      }
    },
    onMutate: async ({ id, isFolder, newName }) => {
      if (isFolder) {
        queryClient.setQueriesData<Folder[]>({ queryKey: [QUERY_KEYS.FOLDERS.LIST] }, (old = []) =>
          old.map((f) => (f.id === id ? { ...f, name: newName } : f))
        )
      } else {
        queryClient.setQueriesData<{ files: FileItem[]; total: number }>(
          { queryKey: [QUERY_KEYS.FILES.LIST] },
          (old) => {
            if (!old) return old
            return {
              ...old,
              files: old.files.map((f) => (f.id === id ? { ...f, name: newName } : f)),
            }
          }
        )
      }
    },
    onSuccess: (_data, { isFolder }) => {
      toast.success(`${isFolder ? 'Folder' : 'File'} renamed successfully`)
    },
    onError: (error: any, { isFolder }) => {
      toast.error(error.message ?? `Failed to rename ${isFolder ? 'folder' : 'file'}`)
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (items: { id: string; isFolder: boolean }[]) => {
      const file_ids = items.filter((i) => !i.isFolder).map((i) => i.id)
      const folder_ids = items.filter((i) => i.isFolder).map((i) => i.id)
      if (file_ids.length === 0 && folder_ids.length === 0) return null
      return fileService.bulkDelete({ file_ids, folder_ids })
    },
    onMutate: async (items) => {
      items.forEach(({ id, isFolder }) => {
        if (isFolder) {
          queryClient.setQueriesData<Folder[]>(
            { queryKey: [QUERY_KEYS.FOLDERS.LIST] },
            (old = []) => old.filter((f) => f.id !== id)
          )
        } else {
          queryClient.setQueriesData<{ files: FileItem[]; total: number }>(
            { queryKey: [QUERY_KEYS.FILES.LIST] },
            (old) => {
              if (!old) return old
              return { ...old, files: old.files.filter((f) => f.id !== id) }
            }
          )
        }
      })
    },
    onSuccess: () => {
      toast.success('Items deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to delete items')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
    },
  })

  return {
    bulkDelete: bulkDeleteMutation.mutate,
    deleteItem: deleteItemMutation.mutate,
    renameItem: renameItemMutation.mutateAsync,
    createFolder: createFolderMutation.mutateAsync,
    isDeleting: bulkDeleteMutation.isPending || deleteItemMutation.isPending,
    isRenaming: renameItemMutation.isPending,
  }
}
