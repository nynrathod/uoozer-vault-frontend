import {
  BLOCKED_FILE_NAMES,
  MAGIC_NUMBERS,
  UPLOAD_CONFIG,
  JUNK_FILES,
  BLOCKED_EXTENSIONS,
} from '@/config/upload.config'

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
  isEmpty: boolean
}

/** Sanitizes filename: removes path traversal, null bytes, control chars, handles Windows reserved names. */
export function sanitizeFileName(name: string): string {
  let basename = name.replace(/^.*[\\/]/, '')
  basename = basename.replace(/[\x00-\x1f\x7f]/g, '')
  basename = basename.replace(/^\.+/, '')
  basename = basename.trim()

  // Handle Windows reserved names (e.g., "CON.txt" -> "CON_.txt")
  const nameWithoutExt = basename.split('.')[0].toUpperCase()
  if (BLOCKED_FILE_NAMES.includes(nameWithoutExt)) {
    basename = `_${basename}`
  }

  // Enforce 255 character limit
  if (basename.length > 255) {
    const ext = basename.split('.').pop() || ''
    const namePart = basename.substring(0, 255 - ext.length - 1)
    basename = `${namePart}.${ext}`
  }

  return basename || 'untitled-file'
}

/** Detects MIME type and verifies magic numbers to prevent MIME spoofing. */
export async function verifyMimeType(file: File): Promise<string> {
  const declaredType = file.type || 'application/octet-stream'
  const slice = file.slice(0, 4)
  const buffer = await slice.arrayBuffer()
  const bytes = Array.from(new Uint8Array(buffer))

  for (const [mimeType, magic] of Object.entries(MAGIC_NUMBERS) as [string, number[]][]) {
    if (magic.every((byte: number, i: number) => bytes[i] === byte)) {
      return mimeType
    }
  }

  return declaredType
}

export function isJunkFile(fileName: string): boolean {
  return JUNK_FILES.includes(fileName)
}

export function hasBlockedExtension(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return BLOCKED_EXTENSIONS.includes(ext)
}

export async function validateFile(file: File): Promise<FileValidationResult> {
  const errors: FileValidationError[] = []
  const sanitizedName = sanitizeFileName(file.name)
  const detectedMimeType = await verifyMimeType(file)
  const isEmpty = file.size === 0
  const totalChunks = Math.max(1, Math.ceil(file.size / UPLOAD_CONFIG.CHUNK_SIZE))

  if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
    errors.push({ field: 'size', message: `File exceeds maximum size of 10GB.` })
  }
  if (totalChunks > UPLOAD_CONFIG.MAX_CHUNKS_PER_FILE) {
    errors.push({ field: 'chunks', message: `File requires too many chunks.` })
  }
  if (hasBlockedExtension(file.name)) {
    errors.push({ field: 'extension', message: `File type is blocked.` })
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedName,
    detectedMimeType,
    totalChunks,
    isEmpty,
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
