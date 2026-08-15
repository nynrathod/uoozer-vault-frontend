import { create } from 'zustand'
import type { UploadFile, UploadChunk } from '@/types/upload'

interface UploadState {
  uploads: Map<string, UploadFile>
  addUpload: (upload: UploadFile) => void
  updateUpload: (id: string, patch: Partial<UploadFile>) => void
  updateChunk: (uploadId: string, chunkIndex: string, patch: Partial<UploadChunk>) => void
  removeUpload: (id: string) => void
  clearCompleted: () => void
  retryUpload: (id: string) => void
  getUpload: (id: string) => UploadFile | undefined
  getAllUploads: () => UploadFile[]
}

export const useUploadStore = create<UploadState>((set, get) => ({
  uploads: new Map(),

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

  updateChunk: (uploadId, chunkIndex, patch) =>
    set((state) => {
      const upload = state.uploads.get(uploadId)
      if (!upload) return state

      const chunkIdx = parseInt(chunkIndex, 10)
      const chunks = upload.chunks.map((c) => (c.index === chunkIdx ? { ...c, ...patch } : c))

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
        if (upload.status !== 'done' && upload.status !== 'cancelled') {
          next.set(id, upload)
        }
      }
      return { uploads: next }
    }),

  retryUpload: (id) =>
    set((s) => {
      const existing = s.uploads.get(id)
      if (!existing || existing.status !== 'error') return s

      const next = new Map(s.uploads)
      next.set(id, {
        ...existing,
        status: 'queued',
        overallProgress: 0,
        errorMessage: null,
        chunks: existing.chunks.map((c) => ({ ...c, status: 'pending', progress: 0, error: null })),
      })
      return { uploads: next }
    }),

  getUpload: (id) => get().uploads.get(id),
  getAllUploads: () => Array.from(get().uploads.values()),
}))
