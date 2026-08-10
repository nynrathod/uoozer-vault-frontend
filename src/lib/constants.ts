export const APP_NAME = 'Uoozer Vault'
export const APP_VERSION = '0.1.0'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
export const SSE_BASE_URL = import.meta.env.VITE_SSE_BASE_URL || 'http://localhost:8080'

export const STORAGE_KEYS = {
  THEME: 'vault:theme',
  ACCESS_TOKEN: 'vault:access_token',
  REFRESH_TOKEN: 'vault:refresh_token',
  DEVICE_ID: 'vault:device_id',
  USER_EMAIL: 'vault:user_email',
} as const

export const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB chunks
export const MAX_CONCURRENT_UPLOADS = 6
export const UPLOAD_RETRY_ATTEMPTS = 3
export const UPLOAD_RETRY_DELAY_MS = 2000

export const ACCEPTED_FILE_TYPES = {
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'],
  'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
  'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.ogg'],
  'application/pdf': ['.pdf'],
  'application/zip': ['.zip', '.rar', '.7z'],
} as const

export const FILE_TYPE_COLORS: Record<string, string> = {
  image: 'text-pink-500 bg-pink-500/10',
  video: 'text-rose-500 bg-rose-500/10',
  audio: 'text-amber-500 bg-amber-500/10',
  pdf: 'text-red-500 bg-red-500/10',
  archive: 'text-orange-500 bg-orange-500/10',
  code: 'text-emerald-500 bg-emerald-500/10',
  spreadsheet: 'text-green-500 bg-green-500/10',
  presentation: 'text-orange-500 bg-orange-500/10',
  document: 'text-blue-500 bg-blue-500/10',
  file: 'text-slate-500 bg-slate-500/10',
}

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  RECOVERY: '/recovery',
  UNLOCK: '/unlock',

  // Vault App
  VAULT: '/vault',
  VAULT_STARRED: '/vault/starred',
  VAULT_PRIVATE: '/vault/private',
  VAULT_TRASH: '/vault/trash',
  VAULT_FOLDER: '/vault/folder/:folderId',

  // Notes App
  NOTES: '/notes',
  NOTES_PINNED: '/notes/pinned',
  NOTES_TRASH: '/notes/trash',

  // Passwords App (New)
  PASSWORDS: '/passwords',
  PASSWORDS_FAVORITES: '/passwords/favorites',
  PASSWORDS_TRASH: '/passwords/trash',

  // System
  SETTINGS: '/settings',
  DEVICES: '/devices',
  AUDIT_LOGS: '/audit-logs',
} as const

export const QUERY_KEYS = {
  AUTH: {
    ME: 'auth:me',
    SESSIONS: 'auth:sessions',
    DEVICES: 'auth:devices',
  },
  FILES: {
    LIST: 'files:list',
    DETAIL: 'files:detail',
    VERSIONS: 'files:versions',
  },
  FOLDERS: {
    LIST: 'folders:list',
    TREE: 'folders:tree',
    DETAIL: 'folders:detail',
  },
  UPLOAD: {
    PRESIGNED: 'upload:presigned',
  },
} as const

export const SSE_EVENTS = {
  FILE_CREATED: 'file:created',
  FILE_UPDATED: 'file:updated',
  FILE_DELETED: 'file:deleted',
  FOLDER_CREATED: 'folder:created',
  FOLDER_UPDATED: 'folder:updated',
  FOLDER_DELETED: 'folder:deleted',
  DEVICE_ADDED: 'device:added',
  DEVICE_REMOVED: 'device:removed',
  SESSION_REVOKED: 'session:revoked',
} as const

export const TOAST_DURATION = 4000

export const API_V1 = '/api/v1'

export const AUTH_ENDPOINTS = {
  PRELOGIN: '/api/v1/auth/prelogin',
  SIGNUP_INIT: '/api/v1/auth/signup/init',
  SIGNUP_COMPLETE: '/api/v1/auth/signup/complete',
  LOGIN: '/api/v1/auth/login',
  REFRESH: '/api/v1/auth/refresh',
  LOGOUT: '/api/v1/auth/logout',
  PASSWORD_CHANGE: '/api/v1/auth/password',
  DEVICES: '/api/v1/devices',
  SESSIONS: '/api/v1/devices/sessions',
  SYNC_EVENTS: '/api/v1/sync/events',
  OAUTH_INIT: (provider: string) => `/api/v1/auth/oauth/${provider}/init`,
  OAUTH_CALLBACK: (provider: string) => `/api/v1/auth/oauth/${provider}/callback`,
} as const

export const OAUTH_REDIRECT_PATH = '/auth/oauth/callback'
