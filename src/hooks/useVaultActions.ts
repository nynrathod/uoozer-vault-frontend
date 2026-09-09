import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fileService } from '@services/files/fileService'
import { folderService } from '@services/folders/folderService'
import { usePreviewStore } from '@stores/previewStore'
import { useAuthStore } from '@stores/authStore'
import { encryptMetadataObject } from '@lib/crypto'
import { QUERY_KEYS } from '@lib/constants'
import type { Folder } from '@/types/folders'
import type { FileItem } from '@/types/files'
import { useUploadStore } from '@/stores/uploadStore'

export function useVaultActions() {
  const queryClient = useQueryClient()
  const closePreview = usePreviewStore((s) => s.close)
  const dek = useAuthStore((s) => s.cryptoState.dek)

  const updateFolderCache = (parentId: string | null, updater: (old: Folder[]) => Folder[]) => {
    queryClient.setQueryData<Folder[]>([QUERY_KEYS.FOLDERS.LIST, parentId, false], (old = []) =>
      updater(old)
    )
  }

  const createFolderMutation = useMutation({
    mutationFn: async ({
      name,
      parentId,
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
      updateFolderCache(variables.parentId, (old) =>
        old.map((f) =>
          f.id === variables.tempId
            ? {
                ...f,
                id: backendFolder.folder_id,
                parentId: backendFolder.parent_folder_id,
                name: variables.name,
              }
            : f
        )
      )
    },
    onError: (error: any, variables) => {
      updateFolderCache(variables.parentId, (old) => old.filter((f) => f.id !== variables.tempId))
      toast.error(error.message ?? 'Failed to create folder')
    },
  })

  const invalidateVault = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
  }

  const deleteItemMutation = useMutation({
    mutationFn: async ({ id, isFolder }: { id: string; isFolder: boolean }) => {
      useUploadStore
        .getState()
        .getAllUploads()
        .forEach((u) => {
          if (u.fileId === id) useUploadStore.getState().removeUpload(u.id)
        })
      if (usePreviewStore.getState().fileId === id) closePreview()
      if (isFolder) return folderService.delete(id)
      return fileService.delete(id)
    },
    onSuccess: (_data, { isFolder }) => {
      toast.success(`${isFolder ? 'Folder' : 'File'} moved to trash`)
    },
    onError: (error: any, { isFolder }) => {
      if (error?.code === 'NOT_FOUND') {
        toast.success(`${isFolder ? 'Folder' : 'File'} deleted successfully`)
      } else {
        toast.error(error.message ?? `Failed to delete ${isFolder ? 'folder' : 'file'}`)
      }
    },
    onSettled: invalidateVault,
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (items: { id: string; isFolder: boolean; permanent?: boolean }[]) => {
      const isPermanent = items[0]?.permanent ?? false
      const file_ids = items.filter((i) => !i.isFolder).map((i) => i.id)
      const folder_ids = items.filter((i) => i.isFolder).map((i) => i.id)
      if (file_ids.length > 0 || folder_ids.length > 0) {
        await fileService.bulkDelete({ file_ids, folder_ids, permanent: isPermanent })
      }
      return null
    },
    onSuccess: (_data, items) => {
      const isPermanent = items[0]?.permanent ?? false
      toast.success(isPermanent ? 'Items deleted permanently' : 'Items moved to trash')
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to delete items')
    },
    onSettled: invalidateVault,
  })

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

  const restoreItemMutation = useMutation({
    mutationFn: async ({ id, isFolder }: { id: string; isFolder: boolean }) => {
      if (isFolder) return folderService.restore(id)
      return fileService.restoreFile(id)
    },
    onSuccess: (_data, { isFolder }) => {
      toast.success(`${isFolder ? 'Folder' : 'File'} restored`)
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to restore item')
    },
    onSettled: invalidateVault,
  })

  const permanentDeleteItemMutation = useMutation({
    mutationFn: async ({ id, isFolder }: { id: string; isFolder: boolean }) => {
      if (isFolder) return folderService.permanentDelete(id)
      return fileService.permanentDelete(id)
    },
    onSuccess: (_data, { isFolder }) => {
      toast.success(`${isFolder ? 'Folder' : 'File'} deleted permanently`)
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to permanently delete item')
    },
    onSettled: invalidateVault,
  })

  const emptyTrashMutation = useMutation({
    mutationFn: async () => {
      return fileService.emptyTrash()
    },
    onSuccess: () => {
      toast.success('Trash emptied')
      invalidateVault()
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to empty trash')
    },
  })

  return {
    bulkDelete: bulkDeleteMutation.mutate,
    deleteItem: deleteItemMutation.mutate,
    restoreItem: restoreItemMutation.mutate,
    permanentDeleteItem: permanentDeleteItemMutation.mutate,
    emptyTrash: emptyTrashMutation.mutate,
    bulkDeleteAsync: bulkDeleteMutation.mutateAsync,
    deleteItemAsync: deleteItemMutation.mutateAsync,
    restoreItemAsync: restoreItemMutation.mutateAsync,
    permanentDeleteItemAsync: permanentDeleteItemMutation.mutateAsync,
    isDeleting: bulkDeleteMutation.isPending || deleteItemMutation.isPending,
    isRenaming: renameItemMutation.isPending,
    isEmptyingTrash: emptyTrashMutation.isPending,
    renameItem: renameItemMutation.mutateAsync,
    createFolder: createFolderMutation.mutateAsync,
  }
}
