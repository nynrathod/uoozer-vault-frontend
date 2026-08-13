import type { UploadFile } from '@/types/upload'
import { create } from 'zustand'

interface UploadState {
  uploads: Map<string, UploadFile>
  activeUploads: number
  maxConcurrent: number
  addUpload: (upload: UploadFile) => void
  updateUpload: (id: string, patch: Partial<UploadFile>) => void
  updateChunk: (
    uploadId: string,
    chunkId: string,
    patch: Partial<UploadFile['chunks'][number]>
  ) => void
  removeUpload: (id: string) => void
  clearCompleted: () => void
  getUpload: (id: string) => UploadFile | undefined
  getAllUploads: () => UploadFile[]
}

export const useUploadStore = create<UploadState>((set, get) => ({
  uploads: new Map(),
  activeUploads: 0,
  maxConcurrent: 6,
  addUpload: (upload) =>
    set((s) => {
      const next = new Map(s.uploads)
      next.set(upload.id, upload)
      return { uploads: next }
    }),
  updateUpload: (id, patch) =>
    set((s) => {
      const existing = s.uploads.get(id)
      if (!existing) return s
      const next = new Map(s.uploads)
      next.set(id, { ...existing, ...patch })
      return { uploads: next }
    }),
  updateChunk: (uploadId, chunkId, patch) =>
    set((state) => {
      const upload = state.uploads.get(uploadId)
      if (!upload) return state

      const chunks = upload.chunks.map((c) => {
        if (c.id !== chunkId) return c

        if (patch.progress !== undefined && patch.status === undefined) {
          const progressDiff = Math.abs(c.progress - patch.progress)
          if (progressDiff < 2 && patch.progress < 100) {
            return c
          }
        }

        return { ...c, ...patch }
      })

      const doneChunks = chunks.filter((c) => c.status === 'done').length
      const overallProgress = Math.round((doneChunks / chunks.length) * 100)

      const next = new Map(state.uploads)
      next.set(uploadId, { ...upload, chunks, overallProgress })
      return { uploads: next }
    }),
  removeUpload: (id) =>
    set((s) => {
      const next = new Map(s.uploads)
      next.delete(id)
      return { uploads: next }
    }),
  clearCompleted: () =>
    set((s) => {
      const next = new Map<string, UploadFile>()
      for (const [id, upload] of s.uploads) {
        if (upload.status !== 'done') next.set(id, upload)
      }
      return { uploads: next }
    }),
  getUpload: (id) => get().uploads.get(id),
  getAllUploads: () => Array.from(get().uploads.values()),
}))
