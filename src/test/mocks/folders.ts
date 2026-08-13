import type { Folder } from '@/types/folders'

export const mockFolders: Folder[] = [
  {
    id: '1',
    userId: '1',
    parentId: null,
    encryptedName: 'Documents',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    userId: '1',
    parentId: null,
    encryptedName: 'Images',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    userId: '1',
    parentId: null,
    encryptedName: 'Videos',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    userId: '1',
    parentId: null,
    encryptedName: 'Work Projects',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    userId: '1',
    parentId: '1',
    encryptedName: 'Invoices',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]
