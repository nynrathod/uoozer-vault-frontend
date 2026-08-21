type NetworkListener = (online: boolean) => void

class NetworkMonitor {
  private listeners = new Set<NetworkListener>()
  private _online = navigator.onLine
  private _lastChangedAt = Date.now()

  get isOnline(): boolean {
    return this._online
  }

  get lastChangedAt(): number {
    return this._lastChangedAt
  }

  constructor() {
    if (typeof window === 'undefined') return
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
  }

  private handleOnline = () => {
    this._online = true
    this._lastChangedAt = Date.now()
    this.listeners.forEach((l) => l(true))
  }

  private handleOffline = () => {
    this._online = false
    this._lastChangedAt = Date.now()
    this.listeners.forEach((l) => l(false))
  }

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  destroy(): void {
    if (typeof window === 'undefined') return
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    this.listeners.clear()
  }
}

export const networkMonitor = new NetworkMonitor()
