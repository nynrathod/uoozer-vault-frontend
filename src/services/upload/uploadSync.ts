import { uploadDb, type PersistedUploadState } from './uploadDatabase'

const CHANNEL_NAME = 'uoozer-vault-uploads'
const STORAGE_KEY = 'vault:upload_sync_epoch'

type SyncMessage =
  | { type: 'upload-updated'; uploadId: string }
  | { type: 'upload-removed'; uploadId: string }
  | { type: 'request-state'; sourceEpoch: string }
  | { type: 'state-snapshot'; uploads: PersistedUploadState[] }

class UploadSync {
  private channel: BroadcastChannel | null = null
  private epoch = crypto.randomUUID()

  constructor() {
    if (typeof window === 'undefined') return
    if (typeof BroadcastChannel === 'undefined') return
    this.channel = new BroadcastChannel(CHANNEL_NAME)
    this.channel.onmessage = this.handleMessage
    sessionStorage.setItem(STORAGE_KEY, this.epoch)
    this.broadcast({ type: 'request-state', sourceEpoch: this.epoch })
  }

  private handleMessage = async (event: MessageEvent<SyncMessage>) => {
    const msg = event.data
    if (!msg) return

    if (msg.type === 'request-state' && msg.sourceEpoch !== this.epoch) {
      const uploads = await uploadDb.getAllUploads()
      this.broadcast({ type: 'state-snapshot', uploads })
    }
  }

  private broadcast(msg: SyncMessage): void {
    this.channel?.postMessage(msg)
  }

  notifyUpdate(uploadId: string): void {
    this.broadcast({ type: 'upload-updated', uploadId })
  }

  notifyRemove(uploadId: string): void {
    this.broadcast({ type: 'upload-removed', uploadId })
  }

  destroy(): void {
    this.channel?.close()
    this.channel = null
  }
}

export const uploadSync = new UploadSync()
