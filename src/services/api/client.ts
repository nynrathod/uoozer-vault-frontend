import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { API_BASE_URL } from '@lib/constants'
import { tokenManager } from '@services/auth/tokenManager'
import { authService } from '@services/auth/authService'
import type { AuthResponse } from '@/types/auth'
import { AUTH_ERROR_CODES, AuthError } from '../auth/error'

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenManager.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

let _isRefreshing = false
let _refreshPromise: Promise<AuthResponse> | null = null
let _failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

function processFailedQueue(token: string | null, error: unknown): void {
  _failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  _failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
      _skipAuthRefresh?: boolean
    }

    if (originalRequest._skipAuthRefresh || originalRequest._retry) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401) {
      if (originalRequest.url?.includes('/auth/refresh')) {
        await tokenManager.clearAll()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (_isRefreshing && _refreshPromise) {
        return new Promise((resolve, reject) => {
          _failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`
              }
              resolve(apiClient(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      _isRefreshing = true

      try {
        _refreshPromise = authService.refresh()
        const data = await _refreshPromise
        _isRefreshing = false
        _refreshPromise = null
        processFailedQueue(data.access_token, null)

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        }
        return apiClient(originalRequest)
      } catch (refreshError) {
        _isRefreshing = false
        _refreshPromise = null
        processFailedQueue(null, refreshError)

        await tokenManager.clearAll()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after']
      const authError = new AuthError(AUTH_ERROR_CODES.RATE_LIMITED, 429, {
        message: retryAfter
          ? `Too many attempts. Please wait ${retryAfter} seconds.`
          : 'Too many attempts. Please wait a moment.',
      })
      return Promise.reject(authError)
    }

    return Promise.reject(error)
  }
)

export function skipAuthRefresh(config: AxiosRequestConfig): AxiosRequestConfig {
  return { ...config, _skipAuthRefresh: true } as AxiosRequestConfig
}
