/** Argon2id KDF parameters from server. */
export interface Argon2Params {
  m_cost: number
  t_cost: number
  p_cost: number
  output_len: number
  algorithm: string
}

/** Master key + auth key derived from password. */
export interface DerivedKeys {
  masterKey: Uint8Array
  authKey: Uint8Array
}

/** XChaCha20-Poly1305 wrapped key material. */
export interface WrappedKey {
  ciphertext: Uint8Array
  nonce: Uint8Array
}

/** X25519 key pair. */
export interface KeyPair {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

/** Full signup crypto bundle. */
export interface SignupCryptoBundle {
  masterKey: Uint8Array
  authKey: Uint8Array
  dek: Uint8Array
  recoveryKey: Uint8Array
  recoveryAuthKey: Uint8Array
  wrappedDek: WrappedKey
  recoveryWrappedDek: WrappedKey
  identityKeyPair: KeyPair
  deviceKeyPair: KeyPair
  recoveryKeyDisplay: string
}

/** Result of encrypting a metadata blob. */
export interface EncryptedMetadata {
  ciphertext: Uint8Array
  nonce: Uint8Array
}

export interface EncryptedChunkResult {
  ciphertext: Uint8Array
  blake3Hash: Uint8Array
}

/** Web Worker crypto API surface. */
export interface CryptoApi {
  init(): Promise<void>

  // Base64 helpers
  bytesToBase64(bytes: Uint8Array): Promise<string>
  base64ToBytes(b64: string): Promise<Uint8Array>

  // Key derivation
  deriveKeysFromPassword(
    password: string,
    saltB64: string,
    params: Argon2Params
  ): Promise<DerivedKeys>
  deriveRecoveryAuthKey(recoveryKey: Uint8Array): Promise<Uint8Array>

  // DEK operations
  generateDek(): Promise<Uint8Array>
  wrapDek(dek: Uint8Array, key: Uint8Array): Promise<WrappedKey>
  unwrapDek(wrapped: WrappedKey, key: Uint8Array): Promise<Uint8Array | null>

  // Key pairs
  generateKeyPair(): Promise<KeyPair>

  // Metadata encryption (XChaCha20-Poly1305)
  encryptMetadata(plaintext: Uint8Array, key: Uint8Array): Promise<EncryptedMetadata>
  decryptMetadata(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array
  ): Promise<Uint8Array | null>

  // File streaming encryption (crypto_secretstream_xchacha20poly1305)
  initFileEncryption(key: Uint8Array): Promise<Uint8Array>
  encryptFileChunk(plaintext: Uint8Array, isFinal: boolean): Promise<EncryptedChunkResult>
  initFileDecryption(header: Uint8Array, key: Uint8Array): Promise<void>
  decryptFileChunk(ciphertext: Uint8Array): Promise<Uint8Array>
  cleanupFileStream(): Promise<void>

  // Hashing — BLAKE3 only (replaces blake2b)
  blake3Hash(data: Uint8Array): Promise<string>
  blake3HashBytes(data: Uint8Array): Promise<Uint8Array>

  // Security
  zeroize(arrays: (Uint8Array | null | undefined)[]): Promise<void>

  generateRecoveryKey(): Promise<{ key: Uint8Array; display: string }>

  // Signup bundle
  generateSignupBundle(
    password: string,
    saltB64: string,
    params: Argon2Params
  ): Promise<SignupCryptoBundle>
  bundleForSignupRequest(
    bundle: SignupCryptoBundle,
    deviceName: string
  ): Promise<{
    auth_key: string
    recovery_auth_key: string
    wrapped_dek: string
    wrapped_dek_nonce: string
    recovery_wrapped_dek: string
    recovery_wrapped_dek_nonce: string
    identity_pubkey: string
    device_pubkey: string
    device_name: string
  }>
}
