import { useEffect, useRef, useCallback } from 'react'
import { useUploadStore } from '@stores/uploadStore'
import { useAuthStore } from '@stores/authStore'
import { uploadDb, type PersistedUploadState } from '@services/upload/uploadDatabase'
import { uploadSync } from '@services/upload/uploadSync'
import { networkMonitor } from '@services/upload/networkMonitor'
import { fileService } from '@services/files/fileService'
import { cancelUpload } from '@services/files/uploadOrchestrator'

export function useUploadManager() {
  const abortControllers = useRef<Map<string, AbortController>>(new Map())
  const resumeHandlers = useRef<Map<string, (state: PersistedUploadState) => void>>(new Map())

  const registerResumeHandler = useCallback(
    (uploadId: string, handler: (state: PersistedUploadState) => void) => {
      resumeHandlers.current.set(uploadId, handler)
    },
    []
  )

  const unregisterResumeHandler = useCallback((uploadId: string) => {
    resumeHandlers.current.delete(uploadId)
  }, [])

  useEffect(() => {
    const resumeInterrupted = async () => {
      const pending = await uploadDb.getPendingUploads()
      const dek = useAuthStore.getState().cryptoState.dek
      if (!dek) return

      for (const upload of pending) {
        useUploadStore.getState().updateUpload(upload.uploadId, {
          status: upload.status === 'uploading' ? 'paused' : upload.status,
          overallProgress: Math.round((upload.uploadedChunks.length / upload.totalChunks) * 100),
        })
      }
    }
    resumeInterrupted()

    const unsubscribeNetwork = networkMonitor.subscribe((isOnline) => {
      const uploads = useUploadStore.getState().uploads
      if (!isOnline) {
        abortControllers.current.forEach((controller) => {
          if (!controller.signal.aborted) controller.abort()
        })
        uploads.forEach((u) => {
          if (u.status === 'uploading' || u.status === 'encrypting') {
            useUploadStore.getState().updateUpload(u.id, { status: 'paused' })
          }
        })
      } else {
        uploads.forEach((u) => {
          if (u.status === 'paused' || u.status === 'error') {
            const handler = resumeHandlers.current.get(u.id)
            if (handler) {
              uploadDb.getUpload(u.id).then((state) => {
                if (state) handler(state)
              })
            }
          }
        })
      }
    })

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (/Mobi|Android/i.test(navigator.userAgent)) {
          abortControllers.current.forEach((controller) => {
            if (!controller.signal.aborted) controller.abort()
          })
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const uploads = useUploadStore.getState().uploads
      const hasActive = Array.from(uploads.values()).some(
        (u) => u.status === 'uploading' || u.status === 'encrypting'
      )
      if (hasActive) {
        event.preventDefault()
        event.returnValue = ''
        abortControllers.current.forEach((controller) => {
          if (!controller.signal.aborted) controller.abort()
        })
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    const handlePageHide = async () => {
      const uploads = useUploadStore.getState().uploads
      const activeUploads = Array.from(uploads.values()).filter(
        (u) => u.status === 'uploading' || u.status === 'encrypting'
      )
      for (const upload of activeUploads) {
        if (upload.fileId && upload.versionId) {
          try {
            await fileService.cancelUpload(upload.fileId, upload.versionId)
          } catch {}
        }
      }
    }
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      unsubscribeNetwork()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [])

  const pauseUpload = useCallback((uploadId: string) => {
    const controller = abortControllers.current.get(uploadId)
    if (controller && !controller.signal.aborted) {
      controller.abort()
    }
    useUploadStore.getState().updateUpload(uploadId, { status: 'paused' })
    uploadSync.notifyUpdate(uploadId)
  }, [])

  const resumeUpload = useCallback(async (uploadId: string) => {
    const state = await uploadDb.getUpload(uploadId)
    if (!state) return

    const dek = useAuthStore.getState().cryptoState.dek
    if (!dek) {
      useUploadStore.getState().updateUpload(uploadId, {
        status: 'error',
        errorMessage: 'Vault is locked. Please unlock to resume.',
      })
      return
    }

    const handler = resumeHandlers.current.get(uploadId)
    if (handler) handler(state)
  }, [])

  const cancelUploadById = useCallback(
    async (uploadId: string, fileId?: string, versionId?: string) => {
      const controller = abortControllers.current.get(uploadId)
      if (controller && !controller.signal.aborted) controller.abort()
      abortControllers.current.delete(uploadId)

      if (fileId && versionId) {
        try {
          await cancelUpload(fileId, versionId)
        } catch (error) {
          console.warn('Server cancel failed', error)
        }
      }

      await uploadDb.deleteUpload(uploadId)
      useUploadStore.getState().removeUpload(uploadId)
      uploadSync.notifyRemove(uploadId)
    },
    []
  )

  const retryUpload = useCallback(async (uploadId: string) => {
    const state = await uploadDb.getUpload(uploadId)
    if (!state) return

    await uploadDb.patchUpload(uploadId, {
      status: 'queued',
      lastError: null,
    })

    const handler = resumeHandlers.current.get(uploadId)
    if (handler) handler(state)
  }, [])

  const registerController = useCallback((uploadId: string, controller: AbortController) => {
    abortControllers.current.set(uploadId, controller)
  }, [])

  const unregisterController = useCallback((uploadId: string) => {
    abortControllers.current.delete(uploadId)
  }, [])

  return {
    pauseUpload,
    resumeUpload,
    cancelUpload: cancelUploadById,
    retryUpload,
    registerController,
    unregisterController,
    registerResumeHandler,
    unregisterResumeHandler,
  }
}
