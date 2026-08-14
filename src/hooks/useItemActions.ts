import { useQueryClient } from '@tanstack/react-query'
import { useVaultActions } from './useVaultActions'
import { useInlineRename } from './useInlineRename'
import { useClipboard } from './useClipboard'
import { useFileStore } from '@stores/fileStore'
import { isFolder as isFolderGuard } from '@/lib/type-guards'
import { MOCK_URLS, QUERY_KEYS } from '@lib/constants'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

export function useItemActions(
  item: FileItem | Folder | undefined | null,
  onRenameCancel?: () => void
) {
  const { deleteItem, renameItem, createFolder } = useVaultActions()
  const { copied, copy } = useClipboard()
  const folders = useFileStore((s) => s.folders)
  const queryClient = useQueryClient()

  const isFolder = item ? isFolderGuard(item) : false
  const isNew = item?.id.startsWith('temp-') ?? false

  const handleDelete = () => {
    if (!item || isNew) return
    deleteItem({ id: item.id, isFolder })
  }

  const handleRename = async (newName: string): Promise<void> => {
    if (!item) return

    if (isNew) {
      const parentId = 'parentId' in item ? item.parentId : null

      // Zero-Knowledge Duplicate Check
      const isDuplicate = Array.from(folders.values()).some(
        (f) => f.parentId === parentId && f.name.toLowerCase() === newName.toLowerCase()
      )
      if (isDuplicate) {
        throw new Error('A folder with this name already exists')
      }

      // Pass the tempId so the mutation can replace it in the cache
      await createFolder({ name: newName, parentId, tempId: item.id })
    } else {
      await renameItem({
        id: item.id,
        isFolder,
        newName,
        currentMimeType: !isFolder ? (item as FileItem).mimeType : undefined,
        currentParentId: isFolder ? (item as Folder).parentId : null,
      })
    }
  }

  // If user cancels creating a new folder, remove it from the React Query cache
  const handleCancel = () => {
    if (isNew && item) {
      const parentId = 'parentId' in item ? item.parentId : null
      const currentFolders =
        queryClient.getQueryData<Folder[]>([QUERY_KEYS.FOLDERS.LIST, parentId]) || []

      // ONLY delete the temp folder if it is STILL in the cache.
      // If onSave succeeded, onSuccess already replaced it with a real UUID,
      // so it won't be in the cache anymore, and we skip deletion.
      if (currentFolders.some((f) => f.id === item.id)) {
        queryClient.setQueryData<Folder[]>([QUERY_KEYS.FOLDERS.LIST, parentId], (old = []) =>
          old.filter((f) => f.id !== item.id)
        )
      }
    }
    onRenameCancel?.()
  }

  const handleCopyLink = () => {
    if (!item || isNew) return
    copy(`${MOCK_URLS.SHARE_LINK_BASE}${item.id}`)
  }

  const inlineRename = useInlineRename(
    item?.name ?? '',
    handleRename,
    handleCancel,
    undefined,
    isNew
  )

  return {
    isFolder,
    handleDelete,
    handleCopyLink,
    copied,
    handleCancel,
    ...inlineRename,
  }
}
