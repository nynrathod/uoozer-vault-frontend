/** Argon2id memory-hard KDF parameters returned by the server during prelogin. */
export interface Argon2Params {
  m_cost: number
  t_cost: number
  p_cost: number
  output_len: number
  algorithm: string
}

/** Master key (for decrypting vault data) and auth key (sent to server for verification). */
export interface DerivedKeys {
  masterKey: Uint8Array
  authKey: Uint8Array
}

/** XChaCha20-Poly1305 encrypted key material with associated nonce. */
export interface WrappedKey {
  ciphertext: Uint8Array
  nonce: Uint8Array
}

/** X25519 key pair used for device and identity encryption. */
export interface KeyPair {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

/** Full cryptographic bundle produced during signup key generation. */
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

/** Web Worker API surface exposed via Comlink for all cryptographic operations. */
export interface CryptoApi {
  init(): Promise<void>
  bytesToBase64(bytes: Uint8Array): Promise<string>
  base64ToBytes(b64: string): Promise<Uint8Array>
  deriveKeysFromPassword(
    password: string,
    saltB64: string,
    params: Argon2Params
  ): Promise<DerivedKeys>
  generateDek(): Promise<Uint8Array>
  wrapDek(dek: Uint8Array, key: Uint8Array): Promise<WrappedKey>
  unwrapDek(wrapped: WrappedKey, key: Uint8Array): Promise<Uint8Array | null>
  generateRecoveryKey(): Promise<{ key: Uint8Array; display: string }>
  deriveRecoveryAuthKey(recoveryKey: Uint8Array): Promise<Uint8Array>
  generateKeyPair(): Promise<KeyPair>
  blake2bHash(data: Uint8Array): Promise<string>
  blake3Hash(data: Uint8Array): Promise<string>
  zeroize(arrays: (Uint8Array | null | undefined)[]): Promise<void>
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
