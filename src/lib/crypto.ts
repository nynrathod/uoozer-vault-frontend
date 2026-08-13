/**
 * Zero-Knowledge Cryptography Module (Main Thread Wrapper)
 *
 * All heavy cryptographic operations (Argon2id, XChaCha20, HKDF, key
 * generation, BLAKE hashing) run inside a dedicated Web Worker via Comlink
 * to keep the UI thread responsive.
 *
 * ## Zero-Knowledge Key Derivation Flow
 *
 * 1. **Argon2id** hashes the user password with a server-provided salt,
 *    producing a 64-byte master secret.
 * 2. **HKDF-SHA256** splits that secret into two independent 32-byte keys:
 *    - **Master Key** — never leaves the device; used to wrap/unwrap the
 *      per-account Data Encryption Key (DEK).
 *    - **Auth Key** — sent to the server (over TLS) to verify identity
 *      without ever revealing the password.
 * 3. The **DEK** is the symmetric key that actually encrypts/decrypts vault
 *    contents. It is wrapped (XChaCha20-Poly1305) with the Master Key
 *    before being stored on the server, ensuring the server never sees
 *    plaintext data.
 * 4. A **Recovery Key** follows the same HKDF split pattern, producing a
 *    separate recovery DEK wrap, so password reset is possible without the
 *    server learning any secrets.
 *
 * The server stores only wrapped keys and auth-key hashes — it can never
 * read user data.
 */

import * as Comlink from 'comlink'
import type { Argon2Params, CryptoApi, SignupCryptoBundle, WrappedKey } from '../lib/crypto-types'

const worker = new Worker(new URL('../workers/crypto.worker.ts', import.meta.url), {
  type: 'module',
})

worker.onerror = (e: ErrorEvent) => {}

worker.onmessageerror = (e) => {}
const cryptoApi = Comlink.wrap<CryptoApi>(worker)

/** Decoded JWT payload with standard registered claims. */
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

/** Decodes a JWT token's payload without verification (client-side only). */
export function decodeJwt<T = JwtPayload>(token: string): T {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }
  const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const payloadJson = atob(payloadB64)
  return JSON.parse(payloadJson) as T
}

/** Returns true if the JWT has expired or will expire within 5 seconds. */
export function isJwtExpired(token: string): boolean {
  try {
    const payload = decodeJwt(token)
    const now = Math.floor(Date.now() / 1000)
    return payload.exp <= now + 5
  } catch {
    return true
  }
}

/** Returns the absolute expiry timestamp (ms) of a JWT, or 0 if invalid. */
export function getJwtExpiry(token: string): number {
  try {
    const payload = decodeJwt(token)
    return payload.exp * 1000
  } catch {
    return 0
  }
}

export const initCrypto = async () => {
  try {
    const result = await cryptoApi.init()

    return result
  } catch (err) {
    if (err instanceof Error) {
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
export const blake3Hash = (d: Uint8Array) => cryptoApi.blake3Hash(d)
