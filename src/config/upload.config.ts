// src/config/upload.ts
/**
 * Centralized configuration for file uploads.
 * This is the single source of truth for limits, timeouts, and retry logic.
 */
export const UPLOAD_CONFIG = {
  CHUNK_SIZE: 4 * 1024 * 1024, // 4MB
  MAX_CONCURRENT_UPLOADS: 4, // Parallel chunk uploads to R2
  MAX_FILE_SIZE: 10 * 1024 * 1024 * 1024, // 10GB frontend hard limit
  MAX_CHUNKS_PER_FILE: 50_000,
  SECRETSTREAM_OVERHEAD: 17,

  // Network & Retry
  MAX_RETRIES: 5,
  RETRY_BASE_DELAY: 1000, // 1s
  RETRY_MAX_DELAY: 30_000, // 30s
  CHUNK_UPLOAD_TIMEOUT: 120_000, // 2 minutes per chunk

  // Presigned URL lifecycle
  PRESIGNED_URL_REFRESH_THRESHOLD: 60_000, // Refresh if < 1 min left

  // Stall detection
  STALL_TIMEOUT: 30_000, // 30s without progress = stalled
} as const

// Windows reserved names and forbidden characters
export const BLOCKED_FILE_NAMES = [
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]

// Magic numbers for MIME verification (defense-in-depth)
export const MAGIC_NUMBERS: Record<string, number[]> = {
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'application/zip': [0x50, 0x4b, 0x03, 0x04],
}
