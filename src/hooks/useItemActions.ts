import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useVaultActions } from './useVaultActions'
import { useInlineRename } from './useInlineRename'
import { useClipboard } from './useClipboard'
import { useFileStore } from '@stores/fileStore'
import { useAuthStore } from '@stores/authStore'
import { isFolder as isFolderGuard } from '@/lib/type-guards'
import { QUERY_KEYS } from '@lib/constants'
import {
  downloadFileToDisk,
  downloadFolderAsZip,
  downloadSharedFileToDisk,
  downloadSharedFolderAsZip,
} from '@services/files/downloadOrchestrator'
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
import { useState } from 'react'
import { useShareContext } from '@/contexts/ShareContext'

export function useItemActions(
  item: FileItem | Folder | undefined | null,
  onRenameCancel?: () => void
) {
  const shareCtx = useShareContext()
  const isShareMode = !!shareCtx

  const { deleteItem, renameItem, createFolder, restoreItem, permanentDeleteItem } =
    useVaultActions()
  const { copied, copy } = useClipboard()
  const queryClient = useQueryClient()

  const isFolder = item ? isFolderGuard(item) : false
  const isNew = item?.id.startsWith('temp-') ?? false

  const handleDelete = () => {
    if (!item || isNew || isShareMode) return
    deleteItem({ id: item.id, isFolder })
  }

  const isTrash = !!item?.deletedAt

  const handleRestore = () => {
    if (!item || isShareMode) return
    restoreItem({ id: item.id, isFolder })
  }

  const handlePermanentDelete = () => {
    if (!item || isShareMode) return
    permanentDeleteItem({ id: item.id, isFolder })
  }

  const handleRename = async (newName: string): Promise<void> => {
    if (!item || isShareMode) return

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

  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const handleCopyLink = async (accessType?: 'public' | 'restricted') => {
    if (isShareMode) return

    const actualAccessType = accessType === 'restricted' ? 'restricted' : 'public'
    if (!item || isNew || isShareMode) return

    try {
      setIsGeneratingLink(true)
      setShareUrl(null)

      if (isFolder) {
        toast.loading('Encrypting folder contents for sharing...', { id: 'share-link' })
      } else {
        toast.loading('Generating secure link...', { id: 'share-link' })
      }

      const localDek = useAuthStore.getState().cryptoState.dek
      if (!localDek) throw new Error('Vault is locked')

      const shareKey = await generateDek()
      let payload: any = {}
      let endpoint = ''

      if (isFolder) {
        endpoint = `/api/v1/folders/${item.id}/shares`
        const treeManifest = await fetchFolderTree(item.id, localDek)
        const manifestBytes = new TextEncoder().encode(JSON.stringify(treeManifest))
        const encryptedManifest = await encryptMetadata(manifestBytes, shareKey)

        payload = {
          item_type: 'folder',
          encrypted_payload: await bytesToBase64(encryptedManifest.ciphertext),
          encrypted_nonce: await bytesToBase64(encryptedManifest.nonce),
          encryption_header: null,
          item_id: item.id,
          access_type: actualAccessType,
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
          encryption_header: fileMeta.encryption_header,
          item_id: item.id,
          access_type: actualAccessType,
        }
      }

      const { data } = await apiClient.post(endpoint, payload)
      const shareId = data.share_id
      const url = `${window.location.origin}/s/${shareId}#k=${await bytesToBase64(shareKey)}`

      setShareUrl(url)
      copy(url)
      toast.success('Secure link generated and copied to clipboard!', { id: 'share-link' })
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to generate secure link', { id: 'share-link' })
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const handleDownload = async () => {
    if (!item) return
    try {
      toast.loading('Preparing download...', { id: `dl-${item.id}` })

      if (isShareMode && shareCtx) {
        if (isFolder) {
          await downloadSharedFolderAsZip(item.id, item.name, shareCtx.treeData, shareCtx.shareId)
        } else {
          const node = shareCtx.treeData.find((n) => n.id === item.id)
          if (!node || !node.file_key) throw new Error('Missing file key for download')
          await downloadSharedFileToDisk(item.name, 'totalSize' in item ? item.totalSize : 0, {
            shareId: shareCtx.shareId,
            fileId: item.id,
            fileKeyB64: node.file_key,
          })
        }
      } else {
        const localDek = useAuthStore.getState().cryptoState.dek
        if (!localDek) throw new Error('Vault is locked')
        if (isFolder) {
          await downloadFolderAsZip(item.id, item.name, localDek)
        } else {
          await downloadFileToDisk(item.name, 'totalSize' in item ? item.totalSize : 0, {
            dek: localDek,
            fileId: item.id,
          })
        }
      }
      toast.success('Download started', { id: `dl-${item.id}` })
    } catch (error: any) {
      if (error?.code === 'CANCELLED' || error?.name === 'AbortError') {
        toast.dismiss(`dl-${item.id}`)
        return
      }
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
    isShareMode,
    handleDelete: isTrash ? handlePermanentDelete : handleDelete,
    handleRestore,
    handleCopyLink,
    handleDownload,
    copied,
    handleCancel,
    isGeneratingLink,
    shareUrl,
    ...inlineRename,
  }
}

async function fetchFolderTree(folderId: string, dek: Uint8Array) {
  const tree = await folderService.getFolderFileTree(folderId)
  const manifest: Array<{
    id: string
    parent_id: string | null
    type: string
    name: string
    file_key: string | null
    size: number
  }> = []

  for (const node of tree) {
    const metadata = await decryptMetadataObject<{ name: string }>(
      node.encrypted_metadata,
      node.metadata_nonce,
      dek
    )

    let fileKeyB64: string | null = null
    if (node.node_type === 'file' && node.wrapped_file_key && node.wrapped_file_key_nonce) {
      const wrappedKey = {
        ciphertext: await base64ToBytes(node.wrapped_file_key),
        nonce: await base64ToBytes(node.wrapped_file_key_nonce),
      }
      const fileKey = await unwrapDek(wrappedKey, dek)
      if (fileKey) {
        fileKeyB64 = await bytesToBase64(fileKey)
      }
    }

    manifest.push({
      id: node.id,
      parent_id: node.parent_id,
      type: node.node_type,
      name: metadata?.name || 'Unnamed',
      file_key: fileKeyB64,
      size: node.total_size || 0,
    })
  }
  return manifest
}
