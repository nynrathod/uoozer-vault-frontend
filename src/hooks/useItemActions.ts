import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useVaultActions } from './useVaultActions'
import { useInlineRename } from './useInlineRename'
import { useClipboard } from './useClipboard'
import { useFileStore } from '@stores/fileStore'
import { useAuthStore } from '@stores/authStore'
import { isFolder as isFolderGuard } from '@/lib/type-guards'
import { QUERY_KEYS } from '@lib/constants' // Removed MOCK_URLS
import { downloadFileToDisk, downloadFolderAsZip } from '@services/files/downloadOrchestrator'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'
import { apiClient, fileService, folderService } from '@/services'
import {
  base64ToBytes,
  bytesToBase64,
  decryptMetadataObject,
  encryptMetadata,
  generateDek,
  unwrapDek,
  wrapDek,
} from '@/lib/crypto'

export function useItemActions(
  item: FileItem | Folder | undefined | null,
  onRenameCancel?: () => void
) {
  const { deleteItem, renameItem, createFolder, restoreItem, permanentDeleteItem } =
    useVaultActions()
  const { copied, copy } = useClipboard()
  const folders = useFileStore((s) => s.folders)
  const queryClient = useQueryClient()
  const dek = useAuthStore.getState().cryptoState.dek

  const isFolder = item ? isFolderGuard(item) : false
  const isNew = item?.id.startsWith('temp-') ?? false

  const handleDelete = () => {
    if (!item || isNew) return
    deleteItem({ id: item.id, isFolder })
  }

  const isTrash = !!item?.deletedAt

  const handleRestore = () => {
    if (!item) return
    restoreItem({ id: item.id, isFolder })
  }

  const handlePermanentDelete = () => {
    if (!item) return
    permanentDeleteItem({ id: item.id, isFolder })
  }

  const handleRename = async (newName: string): Promise<void> => {
    if (!item) return

    if (isNew) {
      const parentId = 'parentId' in item ? item.parentId : null
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

  const handleCopyLink = async () => {
    if (!item || isNew) return

    try {
      toast.loading('Generating secure link...', { id: 'share-link' })
      const localDek = useAuthStore.getState().cryptoState.dek
      if (!localDek) throw new Error('Vault is locked')

      const shareKey = await generateDek()

      let payload: any = {}
      let endpoint = ''

      if (isFolder) {
        endpoint = `/api/v1/folders/${item.id}/shares`

        const filesInFolder = await fetchFolderFilesRecursive(item.id, localDek)

        const manifestBytes = new TextEncoder().encode(JSON.stringify(filesInFolder))
        const encryptedManifest = await encryptMetadata(manifestBytes, shareKey)

        payload = {
          item_type: 'folder',
          encrypted_payload: await bytesToBase64(encryptedManifest.ciphertext),
          encrypted_nonce: await bytesToBase64(encryptedManifest.nonce),
          encryption_header: null,
        }
      } else {
        endpoint = `/api/v1/files/${item.id}/shares`
        const fileMeta = await fileService.getById(item.id)

        if (!fileMeta.wrapped_file_key || !fileMeta.wrapped_file_key_nonce) {
          throw new Error('File is missing encryption key metadata.')
        }

        const wrappedKey = {
          ciphertext: await base64ToBytes(fileMeta.wrapped_file_key),
          nonce: await base64ToBytes(fileMeta.wrapped_file_key_nonce),
        }
        const fileKey = await unwrapDek(wrappedKey, localDek)
        if (!fileKey) throw new Error('Failed to unwrap file key')

        const sharedWrappedKey = await wrapDek(fileKey, shareKey)

        payload = {
          item_type: 'file',
          encrypted_payload: await bytesToBase64(sharedWrappedKey.ciphertext),
          encrypted_nonce: await bytesToBase64(sharedWrappedKey.nonce),
          encryption_header: fileMeta.encryption_header, // Pass the secretstream header
        }
      }

      const { data } = await apiClient.post(endpoint, payload)
      const shareId = data.share_id

      const shareUrl = `${window.location.origin}/s/${shareId}#k=${await bytesToBase64(shareKey)}`

      copy(shareUrl)
      toast.success('Secure link copied to clipboard!', { id: 'share-link' })
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to generate secure link', { id: 'share-link' })
    }
  }

  const handleDownload = async () => {
    if (!item) return

    try {
      toast.loading('Preparing download...', { id: `dl-${item.id}` })
      const localDek = useAuthStore.getState().cryptoState.dek
      if (!localDek) throw new Error('Vault is locked')

      if (isFolder) {
        await downloadFolderAsZip(item.id, item.name, localDek)
      } else {
        const fileSize = 'totalSize' in item ? item.totalSize : 0
        await downloadFileToDisk(item.name, fileSize, { dek: localDek, fileId: item.id })
      }

      toast.success('Download started', { id: `dl-${item.id}` })
    } catch (error: any) {
      if (error?.code === 'CANCELLED' || error?.name === 'AbortError') {
        toast.dismiss(`dl-${item.id}`)
        return
      }

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
    isTrash,
    handleDelete: isTrash ? handlePermanentDelete : handleDelete,
    handleRestore,
    handleCopyLink,
    handleDownload,
    copied,
    handleCancel,
    ...inlineRename,
  }
}

async function fetchFolderFilesRecursive(folderId: string, dek: Uint8Array) {
  const files: Array<{
    file_id: string
    name: string
    file_key: string
    size: number
  }> = []

  async function recurse(currentId: string | null) {
    const filesRes = await fileService.list(currentId, 1000, 0, false)
    for (const f of filesRes.files) {
      if (!f.wrapped_file_key || !f.wrapped_file_key_nonce) continue

      const metadata = await decryptMetadataObject<{ name: string }>(
        f.encrypted_metadata,
        f.metadata_nonce,
        dek
      )

      const wrappedKey = {
        ciphertext: await base64ToBytes(f.wrapped_file_key),
        nonce: await base64ToBytes(f.wrapped_file_key_nonce),
      }
      const fileKey = await unwrapDek(wrappedKey, dek)

      if (fileKey) {
        files.push({
          file_id: f.file_id,
          name: metadata?.name || 'Unnamed File',
          file_key: await bytesToBase64(fileKey),
          size: f.total_size,
        })
      }
    }

    const foldersRes = await folderService.list(currentId, false)
    for (const folder of foldersRes) {
      await recurse(folder.folder_id)
    }
  }

  await recurse(folderId)
  return files
}
