import { createContext, useContext } from 'react'

interface ShareContextType {
  shareId: string
  shareKey: Uint8Array | null
  treeData: any[]
  isShareMode: boolean
}

export const ShareContext = createContext<ShareContextType | null>(null)
export const useShareContext = () => useContext(ShareContext)
