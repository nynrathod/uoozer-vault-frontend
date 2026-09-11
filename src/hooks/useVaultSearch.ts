import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@stores/authStore'
import { useFileStore } from '@stores/fileStore'
import { folderService } from '@services/folders/folderService'
import { decryptMetadataObject } from '@lib/crypto'
import { QUERY_KEYS } from '@lib/constants'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

export interface VaultSearchItem {
  id: string
  name: string
  type: 'file' | 'folder'
  size: number
  mimeType?: string
  parentId: string | null
  updatedAt: string
}

export function useVaultSearch() {
  const dek = useAuthStore((s) => s.cryptoState.dek)

  const searchQuery = useQuery({
    queryKey: [QUERY_KEYS.FOLDERS.TREE, 'search', !!dek],
    queryFn: async (): Promise<VaultSearchItem[]> => {
      if (!dek) return []
      const nodes = await folderService.getFullVaultTree()
      const items: VaultSearchItem[] = []
      for (const node of nodes) {
        const metadata = await decryptMetadataObject<{ name: string; mimeType?: string }>(
          node.encrypted_metadata,
          node.metadata_nonce,
          dek
        ).catch(() => null)
        items.push({
          id: node.id,
          name: metadata?.name ?? 'Encrypted Item',
          type: node.node_type === 'folder' ? 'folder' : 'file',
          size: node.total_size ?? 0,
          mimeType: metadata?.mimeType,
          parentId: node.parent_id ?? null,
          updatedAt: '',
        })
      }
      return items
    },
    enabled: !!dek,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  return {
    items: searchQuery.data ?? [],
    isLoading: searchQuery.isLoading,
  }
}

export function breadcrumbFromIndex(
  items: VaultSearchItem[],
  folderId: string | null
): { id: string; name: string }[] {
  if (!folderId) return []
  const byId = new Map(items.map((i) => [i.id, i]))
  const chain: { id: string; name: string }[] = []
  let cursor: string | null = folderId

  for (let depth = 0; cursor !== null && depth < 1000; depth++) {
    const node = byId.get(cursor)
    if (!node) break
    chain.unshift({ id: node.id, name: node.name })
    cursor = node.parentId
  }
  return chain
}

export function seedStoreFromSearchItem(item: VaultSearchItem) {
  const store = useFileStore.getState()
  if (item.type === 'folder') {
    if (!store.folders.has(item.id)) {
      store.setFolders([
        ...Array.from(store.folders.values()),
        {
          id: item.id,
          uid: item.id,
          parentId: item.parentId,
          name: item.name,
          encryptedMetadata: '',
          metadataNonce: '',
          totalSize: item.size,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } satisfies Folder,
      ])
    }
  } else {
    if (!store.files.has(item.id)) {
      store.setFiles([
        ...Array.from(store.files.values()),
        {
          id: item.id,
          uid: item.id,
          folderId: item.parentId,
          name: item.name,
          mimeType: item.mimeType ?? 'application/octet-stream',
          totalSize: item.size,
          currentVersionId: null,
          isUploading: false,
          encryptedMetadata: '',
          metadataNonce: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        } satisfies FileItem,
      ])
    }
  }
}

const RECENT_KEY = 'vault:search_recent'
const RECENT_MAX = 6

export function recordRecentItem(item: VaultSearchItem) {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed: Array<Omit<VaultSearchItem, 'updatedAt'>> = raw ? JSON.parse(raw) : []
    const next = [
      {
        id: item.id,
        name: item.name,
        type: item.type,
        size: item.size,
        mimeType: item.mimeType,
        parentId: item.parentId,
      },
      ...parsed.filter((i) => i.id !== item.id),
    ].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {}
}

export function getRecentItems(items: VaultSearchItem[]): VaultSearchItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: Array<Omit<VaultSearchItem, 'updatedAt'>> = JSON.parse(raw)
    return parsed.map((r) => {
      const live = items.find((i) => i.id === r.id)
      return live ?? { ...r, updatedAt: '' }
    })
  } catch {
    return []
  }
}
