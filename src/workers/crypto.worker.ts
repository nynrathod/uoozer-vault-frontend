/// <reference lib="webworker" />

import * as Comlink from 'comlink'
import * as _sodiumModule from 'libsodium-wrappers'
import { createBLAKE3 } from 'hash-wasm'

import type {
  Argon2Params,
  CryptoApi,
  DerivedKeys,
  SignupCryptoBundle,
  WrappedKey,
  KeyPair,
  EncryptedMetadata,
  EncryptedChunkResult,
} from '../lib/crypto-types'

let sodium: any = null
let _initialized = false
let _blake3Instance: any = null

let _encryptState: any = null
let _decryptState: any = null

async function initCrypto(): Promise<void> {
  if (_initialized) return
  await _sodiumModule.ready
  sodium = (_sodiumModule as any).default || _sodiumModule

  _blake3Instance = await createBLAKE3()

  _initialized = true
}

function assertReady(): void {
  if (!_initialized || !sodium || !_blake3Instance) {
    throw new Error('Crypto not initialized. Call initCrypto() first.')
  }
}

const api: CryptoApi = {
  async init() {
    await initCrypto()
  },

  // ── Base64 ──────────────────────────────────────────────────

  async bytesToBase64(bytes: Uint8Array): Promise<string> {
    assertReady()
    return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL)
  },

  async base64ToBytes(b64: string): Promise<Uint8Array> {
    assertReady()
    return sodium.from_base64(b64, sodium.base64_variants.ORIGINAL)
  },

  // ── Key Derivation ──────────────────────────────────────────

  async deriveKeysFromPassword(
    password: string,
    saltB64: string,
    params: Argon2Params
  ): Promise<DerivedKeys> {
    assertReady()
    const salt = await this.base64ToBytes(saltB64)

    // Import argon2id lazily to keep initial load fast
    const { argon2id } = await import('hash-wasm')

    const masterKey = await argon2id({
      password,
      salt,
      parallelism: params.p_cost,
      iterations: params.t_cost,
      memorySize: params.m_cost,
      hashLength: params.output_len,
      outputType: 'binary',
    })

    // Derive auth key from master key via HKDF-like KDF
    const authKey = sodium.crypto_kdf_derive_from_key(32, 1, 'UoozerAu', masterKey)

    return { masterKey, authKey }
  },

  async deriveRecoveryAuthKey(recoveryKey: Uint8Array): Promise<Uint8Array> {
    assertReady()
    return sodium.crypto_generichash(32, recoveryKey, null)
  },

  // ── DEK Operations ──────────────────────────────────────────

  async generateDek(): Promise<Uint8Array> {
    assertReady()
    return sodium.randombytes_buf(32)
  },

  async wrapDek(dek: Uint8Array, key: Uint8Array): Promise<WrappedKey> {
    assertReady()
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      dek,
      null,
      null,
      nonce,
      key
    )
    return { ciphertext, nonce }
  },

  async unwrapDek(wrapped: WrappedKey, key: Uint8Array): Promise<Uint8Array | null> {
    assertReady()
    try {
      return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        wrapped.ciphertext,
        null,
        wrapped.nonce,
        key
      )
    } catch {
      return null
    }
  },

  // ── Key Pairs ───────────────────────────────────────────────

  async generateKeyPair(): Promise<KeyPair> {
    assertReady()
    return sodium.crypto_sign_keypair()
  },

  // ── Metadata Encryption (XChaCha20-Poly1305) ────────────────

  async encryptMetadata(plaintext: Uint8Array, key: Uint8Array): Promise<EncryptedMetadata> {
    assertReady()
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      null,
      null,
      nonce,
      key
    )
    return Comlink.transfer({ ciphertext, nonce }, [ciphertext.buffer, nonce.buffer])
  },

  async decryptMetadata(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array
  ): Promise<Uint8Array | null> {
    assertReady()
    try {
      const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertext,
        null,
        nonce,
        key
      )
      return Comlink.transfer(plaintext, [plaintext.buffer])
    } catch {
      return null
    }
  },

  // ── File Streaming Encryption (secretstream) ────────────────

  async initFileEncryption(key: Uint8Array): Promise<Uint8Array> {
    assertReady()
    const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key)
    _encryptState = state
    return Comlink.transfer(header, [header.buffer])
  },

  async encryptFileChunk(plaintext: Uint8Array, isFinal: boolean): Promise<EncryptedChunkResult> {
    assertReady()
    if (!_encryptState) throw new Error('Encryption stream not initialized')

    const tag = isFinal
      ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
      : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE

    const ciphertext = sodium.crypto_secretstream_xchacha20poly1305_push(
      _encryptState,
      plaintext,
      null,
      tag
    )

    // Compute BLAKE3 hash of the ciphertext INSIDE the worker before transferring
    _blake3Instance.init()
    _blake3Instance.update(ciphertext)
    const hex = _blake3Instance.digest(32, 'hex')

    if (!hex || hex.length !== 64) {
      throw new Error('BLAKE3 hash failed: invalid hex length')
    }
    const blake3Hash = sodium.from_hex(hex)

    if (isFinal) {
      _encryptState = null
    }

    return Comlink.transfer({ ciphertext, blake3Hash }, [ciphertext.buffer, blake3Hash.buffer])
  },

  async initFileDecryption(header: Uint8Array, key: Uint8Array): Promise<void> {
    assertReady()
    _decryptState = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, key)
  },

  async decryptFileChunk(ciphertext: Uint8Array): Promise<Uint8Array> {
    assertReady()
    if (!_decryptState) throw new Error('Decryption stream not initialized')

    const { message } = sodium.crypto_secretstream_xchacha20poly1305_pull(
      _decryptState,
      ciphertext,
      null
    )

    return Comlink.transfer(message, [message.buffer])
  },

  async cleanupFileStream(): Promise<void> {
    _encryptState = null
    _decryptState = null
  },

  // ── BLAKE3 Hashing (replaces blake2b entirely) ──────────────

  async blake3Hash(data: Uint8Array): Promise<string> {
    assertReady()
    _blake3Instance.init()
    _blake3Instance.update(data)
    return _blake3Instance.digest(32, 'hex')
  },

  async blake3HashBytes(data: Uint8Array): Promise<Uint8Array> {
    assertReady()
    _blake3Instance.init()
    _blake3Instance.update(data)
    const hex = _blake3Instance.digest(32, 'hex')

    if (!hex || hex.length !== 64) {
      throw new Error('BLAKE3 hash failed: invalid hex length')
    }
    return sodium.from_hex(hex)
  },

  // ── Security ────────────────────────────────────────────────

  async zeroize(arrays: (Uint8Array | null | undefined)[]): Promise<void> {
    for (const arr of arrays) {
      if (arr) arr.fill(0)
    }
  },

  // ── Signup Bundle ───────────────────────────────────────────

  async generateSignupBundle(
    password: string,
    saltB64: string,
    params: Argon2Params
  ): Promise<SignupCryptoBundle> {
    assertReady()

    const { masterKey, authKey } = await this.deriveKeysFromPassword(password, saltB64, params)
    const dek = await this.generateDek()
    const { key: recoveryKey, display: recoveryKeyDisplay } = await this.generateRecoveryKey()
    const recoveryAuthKey = await this.deriveRecoveryAuthKey(recoveryKey)

    const wrappedDek = await this.wrapDek(dek, masterKey)
    const recoveryWrappedDek = await this.wrapDek(dek, recoveryKey)

    const identityKeyPair = await this.generateKeyPair()
    const deviceKeyPair = await this.generateKeyPair()

    return {
      masterKey,
      authKey,
      dek,
      recoveryKey,
      recoveryAuthKey,
      wrappedDek,
      recoveryWrappedDek,
      identityKeyPair,
      deviceKeyPair,
      recoveryKeyDisplay,
    }
  },

  async generateRecoveryKey(): Promise<{ key: Uint8Array; display: string }> {
    assertReady()
    const key = sodium.randombytes_buf(32)
    const hex = Array.from(key)
      .map((b) => (b as number).toString(16).padStart(2, '0'))
      .join('')
    const display = hex.match(/.{1,8}/g)?.join('-') ?? hex
    return { key, display }
  },

  async bundleForSignupRequest(bundle: SignupCryptoBundle, deviceName: string) {
    return {
      auth_key: await this.bytesToBase64(bundle.authKey),
      recovery_auth_key: await this.bytesToBase64(bundle.recoveryAuthKey),
      wrapped_dek: await this.bytesToBase64(bundle.wrappedDek.ciphertext),
      wrapped_dek_nonce: await this.bytesToBase64(bundle.wrappedDek.nonce),
      recovery_wrapped_dek: await this.bytesToBase64(bundle.recoveryWrappedDek.ciphertext),
      recovery_wrapped_dek_nonce: await this.bytesToBase64(bundle.recoveryWrappedDek.nonce),
      identity_pubkey: await this.bytesToBase64(bundle.identityKeyPair.publicKey),
      device_pubkey: await this.bytesToBase64(bundle.deviceKeyPair.publicKey),
      device_name: deviceName,
    }
  },
}

Comlink.expose(api)
