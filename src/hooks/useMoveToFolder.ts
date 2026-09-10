import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { fileService } from '@services/files/fileService'
import { folderService } from '@services/folders/folderService'
import { useFileStore } from '@stores/fileStore'
import { QUERY_KEYS } from '@lib/constants'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

export interface MoveTarget {
  item: FileItem | Folder
  isFolder: boolean
}

export interface MoveResult {
  ok: boolean
  reason?: 'same-place' | 'into-descendant' | 'error'
  message?: string
}

export function useMoveToFolder() {
  const queryClient = useQueryClient()
  const moveItem = useFileStore((s) => s.moveItem)

  const moveToFolder = async (
    { item, isFolder }: MoveTarget,
    targetFolderId: string | null
  ): Promise<MoveResult> => {
    const currentParent: string | null = isFolder
      ? (item as Folder).parentId
      : (item as FileItem).folderId
    if (currentParent === targetFolderId) {
      return { ok: false, reason: 'same-place', message: 'Already in this folder.' }
    }

    if (isFolder && targetFolderId !== null) {
      let cursor: string | null = targetFolderId
      for (let depth = 0; cursor !== null && depth < 1000; depth++) {
        if (cursor === item.id) {
          return {
            ok: false,
            reason: 'into-descendant',
            message: "Can't move a folder into itself or its own contents.",
          }
        }
        const folder: Folder | undefined = useFileStore.getState().folders.get(cursor)
        cursor = folder?.parentId ?? null
      }
    }

    try {
      if (isFolder) {
        await folderService.moveFolder(item.id, targetFolderId)
      } else {
        await fileService.moveFile(item.id, targetFolderId)
      }
      moveItem(item.id, targetFolderId ?? '', isFolder)
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
      queryClient.invalidateQueries({ queryKey: ['breadcrumb'] })
      return { ok: true }
    } catch (err: any) {
      const message = err?.message ?? `Failed to move ${isFolder ? 'folder' : 'file'}`
      toast.error(message)
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FOLDERS.LIST] })
      queryClient.invalidateQueries({ queryKey: ['breadcrumb'] })
      return { ok: false, reason: 'error', message }
    }
  }

  return { moveToFolder }
}
