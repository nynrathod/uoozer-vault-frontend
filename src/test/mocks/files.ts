import type { FileItem } from '@/types/files'

export const mockFiles: FileItem[] = [
  {
    id: 'f1',

    uid: 'f3',
    folderId: null,
    name: 'Annual Report.pdf',
    mimeType: 'application/pdf',
    totalSize: 2456789,
    encryptedMetadata: '',
    metadataNonce: '',
    currentVersionId: null,
    isUploading: false,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f2',

    uid: 'f3',
    folderId: null,
    name: 'Vacation.png',
    mimeType: 'image/png',
    totalSize: 4567891,
    encryptedMetadata: '',
    metadataNonce: '',
    currentVersionId: null,
    isUploading: false,
    version: 1, // <-- ADDED
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f3',
    uid: 'f3',
    folderId: null,
    name: 'Meeting Notes.docx',
    mimeType: 'application/document',
    totalSize: 12345,
    encryptedMetadata: '',
    metadataNonce: '',
    currentVersionId: null,
    isUploading: false,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]
