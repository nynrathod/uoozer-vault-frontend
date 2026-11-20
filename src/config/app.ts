/** Static application metadata. */
export const APP_CONFIG = {
  name: 'Uoozer Vault',
  version: '0.1.0',
  description: 'Zero-knowledge encrypted file storage',
  supportEmail: 'security@uoozer.dev',
} as const

/** Cryptographic parameters for key derivation and upload limits. */
export const CRYPTO_CONFIG = {
  argon2: {
    memory: 65536,
    iterations: 3,
    parallelism: 4,
    hashLength: 32,
  },
  chunkSize: 4 * 1024 * 1024, // 4 MB
  maxFileSize: 10 * 1024 * 1024 * 1024, // 10 GB
} as const

/**
 * Layout dimensions and timing constants used throughout the UI.
 * Every number comes from the design system (`@config/design-tokens`) —
 * the single source of truth. Do not hardcode sizes in components.
 */
import { TOKENS } from './design-tokens'

export const UI_CONFIG = {
  /** Sidebar 240 wide, no divider, collapses to an icon rail. */
  sidebarWidth: TOKENS.layout.sidebarWidth,
  sidebarCollapsedWidth: TOKENS.layout.sidebarCollapsedWidth,
  /** Top bar 48 high, ghost icons on the right. */
  headerHeight: TOKENS.layout.topBarHeight,
  /** Sidebar row 30 high · file row 44 high. */
  sidebarRowHeight: TOKENS.layout.sidebarRowHeight,
  fileRowHeight: TOKENS.layout.fileRowHeight,
  /** Motion: 120ms hover · 180ms panels. */
  motionHoverMs: TOKENS.motion.hover,
  motionPanelMs: TOKENS.motion.panel,
  mobileBreakpoint: 768,
  toastDuration: 4000,
  debounceDelay: 300,
  virtualListOverscan: 5,
} as const
