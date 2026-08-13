/** Master key paired with its derived auth key. */
export interface MasterKeyBundle {
  masterKey: Uint8Array
  authKey: Uint8Array
}

/** Data Encryption Key (DEK) and its XChaCha20-Poly1305 ciphertext under a wrapping key. */
export interface DekBundle {
  dek: Uint8Array
  wrappedDek: {
    ciphertext: Uint8Array
    nonce: Uint8Array
  }
}

/** Per-file symmetric header used to derive chunk-level encryption keys. */
export interface EncryptedFileHeader {
  header: Uint8Array
  key: Uint8Array
}

/** Single encrypted chunk with its AEAD authentication tag. */
export interface EncryptedChunk {
  ciphertext: Uint8Array
  tag: Uint8Array
}

/** Tracks in-memory crypto state including an optional recovery key during account recovery. */
export interface CryptoState {
  isReady: boolean
  masterKey: Uint8Array | null
  dek: Uint8Array | null
  recoveryKey: Uint8Array | null
}
