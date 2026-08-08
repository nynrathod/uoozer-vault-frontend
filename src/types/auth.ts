// ─── API Request/Response Types ────────────────────────────────────────────

export interface Argon2Params {
  m_cost: number
  t_cost: number
  p_cost: number
  output_len: number
  algorithm: string
}

export interface PreloginResponse {
  salt: string
  argon2_params: Argon2Params
}

export interface SignupInitResponse {
  signup_token: string
  salt: string
  argon2_params: Argon2Params
}

export interface SignupCompleteRequest {
  signup_token: string
  auth_key: string
  recovery_auth_key: string
  wrapped_dek: string
  wrapped_dek_nonce: string
  recovery_wrapped_dek: string
  recovery_wrapped_dek_nonce: string
  identity_pubkey: string
  device_pubkey: string
  device_name: string
}

export interface LoginRequest {
  email: string
  auth_key: string
  device_pubkey: string
  device_name: string
  device_id?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface RefreshRequest {
  refresh_token: string
}

export interface LogoutRequest {
  revoke_device?: boolean
  refresh_token?: string
}

export interface PasswordChangeRequest {
  new_auth_key: string
  new_wrapped_dek: string
  new_wrapped_dek_nonce: string
}

// ─── User & Device Types ───────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface Device {
  device_id: string
  device_name: string
  device_pubkey: string
  created_at: string
  last_seen_at: string
  is_revoked: boolean
  is_current: boolean
}

export interface Session {
  session_id: string
  device_id: string
  device_name: string
  issued_at: string
  expires_at: string
  ip_address: string | null
  user_agent: string | null
  is_current: boolean
  is_revoked: boolean
}

// ─── OAuth Types ───────────────────────────────────────────────────────────

export type OAuthProvider = 'google' | 'github'

export interface OAuthInitResponse {
  authorization_url: string
  state: string
}

export interface OAuthCallbackRequest {
  provider: OAuthProvider
  code: string
  state: string
  code_verifier: string
  device_name: string
}

// ─── Crypto State (in-memory only, never serialized) ────────────────────────

export interface CryptoState {
  isReady: boolean
  masterKey: Uint8Array | null
  dek: Uint8Array | null
}

// ─── Login Credentials ─────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface SignupCredentials {
  email: string
  password: string
  deviceName: string
  acceptTerms: boolean
}
