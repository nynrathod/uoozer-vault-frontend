export interface Folder {
  id: string
  userId: string
  parentId: string | null
  encryptedName: string
  createdAt: string
  updatedAt: string
}

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[]
  depth: number
}

export interface CreateFolderInput {
  parentId: string | null
  encryptedName: string
}

export interface RenameFolderInput {
  encryptedName: string
}
