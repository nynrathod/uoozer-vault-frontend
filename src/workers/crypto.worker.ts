/// <reference lib="webworker" />

import type {
  Argon2Params,
  CryptoApi,
  DerivedKeys,
  SignupCryptoBundle,
  WrappedKey,
  KeyPair,
} from '../lib/crypto-types'

import * as Comlink from 'comlink'
import * as _sodiumModule from 'libsodium-wrappers'

// ─── FIX: the live exports object with all crypto functions is on .default ──
let sodium: any = null
let _initialized = false

async function initCrypto(): Promise<void> {
  if (_initialized) return
  await _sodiumModule.ready
  sodium = (_sodiumModule as any).default || _sodiumModule
  _initialized = true
}

function assertReady(): void {
  if (!_initialized || !sodium) {
    throw new Error('Crypto not initialized. Call initCrypto() first.')
  }
}

const api: CryptoApi = {
  async init() {
    await initCrypto()
  },

  async bytesToBase64(bytes: Uint8Array): Promise<string> {
    assertReady()
    return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL)
  },

  async base64ToBytes(b64: string): Promise<Uint8Array> {
    assertReady()
    return sodium.from_base64(b64, sodium.base64_variants.ORIGINAL)
  },

  async deriveKeysFromPassword(
    password: string,
    saltB64: string,
    params: Argon2Params
  ): Promise<DerivedKeys> {
    assertReady()

    const salt = await this.base64ToBytes(saltB64)
    const memLimit = params.m_cost * 1024
    const opsLimit = params.t_cost

    const masterKey = sodium.crypto_pwhash(
      32,
      password,
      salt,
      opsLimit,
      memLimit,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    )

    const authKey = sodium.crypto_kdf_derive_from_key(32, 1, 'Uoozer_Auth', masterKey)

    return { masterKey, authKey }
  },

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

  async generateRecoveryKey(): Promise<{ key: Uint8Array; display: string }> {
    assertReady()
    const key = sodium.randombytes_buf(32)
    const hex = Array.from(key)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const display = hex.match(/.{1,8}/g)?.join('-') ?? hex
    return { key, display }
  },

  async deriveRecoveryAuthKey(recoveryKey: Uint8Array): Promise<Uint8Array> {
    assertReady()
    return sodium.crypto_generichash(32, recoveryKey, null)
  },

  async generateKeyPair(): Promise<KeyPair> {
    assertReady()
    return sodium.crypto_sign_keypair()
  },

  async blake2bHash(data: Uint8Array): Promise<string> {
    assertReady()
    const hash = sodium.crypto_generichash(32, data, null)
    return this.bytesToBase64(hash)
  },

  async zeroize(arrays: (Uint8Array | null | undefined)[]): Promise<void> {
    for (const arr of arrays) {
      if (arr) arr.fill(0)
    }
  },

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
