const DB_NAME = 'uoozer-vault'
const DB_VERSION = 1
const STORE_NAME = 'auth'
const REFRESH_TOKEN_KEY = 'refresh_token'
const WRAPPED_DEK_KEY = 'wrapped_dek'
const WRAPPED_DEK_NONCE_KEY = 'wrapped_dek_nonce'
const DEVICE_KEY = 'device_key'
const DEVICE_WRAPPED_DEK_KEY = 'device_wrapped_dek'
const DEVICE_WRAPPED_DEK_NONCE_KEY = 'device_wrapped_dek_nonce'

const LS_HAS_SESSION = 'vault:has_session'
const LS_DEVICE_ID = 'vault:device_id'
const LS_USER_EMAIL = 'vault:user_email'

let _accessToken: string | null = null
let _accessTokenExpiry: number = 0

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB not available'))
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
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
    return null
  }
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

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
    /* ignore */
  }
}
function lsDelete(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/**
 * Persists auth tokens and crypto material across storage backends.
 *
 * - Access token: in-memory only (never persisted to disk).
 * - Refresh token, wrapped DEK, device keys: IndexedDB.
 * - UI flags (hasSession, deviceId, userEmail): localStorage.
 */
export const tokenManager = {
  getAccessToken(): string | null {
    return _accessToken
  },
  setAccessToken(token: string, expiresIn: number): void {
    _accessToken = token
    _accessTokenExpiry = Date.now() + expiresIn * 1000
  },
  /** Returns true 30 seconds before actual expiry to allow proactive refresh. */
  isAccessTokenExpired(): boolean {
    if (!_accessToken) return true
    return Date.now() >= _accessTokenExpiry - 30_000
  },

  setRefreshToken: (token: string) => idbSet(REFRESH_TOKEN_KEY, token),
  getRefreshToken: () => idbGet(REFRESH_TOKEN_KEY),

  setWrappedDek: (wrappedDek: string, nonce: string) =>
    Promise.all([idbSet(WRAPPED_DEK_KEY, wrappedDek), idbSet(WRAPPED_DEK_NONCE_KEY, nonce)]),
  getWrappedDek: async () => {
    const w = await idbGet(WRAPPED_DEK_KEY)
    const n = await idbGet(WRAPPED_DEK_NONCE_KEY)
    return w && n ? { wrappedDek: w, nonce: n } : null
  },

  setDeviceKey: (key: string) => idbSet(DEVICE_KEY, key),
  getDeviceKey: () => idbGet(DEVICE_KEY),

  setDeviceWrappedDek: (wrappedDek: string, nonce: string) =>
    Promise.all([
      idbSet(DEVICE_WRAPPED_DEK_KEY, wrappedDek),
      idbSet(DEVICE_WRAPPED_DEK_NONCE_KEY, nonce),
    ]),
  getDeviceWrappedDek: async () => {
    const w = await idbGet(DEVICE_WRAPPED_DEK_KEY)
    const n = await idbGet(DEVICE_WRAPPED_DEK_NONCE_KEY)
    return w && n ? { wrappedDek: w, nonce: n } : null
  },

  setHasSession: (val: boolean) => lsSet(LS_HAS_SESSION, val ? 'true' : 'false'),
  getHasSession: () => lsGet(LS_HAS_SESSION) === 'true',

  getDeviceId: () => lsGet(LS_DEVICE_ID),
  setDeviceId: (id: string) => lsSet(LS_DEVICE_ID, id),

  getUserEmail: () => lsGet(LS_USER_EMAIL),
  setUserEmail: (email: string) => lsSet(LS_USER_EMAIL, email),

  clearAll: async () => {
    _accessToken = null
    _accessTokenExpiry = 0

    await idbDelete(REFRESH_TOKEN_KEY)
    await idbDelete(WRAPPED_DEK_KEY)
    await idbDelete(WRAPPED_DEK_NONCE_KEY)
    await idbDelete(DEVICE_KEY)
    await idbDelete(DEVICE_WRAPPED_DEK_KEY)
    await idbDelete(DEVICE_WRAPPED_DEK_NONCE_KEY)

    lsDelete(LS_HAS_SESSION)
    lsDelete(LS_DEVICE_ID)
    lsDelete(LS_USER_EMAIL)

    // Also clean up keys that were previously stored in localStorage
    lsDelete('vault:device_key')
    lsDelete('vault:device_wrapped_dek')
    lsDelete('vault:device_wrapped_dek_nonce')
    lsDelete('vault:wrapped_dek')
    lsDelete('vault:wrapped_dek_nonce')
    lsDelete('vault:refresh_token')
  },
}
