export const APP_CONFIG = {
  name: 'Uoozer Vault',
  version: '0.1.0',
  description: 'Zero-knowledge encrypted file storage',
  supportEmail: 'security@uoozer.dev',
} as const

export const CRYPTO_CONFIG = {
  argon2: {
    memory: 65536,
    iterations: 3,
    parallelism: 4,
    hashLength: 32,
  },
  chunkSize: 4 * 1024 * 1024, // 4MB
  maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
} as const

export const UI_CONFIG = {
  sidebarWidth: 260,
  sidebarCollapsedWidth: 64,
  headerHeight: 64,
  mobileBreakpoint: 768,
  toastDuration: 4000,
  debounceDelay: 300,
  virtualListOverscan: 5,
} as const
