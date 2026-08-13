import { AUTH_ERROR_CODES, AuthError } from '@/services/auth/error'

/** User-facing error alert with title and localized message. */
export interface ApiErrorAlert {
  title: string
  message: string
}

/** Maps internal/auth errors into displayable alerts for the UI. */
export function mapErrorToAlert(error: unknown): ApiErrorAlert {
  if (error instanceof AuthError) {
    switch (error.code) {
      case AUTH_ERROR_CODES.CONFLICT:
        return {
          title: 'Account exists',
          message: 'An account with this email is already registered.',
        }
      case AUTH_ERROR_CODES.RATE_LIMITED:
        return { title: 'Too many attempts', message: 'Please wait a minute before trying again.' }
      case AUTH_ERROR_CODES.INVALID_CREDENTIALS:
        return {
          title: 'Invalid credentials',
          message: 'The email, password, or recovery key you entered is incorrect.',
        }
      case AUTH_ERROR_CODES.VALIDATION_ERROR:
        return { title: 'Validation failed', message: error.message }
      case AUTH_ERROR_CODES.SERVICE_UNAVAILABLE:
        return {
          title: 'Network error',
          message: 'Cannot connect to the server. Check your connection.',
        }
      default:
        return { title: 'Authentication error', message: error.message }
    }
  }
  return { title: 'Network error', message: 'An unexpected error occurred. Please try again.' }
}
