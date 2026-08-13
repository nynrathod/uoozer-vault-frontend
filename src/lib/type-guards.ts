import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

/** Type guard: returns true if the item is a file (has encrypted MIME type and size). */
export function isFile(item: FileItem | Folder): item is FileItem {
  return 'encryptedMimeType' in item && 'size' in item
}

/** Type guard: returns true if the item is a folder (has parentId, no encrypted MIME type). */
export function isFolder(item: FileItem | Folder): item is Folder {
  return 'parentId' in item && !('encryptedMimeType' in item)
}
