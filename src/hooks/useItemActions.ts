import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useVaultActions } from './useVaultActions'
import { useInlineRename } from './useInlineRename'
import { useClipboard } from './useClipboard'
import { useFileStore } from '@stores/fileStore'
import { useAuthStore } from '@stores/authStore'
import { isFolder as isFolderGuard } from '@/lib/type-guards'
import { MOCK_URLS, QUERY_KEYS } from '@lib/constants'
import { downloadFileToDisk, downloadFolderAsZip } from '@services/files/downloadOrchestrator'
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
  const dek = useAuthStore((s) => s.cryptoState.dek)

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
      const isDuplicate = Array.from(folders.values()).some(
        (f) => f.parentId === parentId && f.name.toLowerCase() === newName.toLowerCase()
      )
      if (isDuplicate) {
        throw new Error('A folder with this name already exists')
      }
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

  const handleCancel = () => {
    if (isNew && item) {
      const parentId = 'parentId' in item ? item.parentId : null
      queryClient.setQueryData<Folder[]>([QUERY_KEYS.FOLDERS.LIST, parentId], (old = []) =>
        old.filter((f) => f.id !== item.id)
      )
    }
    onRenameCancel?.()
  }

  const handleCopyLink = () => {
    if (!item || isNew) return
    copy(`${MOCK_URLS.SHARE_LINK_BASE}${item.id}`)
  }

  const handleDownload = async () => {
    if (!item) return

    try {
      toast.loading('Preparing download...', { id: `dl-${item.id}` })
      if (!dek) throw new Error('Vault is locked')

      if (isFolder) {
        await downloadFolderAsZip(item.id, item.name, dek)
      } else {
        await downloadFileToDisk(item.name, { dek, fileId: item.id })
      }

      toast.success('Download started', { id: `dl-${item.id}` })
    } catch (error: any) {
      console.error('Download error:', error)
      toast.error(error.message ?? 'Download failed', { id: `dl-${item.id}` })
    }
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
    handleDownload,
    copied,
    handleCancel,
    ...inlineRename,
  }
}
