import { SSE_BASE_URL } from '@lib/constants'
import { tokenManager } from '@services/auth/tokenManager'
import { isJwtExpired } from '@lib/crypto'

type SseEventHandler = (data: unknown, seq: number) => void

class SSEService {
  private eventSource: EventSource | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private listeners = new Map<string, Set<SseEventHandler>>()
  private lastSeq = 0
  private channel: BroadcastChannel | null = null
  private isMasterTab = false

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('uoozer-vault-sse')
      this.channel.onmessage = (event) => {
        if (event.data?.type === 'request-master' && this.isMasterTab) {
          this.channel?.postMessage({ type: 'master-exists' })
        }
        if (event.data?.type === 'sse-event') {
          this.dispatch(event.data.payload, event.data.seq)
        }
      }
      window.addEventListener('beforeunload', () => {
        if (this.isMasterTab) {
          this.channel?.postMessage({ type: 'master-closed' })
        }
      })
    }
    window.addEventListener('online', () => this.connect())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.eventSource) this.connect()
    })
  }

  connect() {
    let token = tokenManager.getAccessToken()
    if (!token || isJwtExpired(token)) {
      setTimeout(() => this.connect(), 5000)
      return
    }

    if (this.channel && !this.isMasterTab) {
      this.channel.postMessage({ type: 'request-master' })
      setTimeout(() => {
        if (!this.isMasterTab && !this.eventSource) this.establishConnection()
      }, 500)
      return
    }
    this.establishConnection()
  }

  private establishConnection() {
    this.isMasterTab = true
    const token = tokenManager.getAccessToken()
    if (!token) return

    this.disconnect()

    // Fallback to window.location.origin if SSE_BASE_URL is empty
    const baseUrl = SSE_BASE_URL || window.location.origin
    const url = new URL(`${baseUrl}/api/v1/sync/events`)
    url.searchParams.set('token', token)

    this.eventSource = new EventSource(url.toString())

    this.eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const seq = payload.seq || 0
        if (seq <= this.lastSeq && seq !== 0) return
        if (seq > 0) this.lastSeq = seq

        if (this.channel) {
          this.channel.postMessage({ type: 'sse-event', payload, seq })
        }
        this.dispatch(payload, seq)
      } catch {}
    }

    this.eventSource.onerror = () => {
      this.disconnect()
      this.reconnectAttempts++
      const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts))
      this.reconnectTimer = setTimeout(() => this.connect(), delay)
    }

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0
    }
  }

  private dispatch(payload: any, seq: number) {
    const handlers = this.listeners.get(payload.type)
    if (handlers) handlers.forEach((h) => h(payload.data, seq))
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }

  on(event: string, handler: SseEventHandler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: SseEventHandler) {
    this.listeners.get(event)?.delete(handler)
  }
}

export const sseService = new SSEService()
