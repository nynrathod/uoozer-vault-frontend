import { CRYPTO_CONFIG } from '@config/app'

/** Maximum file size (10 GB — matches backend POC limit). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024

/** Chunk size for streaming encryption (4 MB). */
export const CHUNK_SIZE = CRYPTO_CONFIG.chunkSize

/** secretstream overhead per chunk (17 bytes: 16-byte tag + 1-byte tag field). */
export const SECRETSTREAM_OVERHEAD = 17

/** Maximum number of chunks per file (backend enforces 50_000). */
export const MAX_CHUNKS_PER_FILE = 50_000

/** Blocked file extensions (defense-in-depth, server also validates). */
const BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.msi',
  '.sh',
  '.deb',
  '.rpm',
  '.apk',
  '.app',
]

/** Blocked MIME types. */
const BLOCKED_MIME_TYPES = ['application/x-msdownload', 'application/x-msdos-program']

export interface FileValidationError {
  field: string
  message: string
}

export interface FileValidationResult {
  valid: boolean
  errors: FileValidationError[]
  sanitizedName: string
  detectedMimeType: string
  totalChunks: number
}

/** Sanitizes a filename: removes path traversal, null bytes, control chars. */
export function sanitizeFileName(name: string): string {
  // Take only the filename, strip any path components
  const basename = name.replace(/^.*[\\/]/, '')

  // Remove null bytes and control characters
  const cleaned = basename.replace(/[\x00-\x1f\x7f]/g, '')

  // Remove leading dots (prevents hidden file tricks on Unix)
  const noLeadingDots = cleaned.replace(/^\.+/, '')

  // Trim whitespace
  const trimmed = noLeadingDots.trim()

  // Fallback if empty after sanitization
  return trimmed || 'untitled-file'
}

/** Detects MIME type from file, falling back to extension-based detection. */
export function detectMimeType(file: File): string {
  // Trust browser detection if it's specific (not empty or generic)
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type
  }

  // Extension-based fallback
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    mp4: 'video/mp4',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    json: 'application/json',
    xml: 'application/xml',
    csv: 'text/csv',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    ts: 'text/typescript',
    md: 'text/markdown',
  }

  return mimeMap[ext] ?? 'application/octet-stream'
}

/** Validates a file before upload. Returns all errors at once. */
export function validateFile(file: File): FileValidationResult {
  const errors: FileValidationError[] = []

  // Size check
  if (file.size === 0) {
    errors.push({ field: 'size', message: 'File is empty.' })
  }
  if (file.size > MAX_FILE_SIZE) {
    errors.push({
      field: 'size',
      message: `File exceeds maximum size of ${formatFileSize(MAX_FILE_SIZE)}.`,
    })
  }

  // Chunk count check
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  if (totalChunks > MAX_CHUNKS_PER_FILE) {
    errors.push({
      field: 'chunks',
      message: `File would require ${totalChunks} chunks (max: ${MAX_CHUNKS_PER_FILE}). Try a smaller file.`,
    })
  }

  // Name sanitization
  const sanitizedName = sanitizeFileName(file.name)
  if (sanitizedName !== file.name) {
    // Not an error, just sanitized — but log for debugging
  }

  // Blocked extensions
  const lowerName = sanitizedName.toLowerCase()
  for (const ext of BLOCKED_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      errors.push({
        field: 'extension',
        message: `Files with "${ext}" extension are not allowed.`,
      })
      break
    }
  }

  // Blocked MIME types
  const detectedMimeType = detectMimeType(file)
  if (BLOCKED_MIME_TYPES.includes(detectedMimeType)) {
    errors.push({
      field: 'mimeType',
      message: `MIME type "${detectedMimeType}" is not allowed.`,
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedName,
    detectedMimeType,
    totalChunks,
  }
}

/** Validates multiple files and returns per-file results. */
export function validateFiles(files: File[]): Array<{ file: File; result: FileValidationResult }> {
  return files.map((file) => ({ file, result: validateFile(file) }))
}

/** Formats bytes into human-readable string. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
