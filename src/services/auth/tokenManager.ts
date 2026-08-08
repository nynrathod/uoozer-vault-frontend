/**
 * Token Manager
 *
 * Storage strategy (industry best practice for SPAs):
 * - Access token:  Memory only (never persisted, never in localStorage)
 * - Refresh token: IndexedDB (survives page reload, isolated origin)
 * - Device ID:    localStorage (non-sensitive identifier)
 * - User email:   localStorage (for prelogin convenience on reload)
 *
 * On page reload:
 * 1. Check IndexedDB for refresh token
 * 2. If found, call /auth/refresh to get new access token
 * 3. Access token lives in memory for the session
 * 4. Master Key is NOT available (user must enter password to unlock vault)
 */

const DB_NAME = 'uoozer-vault'
const DB_VERSION = 1
const STORE_NAME = 'auth'
const REFRESH_TOKEN_KEY = 'refresh_token'
const WRAPPED_DEK_KEY = 'wrapped_dek'
const WRAPPED_DEK_NONCE_KEY = 'wrapped_dek_nonce'

const LS_DEVICE_ID = 'vault:device_id'
const LS_USER_EMAIL = 'vault:user_email'

// ─── In-Memory State (never persisted) ─────────────────────────────────────

let _accessToken: string | null = null
let _accessTokenExpiry: number = 0
let _refreshToken: string | null = null

// ─── IndexedDB Helper ──────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(key)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Fallback to localStorage if IndexedDB fails
    return localStorage.getItem(`idb_fallback:${key}`)
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    localStorage.removeItem(`idb_fallback:${key}`)
  }
}

// ─── localStorage Helpers (non-sensitive data) ─────────────────────────────

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage may be full or disabled
  }
}

function lsDelete(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export const tokenManager = {
  // ── Access Token (memory only) ──

  getAccessToken(): string | null {
    return _accessToken
  },

  setAccessToken(token: string, expiresIn: number): void {
    _accessToken = token
    _accessTokenExpiry = Date.now() + expiresIn * 1000
  },

  getAccessTokenExpiry(): number {
    return _accessTokenExpiry
  },

  isAccessTokenExpired(): boolean {
    if (!_accessToken) return true
    // Refresh 30 seconds before actual expiry
    return Date.now() >= _accessTokenExpiry - 30_000
  },

  // ── Refresh Token (IndexedDB) ──

  async setRefreshToken(token: string): Promise<void> {
    _refreshToken = token
    await idbSet(REFRESH_TOKEN_KEY, token)
  },

  async getRefreshToken(): Promise<string | null> {
    if (_refreshToken) return _refreshToken
    _refreshToken = await idbGet(REFRESH_TOKEN_KEY)
    return _refreshToken
  },

  // ── Wrapped DEK (IndexedDB — needed to unlock vault on same device) ──

  async setWrappedDek(wrappedDek: string, nonce: string): Promise<void> {
    await idbSet(WRAPPED_DEK_KEY, wrappedDek)
    await idbSet(WRAPPED_DEK_NONCE_KEY, nonce)
  },

  async getWrappedDek(): Promise<{ wrappedDek: string; nonce: string } | null> {
    const wrappedDek = await idbGet(WRAPPED_DEK_KEY)
    const nonce = await idbGet(WRAPPED_DEK_NONCE_KEY)
    if (!wrappedDek || !nonce) return null
    return { wrappedDek, nonce }
  },

  // ── Device ID (localStorage) ──

  getDeviceId(): string | null {
    return lsGet(LS_DEVICE_ID)
  },

  setDeviceId(deviceId: string): void {
    lsSet(LS_DEVICE_ID, deviceId)
  },

  // ── User Email (localStorage — for prelogin on reload) ──

  getUserEmail(): string | null {
    return lsGet(LS_USER_EMAIL)
  },

  setUserEmail(email: string): void {
    lsSet(LS_USER_EMAIL, email)
  },

  // ── Clear All ──

  async clearAll(): Promise<void> {
    _accessToken = null
    _accessTokenExpiry = 0
    _refreshToken = null

    await idbDelete(REFRESH_TOKEN_KEY)
    await idbDelete(WRAPPED_DEK_KEY)
    await idbDelete(WRAPPED_DEK_NONCE_KEY)

    lsDelete(LS_DEVICE_ID)
    lsDelete(LS_USER_EMAIL)
  },

  /** Clear only tokens (keep email + device for convenience). */
  async clearTokens(): Promise<void> {
    _accessToken = null
    _accessTokenExpiry = 0
    _refreshToken = null
    await idbDelete(REFRESH_TOKEN_KEY)
  },
}
