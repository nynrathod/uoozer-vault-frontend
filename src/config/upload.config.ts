import { PLAINTEXT_CHUNK_BYTES, SECRETSTREAM_MESSAGE_OVERHEAD } from '@lib/chunk-constants'

export const UPLOAD_CONFIG = {
  CHUNK_SIZE: PLAINTEXT_CHUNK_BYTES, // 4 MiB
  SECRETSTREAM_OVERHEAD: SECRETSTREAM_MESSAGE_OVERHEAD, // 17 bytes

  MAX_CONCURRENT_UPLOADS: 4, // Parallel chunk uploads to R2
  MAX_CONCURRENT_FILES: 3, // Parallel files in a bulk/folder upload

  MAX_FILE_SIZE: 40 * 1024 * 1024 * 1024, // 40 GB frontend hard limit
  MAX_CHUNKS_PER_FILE: 50_000,
  MAX_FOLDER_DEPTH: 32, // Prevent excessively deep nesting

  MAX_RETRIES: 5,
  RETRY_BASE_DELAY: 1000, // 1 s
  RETRY_MAX_DELAY: 30_000, // 30 s
  CHUNK_UPLOAD_TIMEOUT: 120_000, // 2 minutes per chunk

  PRESIGNED_URL_REFRESH_THRESHOLD: 60_000, // Refresh if < 1 min left

  STALL_TIMEOUT: 30_000, // 30 s without progress = stalled
} as const

// Auto-filter junk files during folder uploads
export const JUNK_FILES = [
  '.DS_Store',
  'Thumbs.db',
  'ehthumbs.db',
  'desktop.ini',
  '.Spotlight-V100',
  '.Trashes',
]

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

export const BLOCKED_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'sh',
  'msi',
  'dll',
  'scr',
  'com',
  'vbs',
  'ps1',
  'docx',
  'doc',
  'xlsx',
  'xls',
]

export const MAGIC_NUMBERS: Record<string, number[]> = {
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'application/zip': [0x50, 0x4b, 0x03, 0x04],
}
