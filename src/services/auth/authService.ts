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
} from '@lib/crypto'

import type {
  PreloginResponse,
  SignupInitResponse,
  SignupCompleteRequest,
  LoginRequest,
  AuthResponse,
  LogoutRequest,
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

class AuthService {
  private _cryptoInitialized = false
  async ensureCryptoReady(): Promise<void> {
    console.log('[Crypto] ensureCryptoReady called')
    console.log('[Crypto] _cryptoInitialized:', this._cryptoInitialized)

    if (!this._cryptoInitialized) {
      console.log('[Crypto] Initializing crypto...')

      try {
        await initCrypto()
        console.log('[Crypto] initCrypto() completed successfully')

        this._cryptoInitialized = true
        console.log('[Crypto] _cryptoInitialized set to true')
      } catch (err) {
        console.error('[Crypto] initCrypto() failed:', err)

        if (err instanceof Error) {
          console.error('[Crypto] Error message:', err.message)
          console.error('[Crypto] Stack:', err.stack)
        }

        throw err
      }
    } else {
      console.log('[Crypto] Crypto already initialized, skipping')
    }

    console.log('[Crypto] ensureCryptoReady finished')
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

      const claims = decodeJwt(data.access_token)
      tokenManager.setDeviceId(claims.did)

      // Zeroize auth keys after sending to server, they are no longer needed client-side
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

    // Add a 30-second timeout to prevent infinite hanging
    const bundlePromise = generateSignupBundle(
      credentials.password,
      initResp.salt,
      initResp.argon2_params
    )

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Crypto bundle generation timed out after 30s')), 30_000)
    })

    // Race the bundle generation against the timeout
    const bundle = (await Promise.race([bundlePromise, timeoutPromise])) as SignupCryptoBundle

    return this.signupComplete(credentials, bundle, initResp.signup_token)
  }

  async login(credentials: LoginCredentials): Promise<{
    tokens: AuthResponse
    masterKey: Uint8Array
  }> {
    console.log('1. Ensuring crypto is ready...')
    await this.ensureCryptoReady()
    console.log('2. Crypto ready')

    console.log('3. Calling prelogin...', credentials.email)
    const preloginResp = await this.prelogin(credentials.email)
    console.log('4. Prelogin response:', preloginResp)

    console.log('5. Deriving keys from password...')
    const { masterKey, authKey } = await deriveKeysFromPassword(
      credentials.password,
      preloginResp.salt,
      preloginResp.argon2_params
    )
    console.log('6. Keys derived', {
      hasMasterKey: !!masterKey,
      masterKeyLength: masterKey.length,
      authKeyLength: authKey.length,
    })

    console.log('7. Generating device key pair...')
    const deviceKeyPair = await generateKeyPair()
    console.log('8. Device key pair generated', {
      publicKeyLength: deviceKeyPair.publicKey.length,
      privateKeyLength: deviceKeyPair.privateKey.length,
    })

    console.log('9. Encoding auth key to Base64...')
    const authKeyB64 = await bytesToBase64(authKey)
    console.log('10. authKey encoded')

    console.log('11. Encoding device public key to Base64...')
    const devicePubKeyB64 = await bytesToBase64(deviceKeyPair.publicKey)
    console.log('12. Device public key encoded')

    console.log('13. Zeroizing auth key...')
    await zeroize(authKey)
    console.log('14. Auth key zeroized')

    const loginReq: LoginRequest = {
      email: credentials.email,
      auth_key: authKeyB64,
      device_pubkey: devicePubKeyB64,
      device_name: 'Web Browser',
      device_id: tokenManager.getDeviceId() ?? undefined,
    }

    console.log('15. Login request:', {
      email: loginReq.email,
      device_id: loginReq.device_id,
      device_name: loginReq.device_name,
      authKeyLength: loginReq.auth_key.length,
      devicePubKeyLength: loginReq.device_pubkey.length,
    })

    try {
      console.log('16. Sending login request...')
      const { data } = await apiClient.post('/api/v1/auth/login', loginReq)
      console.log('17. Login successful:', data)

      console.log('18. Storing access token...')
      tokenManager.setAccessToken(data.access_token, data.expires_in)
      console.log('19. Access token stored')

      console.log('20. Storing refresh token...')
      await tokenManager.setRefreshToken(data.refresh_token)
      console.log('21. Refresh token stored')

      console.log('22. Storing user email...')
      tokenManager.setUserEmail(credentials.email)

      console.log('23. Decoding JWT...')
      const claims = decodeJwt(data.access_token)
      console.log('24. JWT claims:', claims)

      console.log('25. Saving device ID:', claims.did)
      tokenManager.setDeviceId(claims.did)

      console.log('26. Returning login result')
      return {
        tokens: data,
        masterKey,
      }
    } catch (error: any) {
      // Zeroize master key if login fails
      await zeroize(masterKey)
      throw this._handleError(error)
    }
  }

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
        await tokenManager.clearTokens()
      }
      throw this._handleError(error)
    }
  }

  async logout(revokeDevice = false): Promise<void> {
    const refreshToken = await tokenManager.getRefreshToken()

    try {
      await apiClient.post('/api/v1/auth/logout', {
        revoke_device: revokeDevice,
        refresh_token: refreshToken,
      } as LogoutRequest)
    } catch {
      // ignore
    } finally {
      await tokenManager.clearAll()
    }
  }

  async changePassword(
    newPassword: string,
    currentSalt: string,
    currentArgonParams: Argon2Params,
    dek: Uint8Array
  ): Promise<void> {
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

    // Zeroize sensitive keys
    await zeroize(newMasterKey, newAuthKey, newWrappedDek.ciphertext)

    try {
      await apiClient.post('/api/v1/auth/password', {
        new_auth_key: newAuthKeyB64,
        new_wrapped_dek: newWrappedDekB64,
        new_wrapped_dek_nonce: newWrappedDekNonceB64,
      })
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

  async tryRestoreSession(): Promise<boolean> {
    const hasSession = await this.hasValidSession()
    if (!hasSession) {
      await tokenManager.clearAll()
      return false
    }

    try {
      await this.refresh()
      return true
    } catch {
      await tokenManager.clearAll()
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
}

export const authService = new AuthService()
