/**
 * Zero-Knowledge Cryptography Module (Main Thread Wrapper)
 *
 * Uses Vite's native Web Worker instantiation to run libsodium off the main UI thread.
 */

import * as Comlink from 'comlink'
import type { Argon2Params, CryptoApi, SignupCryptoBundle, WrappedKey } from '../lib/crypto-types'

console.log('[Main] Creating worker...')

console.log('Creating worker...')

const worker = new Worker(new URL('../workers/crypto.worker.ts', import.meta.url), {
  type: 'module',
})

console.log('Worker created')

console.log('[Main] Worker created')

worker.onerror = (e: ErrorEvent) => {
  console.error('========== WORKER ERROR ==========')
  console.error('message:', e.message)
  console.error('filename:', e.filename)
  console.error('line:', e.lineno)
  console.error('column:', e.colno)
  console.error('error:', e.error)
  console.error(e)
}

worker.onmessageerror = (e) => {
  console.error('[Main] Worker message error:', e)
}
const cryptoApi = Comlink.wrap<CryptoApi>(worker)

// ─── JWT Helpers (Stay on main thread, they are pure JS and instant) ──────

export interface JwtPayload {
  sub: string
  sid: string
  did: string
  exp: number
  iat: number
  iss: string
  typ: string
  jti?: string
}

export function decodeJwt<T = JwtPayload>(token: string): T {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }
  const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const payloadJson = atob(payloadB64)
  return JSON.parse(payloadJson) as T
}

export function isJwtExpired(token: string): boolean {
  try {
    const payload = decodeJwt(token)
    const now = Math.floor(Date.now() / 1000)
    return payload.exp <= now + 5
  } catch {
    return true
  }
}

export function getJwtExpiry(token: string): number {
  try {
    const payload = decodeJwt(token)
    return payload.exp * 1000
  } catch {
    return 0
  }
}

// ─── Proxy API ─────────────────────────────────────────────────────────────
export const initCrypto = async () => {
  console.log('[initCrypto] Starting cryptoApi.init()')

  try {
    const result = await cryptoApi.init()
    console.log('[initCrypto] cryptoApi.init() completed successfully')

    return result
  } catch (err) {
    console.error('[initCrypto] cryptoApi.init() failed:', err)

    if (err instanceof Error) {
      console.error('[initCrypto] Message:', err.message)
      console.error('[initCrypto] Stack:', err.stack)
    }

    throw err
  }
}
export const bytesToBase64 = (b: Uint8Array) => cryptoApi.bytesToBase64(b)
export const base64ToBytes = (b: string) => cryptoApi.base64ToBytes(b)
export const deriveKeysFromPassword = (p: string, s: string, params: Argon2Params) =>
  cryptoApi.deriveKeysFromPassword(p, s, params)
export const generateDek = () => cryptoApi.generateDek()
export const wrapDek = (d: Uint8Array, k: Uint8Array) => cryptoApi.wrapDek(d, k)
export const unwrapDek = (w: WrappedKey, k: Uint8Array) => cryptoApi.unwrapDek(w, k)
export const generateKeyPair = () => cryptoApi.generateKeyPair()
export const blake2bHash = (d: Uint8Array) => cryptoApi.blake2bHash(d)
export const zeroize = (...arrays: (Uint8Array | null | undefined)[]) => cryptoApi.zeroize(arrays)
export const generateSignupBundle = (p: string, s: string, params: Argon2Params) =>
  cryptoApi.generateSignupBundle(p, s, params)
export const bundleForSignupRequest = (bundle: SignupCryptoBundle, deviceName: string) =>
  cryptoApi.bundleForSignupRequest(bundle, deviceName)
export const deriveRecoveryAuthKey = (recoveryKey: Uint8Array) =>
  cryptoApi.deriveRecoveryAuthKey(recoveryKey)
