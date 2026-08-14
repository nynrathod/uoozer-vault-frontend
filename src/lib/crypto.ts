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
import type {
  Argon2Params,
  CryptoApi,
  SignupCryptoBundle,
  WrappedKey,
  EncryptedMetadata,
  EncryptedChunkResult,
} from './crypto-types'

const worker = new Worker(new URL('../workers/crypto.worker.ts', import.meta.url), {
  type: 'module',
})

const cryptoApi = Comlink.wrap<CryptoApi>(worker)

// ── JWT Helpers ──────────────────────────────────────────────

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
  if (parts.length !== 3) throw new Error('Invalid JWT format')
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

// ── Crypto Re-exports ────────────────────────────────────────

export const initCrypto = () => cryptoApi.init()
export const bytesToBase64 = (b: Uint8Array) => cryptoApi.bytesToBase64(b)
export const base64ToBytes = (b: string) => cryptoApi.base64ToBytes(b)
export const deriveKeysFromPassword = (p: string, s: string, params: Argon2Params) =>
  cryptoApi.deriveKeysFromPassword(p, s, params)
export const generateDek = () => cryptoApi.generateDek()
export const wrapDek = (d: Uint8Array, k: Uint8Array) => cryptoApi.wrapDek(d, k)
export const unwrapDek = (w: WrappedKey, k: Uint8Array) => cryptoApi.unwrapDek(w, k)
export const generateKeyPair = () => cryptoApi.generateKeyPair()
export const zeroize = (...arrays: (Uint8Array | null | undefined)[]) => cryptoApi.zeroize(arrays)
export const generateSignupBundle = (p: string, s: string, params: Argon2Params) =>
  cryptoApi.generateSignupBundle(p, s, params)
export const bundleForSignupRequest = (bundle: SignupCryptoBundle, deviceName: string) =>
  cryptoApi.bundleForSignupRequest(bundle, deviceName)
export const deriveRecoveryAuthKey = (recoveryKey: Uint8Array) =>
  cryptoApi.deriveRecoveryAuthKey(recoveryKey)

// ── BLAKE3 (replaces blake2b) ────────────────────────────────

export const blake3Hash = (d: Uint8Array) => cryptoApi.blake3Hash(d)
export const blake3HashBytes = (d: Uint8Array) => cryptoApi.blake3HashBytes(d)

// ── Metadata Encryption (XChaCha20-Poly1305) ─────────────────

export const encryptMetadata = (
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<EncryptedMetadata> => cryptoApi.encryptMetadata(plaintext, key)

export const decryptMetadata = (
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array | null> => cryptoApi.decryptMetadata(ciphertext, nonce, key)

// ── File Streaming Encryption (secretstream) ─────────────────

export const initFileEncryption = (key: Uint8Array): Promise<Uint8Array> =>
  cryptoApi.initFileEncryption(key)

export const encryptFileChunk = (
  plaintext: Uint8Array,
  isFinal: boolean
): Promise<EncryptedChunkResult> => cryptoApi.encryptFileChunk(plaintext, isFinal)

export const initFileDecryption = (header: Uint8Array, key: Uint8Array): Promise<void> =>
  cryptoApi.initFileDecryption(header, key)

export const decryptFileChunk = (ciphertext: Uint8Array): Promise<Uint8Array> =>
  cryptoApi.decryptFileChunk(ciphertext)

export const cleanupFileStream = (): Promise<void> => cryptoApi.cleanupFileStream()

// ── High-level metadata helpers ──────────────────────────────

/** Encrypts a JSON-serializable metadata object and returns base64 strings for the API. */
export async function encryptMetadataObject(
  obj: Record<string, unknown>,
  dek: Uint8Array
): Promise<{ encryptedMetadata: string; metadataNonce: string }> {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(obj))
  const { ciphertext, nonce } = await encryptMetadata(jsonBytes, dek)
  const encryptedMetadata = await bytesToBase64(ciphertext)
  const metadataNonce = await bytesToBase64(nonce)
  return { encryptedMetadata, metadataNonce }
}

/** Decrypts a base64 metadata blob back into a typed object. */
export async function decryptMetadataObject<T = Record<string, unknown>>(
  encryptedMetadataB64: string,
  metadataNonceB64: string,
  dek: Uint8Array
): Promise<T | null> {
  const ciphertext = await base64ToBytes(encryptedMetadataB64)
  const nonce = await base64ToBytes(metadataNonceB64)
  const plaintext = await decryptMetadata(ciphertext, nonce, dek)
  if (!plaintext) return null
  const json = new TextDecoder().decode(plaintext)
  return JSON.parse(json) as T
}
