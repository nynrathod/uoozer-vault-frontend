import { useEffect, useRef } from 'react'
import { useUploadStore } from '@stores/uploadStore'
import { uploadDb } from '@services/upload/uploadDatabase'

/**
 * Hook to manage upload lifecycle, network changes, and persistence.
 */
export function useUploadManager() {
  const abortControllers = useRef<Map<string, AbortController>>(new Map())

  useEffect(() => {
    // On mount: resume any interrupted uploads from IndexedDB
    const resumeInterrupted = async () => {
      const pending = await uploadDb.getPendingUploads()
      pending.forEach((upload) => {
        // Re-queue interrupted uploads
        useUploadStore.getState().updateUpload(upload.uploadId, { status: 'queued' })
      })
    }
    resumeInterrupted()

    // Handle online/offline events (Pause on offline, Resume on online)
    const handleOffline = () => {
      abortControllers.current.forEach((controller) => controller.abort())
      // State is saved in IndexedDB via the orchestrator's onChunkComplete
    }

    const handleOnline = () => {
      // Trigger resume logic for paused/error uploads
      const uploads = useUploadStore.getState().uploads
      uploads.forEach((u) => {
        if (u.status === 'error' || u.status === 'paused') {
          // Re-initiate upload via your useFileUpload hook logic
        }
      })
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Handle page hide/visibility change (Mobile backgrounding)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // On mobile, uploads might be killed. Abort gracefully to save state.
        // Desktop usually keeps Web Workers alive.
        if (/Mobi|Android/i.test(navigator.userAgent)) {
          handleOffline()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const cancelUpload = async (uploadId: string, fileId?: string, versionId?: string) => {
    const controller = abortControllers.current.get(uploadId)
    controller?.abort()
    abortControllers.current.delete(uploadId)

    if (fileId && versionId) {
      // Call backend cleanup endpoint
      // await fileService.cancelUpload(fileId, versionId);
    }

    await uploadDb.deleteUpload(uploadId)
    useUploadStore.getState().removeUpload(uploadId)
  }

  return { cancelUpload }
}
