import { SSE_BASE_URL } from '@lib/constants'
import { tokenManager } from '@services/auth/tokenManager'

export class SSEService {
  private eventSource: EventSource | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Map<string, Set<(data: unknown) => void>>()

  connect() {
    const token = tokenManager.getAccessToken()
    if (!token) return

    this.disconnect()

    const url = new URL(`${SSE_BASE_URL}/events`)
    url.searchParams.set('token', token)

    this.eventSource = new EventSource(url.toString())

    this.eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const handlers = this.listeners.get(payload.type)
        if (handlers) {
          handlers.forEach((handler) => handler(payload.data))
        }
      } catch {
        // Ignore malformed events
      }
    }

    this.eventSource.onerror = () => {
      this.disconnect()
      this.reconnectTimer = setTimeout(() => this.connect(), 5000)
    }
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

  on(event: string, handler: (data: unknown) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: (data: unknown) => void) {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }
}

export const sseService = new SSEService()
