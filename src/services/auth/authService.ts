import { apiClient } from '@services/api/client'
import { tokenManager } from './tokenManager'
import {
  initCrypto,
  deriveKeysFromPassword,
  generateSignupBundle,
  bundleForSignupRequest,
  generateKeyPair,
  bytesToBase64,
  decodeJwt,
  wrapDek,
  zeroize,
  deriveRecoveryAuthKey,
  unwrapDek,
  base64ToBytes,
} from '@lib/crypto'

import type {
  PreloginResponse,
  SignupInitResponse,
  SignupCompleteRequest,
  LoginRequest,
  AuthResponse,
  Device,
  Session,
  LoginCredentials,
  SignupCredentials,
  Argon2Params,
} from '@/types/auth'
import {
  AuthError,
  AUTH_ERROR_CODES,
  createNetworkError,
  createAuthErrorFromResponse,
} from './error'
import type { SignupCryptoBundle } from '@/lib/crypto-types'

/** Handles authentication flows including signup, login, token refresh, and account recovery. */
class AuthService {
  private _cryptoInitialized = false
  async ensureCryptoReady(): Promise<void> {
    if (!this._cryptoInitialized) {
      try {
        await initCrypto()

        this._cryptoInitialized = true
      } catch (err) {
        if (err instanceof Error) {
        }

        throw err
      }
    } else {
    }
  }

  async prelogin(email: string): Promise<PreloginResponse> {
    try {
      const { data } = await apiClient.post('/api/v1/auth/prelogin', { email })
      return data
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  async signupInit(email: string): Promise<SignupInitResponse> {
    try {
      const { data } = await apiClient.post('/api/v1/auth/signup/init', { email })
      return data
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  async signupComplete(
    credentials: SignupCredentials,
    bundle: SignupCryptoBundle,
    signupToken: string
  ): Promise<{
    tokens: AuthResponse
    recoveryKeyDisplay: string
    cryptoBundle: SignupCryptoBundle
  }> {
    await this.ensureCryptoReady()

    const requestBody: SignupCompleteRequest = {
      signup_token: signupToken,
      full_name: credentials.fullName,
      ...(await bundleForSignupRequest(bundle, credentials.deviceName || 'Web Browser')),
    }

    try {
      const { data } = await apiClient.post('/api/v1/auth/signup/complete', requestBody)

      await tokenManager.setAccessToken(data.access_token, data.expires_in)
      await tokenManager.setRefreshToken(data.refresh_token)

      await tokenManager.setWrappedDek(
        await bytesToBase64(bundle.wrappedDek.ciphertext),
        await bytesToBase64(bundle.wrappedDek.nonce)
      )

      tokenManager.setUserEmail(credentials.email)
      tokenManager.setHasSession(true)
      const claims = decodeJwt(data.access_token)
      tokenManager.setDeviceId(claims.did)

      // Zeroize auth keys — they are no longer needed client-side after being sent to the server
      await zeroize(bundle.authKey, bundle.recoveryAuthKey)

      return {
        tokens: data,
        recoveryKeyDisplay: bundle.recoveryKeyDisplay,
        cryptoBundle: bundle,
      }
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  async signup(credentials: SignupCredentials): Promise<{
    tokens: AuthResponse
    recoveryKeyDisplay: string
    cryptoBundle: SignupCryptoBundle
  }> {
    await this.ensureCryptoReady()

    const initResp = await this.signupInit(credentials.email)

    const bundle = await generateSignupBundle(
      credentials.password || '',
      initResp.salt,
      initResp.argon2_params
    )
    return this.signupComplete(credentials, bundle, initResp.signup_token)
  }

  async login(credentials: LoginCredentials): Promise<{
    tokens: AuthResponse
    masterKey: Uint8Array | null
  }> {
    await this.ensureCryptoReady()

    const preloginResp = await this.prelogin(credentials.email)

    let authKeyB64: string
    let masterKey: Uint8Array | null = null

    if (credentials.authKey) {
      // Recovery flow: use the pre-derived auth key instead of a password
      authKeyB64 = credentials.authKey
    } else {
      // Normal flow: derive master key and auth key from password via Argon2id
      const { masterKey: mk, authKey } = await deriveKeysFromPassword(
        credentials.password || '',
        preloginResp.salt,
        preloginResp.argon2_params
      )
      masterKey = mk
      authKeyB64 = await bytesToBase64(authKey)
      await zeroize(authKey)
    }

    const deviceKeyPair = await generateKeyPair()
    const devicePubKeyB64 = await bytesToBase64(deviceKeyPair.publicKey)

    const loginReq: LoginRequest = {
      email: credentials.email,
      auth_key: authKeyB64,
      device_pubkey: devicePubKeyB64,
      device_name: 'Web Browser',
      device_id: tokenManager.getDeviceId() ?? undefined,
    }

    try {
      const { data } = await apiClient.post('/api/v1/auth/login', loginReq)

      await tokenManager.setAccessToken(data.access_token, data.expires_in)
      await tokenManager.setRefreshToken(data.refresh_token)
      tokenManager.setUserEmail(credentials.email)
      tokenManager.setHasSession(true)
      const claims = decodeJwt(data.access_token)
      tokenManager.setDeviceId(claims.did)

      return { tokens: data, masterKey }
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  /** Exchanges a stored refresh token for a new access/refresh pair. */
  async refresh(): Promise<AuthResponse> {
    const refreshToken = await tokenManager.getRefreshToken()
    if (!refreshToken) {
      throw new AuthError(AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN, 401, {
        shouldLogout: true,
        shouldRedirect: true,
      })
    }

    try {
      const { data } = await apiClient.post('/api/v1/auth/refresh', {
        refresh_token: refreshToken,
      })

      tokenManager.setAccessToken(data.access_token, data.expires_in)
      await tokenManager.setRefreshToken(data.refresh_token)

      return data
    } catch (error: any) {
      if (error?.response?.status === 401) {
        await tokenManager.clearAll()
      }
      throw this._handleError(error)
    }
  }

  async logout(revokeDevice = false): Promise<void> {
    const refreshToken = await tokenManager.getRefreshToken()
    const accessToken = tokenManager.getAccessToken()

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          revoke_device: revokeDevice,
          refresh_token: refreshToken,
        }),
      })
    } catch (error) {
      console.warn('[AuthService] Logout fetch failed (network error), proceeding anyway.', error)
    } finally {
      await tokenManager.clearAll()
    }
  }

  async changePassword(
    newPassword: string,
    currentSalt: string,
    currentArgonParams: Argon2Params,
    dek: Uint8Array
  ): Promise<{ wrapped_dek: string; wrapped_dek_nonce: string }> {
    await this.ensureCryptoReady()

    const { masterKey: newMasterKey, authKey: newAuthKey } = await deriveKeysFromPassword(
      newPassword,
      currentSalt,
      currentArgonParams
    )

    const newWrappedDek = await wrapDek(dek, newMasterKey)
    const newAuthKeyB64 = await bytesToBase64(newAuthKey)
    const newWrappedDekB64 = await bytesToBase64(newWrappedDek.ciphertext)
    const newWrappedDekNonceB64 = await bytesToBase64(newWrappedDek.nonce)

    await zeroize(newMasterKey, newAuthKey, newWrappedDek.ciphertext)

    try {
      await apiClient.post('/api/v1/auth/password', {
        new_auth_key: newAuthKeyB64,
        new_wrapped_dek: newWrappedDekB64,
        new_wrapped_dek_nonce: newWrappedDekNonceB64,
      })

      return { wrapped_dek: newWrappedDekB64, wrapped_dek_nonce: newWrappedDekNonceB64 }
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  async getDevices(): Promise<Device[]> {
    try {
      const { data } = await apiClient.get('/api/v1/devices')
      return data
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  async getSessions(): Promise<Session[]> {
    try {
      const { data } = await apiClient.get('/api/v1/devices/sessions')
      return data
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  async revokeDevice(deviceId: string): Promise<void> {
    try {
      await apiClient.post(`/api/v1/devices/${deviceId}/revoke`)
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  async updateDeviceName(deviceId: string, name: string): Promise<void> {
    try {
      await apiClient.patch(`/api/v1/devices/${deviceId}`, { device_name: name })
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  async hasValidSession(): Promise<boolean> {
    const refreshToken = await tokenManager.getRefreshToken()
    if (!refreshToken) return false

    try {
      const claims = decodeJwt(refreshToken)
      const now = Math.floor(Date.now() / 1000)
      return claims.exp > now
    } catch {
      return false
    }
  }

  /** Restores a session from storage without requiring user interaction. */
  async tryRestoreSession(): Promise<boolean> {
    // Return immediately if the in-memory access token is still valid (e.g. HMR reload)
    if (tokenManager.getAccessToken() && !tokenManager.isAccessTokenExpired()) {
      return true
    }

    // Otherwise try to refresh using the persisted refresh token
    const hasSession = await this.hasValidSession()
    if (!hasSession) {
      return false
    }

    try {
      await this.refresh()
      return true
    } catch {
      return false
    }
  }

  private _handleError(error: any): AuthError {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return new AuthError(AUTH_ERROR_CODES.SERVICE_UNAVAILABLE, 0, {
          message: 'Request timed out. Please try again.',
        })
      }
      return createNetworkError(error)
    }

    const { status, data } = error.response
    const errorCode = data?.error?.code
    const errorMessage = data?.error?.message

    return createAuthErrorFromResponse(status, errorCode, errorMessage)
  }

  async getKeys(): Promise<{
    wrapped_dek: string
    wrapped_dek_nonce: string
    recovery_wrapped_dek: string
    recovery_wrapped_dek_nonce: string
  }> {
    try {
      const { data } = await apiClient.get('/api/v1/auth/keys')
      return data
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  /** Verifies a recovery key by logging in and attempting to decrypt the stored DEK. */
  async verifyRecoveryKey(
    email: string,
    recoveryKey: Uint8Array
  ): Promise<{ dek: Uint8Array; tokens: AuthResponse }> {
    await this.ensureCryptoReady()

    const recoveryAuthKey = await deriveRecoveryAuthKey(recoveryKey)
    const authKeyB64 = await bytesToBase64(recoveryAuthKey)

    const deviceKeyPair = await generateKeyPair()
    const devicePubKeyB64 = await bytesToBase64(deviceKeyPair.publicKey)

    const loginReq: LoginRequest = {
      email,
      auth_key: authKeyB64,
      device_pubkey: devicePubKeyB64,
      device_name: 'Web Browser (Recovery)',
    }

    try {
      const { data: tokens } = await apiClient.post('/api/v1/auth/login', loginReq)

      tokenManager.setAccessToken(tokens.access_token, tokens.expires_in)

      const keys = await this.getKeys()

      const wrappedDek = {
        ciphertext: await base64ToBytes(keys.recovery_wrapped_dek),
        nonce: await base64ToBytes(keys.recovery_wrapped_dek_nonce),
      }
      const dek = await unwrapDek(wrappedDek, recoveryKey)

      if (!dek) {
        throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, 401, {
          message: 'Failed to decrypt vault. The recovery key is invalid.',
        })
      }

      return { dek, tokens }
    } catch (error: any) {
      throw this._handleError(error)
    }
  }

  /** Completes account recovery by re-encrypting the DEK under a new password. */
  async completeRecovery(
    email: string,
    newPassword: string,
    salt: string,
    params: Argon2Params,
    dek: Uint8Array,
    tokens: AuthResponse
  ): Promise<{ masterKey: Uint8Array; dek: Uint8Array }> {
    await this.ensureCryptoReady()

    const { masterKey: newMasterKey, authKey: newAuthKey } = await deriveKeysFromPassword(
      newPassword,
      salt,
      params
    )

    const newWrappedDek = await wrapDek(dek, newMasterKey)
    const newAuthKeyB64 = await bytesToBase64(newAuthKey)
    const newWrappedDekB64 = await bytesToBase64(newWrappedDek.ciphertext)
    const newWrappedDekNonceB64 = await bytesToBase64(newWrappedDek.nonce)

    // Send new credentials to server before persisting the session client-side
    await apiClient.post('/api/v1/auth/password', {
      new_auth_key: newAuthKeyB64,
      new_wrapped_dek: newWrappedDekB64,
      new_wrapped_dek_nonce: newWrappedDekNonceB64,
    })

    // Session is only persisted after the server accepts the new password
    await tokenManager.setRefreshToken(tokens.refresh_token)
    tokenManager.setUserEmail(email)
    tokenManager.setHasSession(true)

    return { masterKey: newMasterKey, dek }
  }
}

/** Singleton authentication service instance. */
export const authService = new AuthService()
