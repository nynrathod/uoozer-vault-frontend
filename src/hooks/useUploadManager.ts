import { useEffect, useRef } from 'react'
import { useUploadStore } from '@stores/uploadStore'
import { uploadDb } from '@services/upload/uploadDatabase'
import { resumeUpload } from '@services/files/uploadOrchestrator'
import { useAuthStore } from '@stores/authStore'

/**
 * Hook to manage upload lifecycle, network changes, and persistence.
 */
export function useUploadManager() {
  const abortControllers = useRef<Map<string, AbortController>>(new Map())
  const dek = useAuthStore((s) => s.cryptoState.dek)

  useEffect(() => {
    if (!dek) return

    const resumePending = async () => {
      const pending = await uploadDb.getPendingUploads()
      for (const p of pending) {
        if (p.status === 'paused' || p.status === 'error') {
          // Re-queue in UI store
          useUploadStore.getState().updateUpload(p.uploadId, { status: 'queued' })

          const controller = new AbortController()
          abortControllers.current.set(p.uploadId, controller)

          try {
            useUploadStore.getState().updateUpload(p.uploadId, { status: 'uploading' })

            const result = await resumeUpload(p.uploadId, {
              dek,
              folderId: p.folderId,
              signal: controller.signal,
              onProgress: (uploadedBytes, speed, eta) => {
                const overallProgress = Math.min(99, Math.round((uploadedBytes / p.fileSize) * 100))
                useUploadStore.getState().updateUpload(p.uploadId, { overallProgress })
              },
              onChunkStatus: (chunkIndex, status) => {
                useUploadStore.getState().updateChunk(p.uploadId, String(chunkIndex), { status })
              },
            })

            useUploadStore.getState().updateUpload(p.uploadId, {
              status: 'done',
              fileId: result.fileId,
              versionId: result.versionId,
              completedAt: Date.now(),
              overallProgress: 100,
            })
          } catch (error: any) {
            if (controller.signal.aborted) {
              useUploadStore.getState().updateUpload(p.uploadId, { status: 'paused' })
            } else {
              useUploadStore
                .getState()
                .updateUpload(p.uploadId, { status: 'error', errorMessage: error.message })
            }
          } finally {
            abortControllers.current.delete(p.uploadId)
          }
        }
      }
    }

    resumePending()

    const handleOffline = () => {
      abortControllers.current.forEach((controller) => controller.abort())
    }

    const handleOnline = () => {
      // Trigger resume logic for paused/error uploads
      resumePending()
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasActiveUploads = Array.from(useUploadStore.getState().uploads.values()).some(
        (u) => u.status === 'uploading' || u.status === 'queued'
      )
      if (hasActiveUploads) {
        e.preventDefault()
        e.returnValue = 'Uploads are in progress. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [dek])

  const cancelUpload = async (uploadId: string, fileId?: string, versionId?: string) => {
    const controller = abortControllers.current.get(uploadId)
    controller?.abort()
    abortControllers.current.delete(uploadId)

    if (fileId && versionId) {
      try {
        await fetch(`/api/v1/files/${fileId}/versions/${versionId}/cancel`, { method: 'POST' })
      } catch (err) {
        console.error('Failed to cancel upload on backend', err)
      }
    }

    await uploadDb.deleteUpload(uploadId)
    useUploadStore.getState().removeUpload(uploadId)
  }

  return { cancelUpload }
}
