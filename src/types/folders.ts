/** Backend folder response (encrypted metadata). */
export interface BackendFolderResponse {
  folder_id: string
  parent_folder_id: string | null
  encrypted_metadata: string
  metadata_nonce: string
  created_at: string
  updated_at: string
}

/** Folder metadata (encrypted client-side, never sent in plaintext). */
export interface FolderMetadata {
  name: string
  color?: string
  icon?: string
}

/** Decrypted folder used in UI. */
export interface Folder {
  id: string
  uid: string
  parentId: string | null
  encryptedMetadata: string
  metadataNonce: string
  createdAt: string
  updatedAt: string
  // Decrypted client-side
  name: string
}

export interface CreateFolderRequest {
  encrypted_metadata: string
  metadata_nonce: string
  parent_folder_id: string | null
}

export interface UpdateFolderRequest {
  encrypted_metadata: string
  metadata_nonce: string
  parent_folder_id: string | null
}

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[]
  depth: number
}
