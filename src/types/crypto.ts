export interface MasterKeyBundle {
  masterKey: Uint8Array
  authKey: Uint8Array
}

export interface DekBundle {
  dek: Uint8Array
  wrappedDek: {
    ciphertext: Uint8Array
    nonce: Uint8Array
  }
}

export interface EncryptedFileHeader {
  header: Uint8Array
  key: Uint8Array
}

export interface EncryptedChunk {
  ciphertext: Uint8Array
  tag: Uint8Array
}

export interface CryptoState {
  isReady: boolean
  masterKey: Uint8Array | null
  dek: Uint8Array | null
  recoveryKey: Uint8Array | null
}
