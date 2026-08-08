// ─── Error Codes (mirror backend) ──────────────────────────────────────────

export const AUTH_ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  REFRESH_TOKEN_REUSE: 'REFRESH_TOKEN_REUSE',
  DEVICE_REVOKED: 'DEVICE_REVOKED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES]

// ─── User-Friendly Messages ────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  BAD_REQUEST: 'The request was invalid. Please check your input.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  INVALID_REFRESH_TOKEN: 'Your session has expired. Please sign in again.',
  REFRESH_TOKEN_REUSE: 'Security alert: Your session was reused. Please sign in again.',
  DEVICE_REVOKED: 'This device has been revoked. Please sign in again.',
  UNAUTHORIZED: 'You need to sign in to continue.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'This email is already registered.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
}

// ─── Auth Error Class ──────────────────────────────────────────────────────

export class AuthError extends Error {
  readonly code: AuthErrorCode
  readonly statusCode: number
  readonly details?: string
  readonly shouldLogout: boolean
  readonly shouldRedirect: boolean

  constructor(
    code: AuthErrorCode,
    statusCode: number,
    options?: {
      message?: string
      details?: string
      shouldLogout?: boolean
      shouldRedirect?: boolean
    }
  ) {
    super(options?.message ?? ERROR_MESSAGES[code] ?? 'An unknown error occurred.')
    this.name = 'AuthError'
    this.code = code
    this.statusCode = statusCode
    this.details = options?.details
    this.shouldLogout = options?.shouldLogout ?? false
    this.shouldRedirect = options?.shouldRedirect ?? false

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AuthError.prototype)
  }
}

// ─── Error Factory ─────────────────────────────────────────────────────────

/**
 * Create an AuthError from an Axios/Fetch error response.
 * Centralizes the mapping of HTTP responses to typed errors.
 */
export function createAuthErrorFromResponse(
  statusCode: number,
  errorCode?: string,
  errorMessage?: string
): AuthError {
  const code = (errorCode as AuthErrorCode) ?? AUTH_ERROR_CODES.INTERNAL_ERROR
  const baseMessage = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR

  const shouldLogout =
    code === AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN ||
    code === AUTH_ERROR_CODES.REFRESH_TOKEN_REUSE ||
    code === AUTH_ERROR_CODES.DEVICE_REVOKED ||
    code === AUTH_ERROR_CODES.TOKEN_EXPIRED

  const shouldRedirect = shouldLogout

  return new AuthError(code, statusCode, {
    message: errorMessage ?? baseMessage,
    shouldLogout,
    shouldRedirect,
  })
}

/**
 * Create an AuthError from a network error (no response from server).
 */
export function createNetworkError(error: Error): AuthError {
  return new AuthError(AUTH_ERROR_CODES.SERVICE_UNAVAILABLE, 0, {
    message: 'Cannot connect to the server. Please check your internet connection.',
    details: error.message,
  })
}

/**
 * Create an AuthError for crypto failures.
 */
export function createCryptoError(message: string): AuthError {
  return new AuthError(AUTH_ERROR_CODES.INTERNAL_ERROR, 500, {
    message: 'A cryptographic operation failed. This should not happen — please report it.',
    details: message,
  })
}
