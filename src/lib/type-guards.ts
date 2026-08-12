import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

export function isFile(item: FileItem | Folder): item is FileItem {
  return 'encryptedMimeType' in item && 'size' in item
}

export function isFolder(item: FileItem | Folder): item is Folder {
  return 'parentId' in item && !('encryptedMimeType' in item)
}
