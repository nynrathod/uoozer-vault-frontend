/** Generic API envelope. */
export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
}

/** Structured error body returned by the backend. */
export interface ApiError {
  code: string
  message: string
  status: number
  details?: Record<string, string[]>
}

/** Paginated list response with metadata. */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

/** Extra options that can be passed alongside an API request. */
export interface ApiRequestConfig {
  skipAuth?: boolean
  retryCount?: number
  timeout?: number
}
