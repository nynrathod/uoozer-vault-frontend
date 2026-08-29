export const SECRETSTREAM_HEADER_BYTES = 24
export const SECRETSTREAM_MESSAGE_OVERHEAD = 17
export const SECRETSTREAM_ABYTES = 17

export const PLAINTEXT_CHUNK_BYTES = 4 * 1024 * 1024
export const SECRETSTREAM_MESSAGE_PLAINTEXT_BYTES = 64 * 1024

if (PLAINTEXT_CHUNK_BYTES % SECRETSTREAM_MESSAGE_PLAINTEXT_BYTES !== 0) {
  throw new Error(
    `chunk-constants: PLAINTEXT_CHUNK_BYTES (${PLAINTEXT_CHUNK_BYTES}) must be a multiple of SECRETSTREAM_MESSAGE_PLAINTEXT_BYTES (${SECRETSTREAM_MESSAGE_PLAINTEXT_BYTES})`
  )
}
export const MESSAGES_PER_CHUNK = PLAINTEXT_CHUNK_BYTES / SECRETSTREAM_MESSAGE_PLAINTEXT_BYTES

export function encryptedChunkSize(opts: {
  plaintextChunkSize: number
  isSegmentStart: boolean
  lastMessagePlaintextBytes: number
}): number {
  const fullMessages = Math.floor(opts.plaintextChunkSize / SECRETSTREAM_MESSAGE_PLAINTEXT_BYTES)
  const fullCiphertext =
    fullMessages * (SECRETSTREAM_MESSAGE_PLAINTEXT_BYTES + SECRETSTREAM_MESSAGE_OVERHEAD)
  const trailingPlaintext = opts.lastMessagePlaintextBytes
  const trailingCiphertext =
    trailingPlaintext > 0 ? trailingPlaintext + SECRETSTREAM_MESSAGE_OVERHEAD : 0
  const header = opts.isSegmentStart ? SECRETSTREAM_HEADER_BYTES : 0
  return header + fullCiphertext + trailingCiphertext
}

export const r2ObjectSizeForChunk = encryptedChunkSize

export interface ChunkId {
  chunkIndex: number
  segmentIndex: number
}

export function r2KeyFor(
  opts: ChunkId & { userId: string; fileId: string; versionId: string }
): string {
  return `${opts.userId}/${opts.fileId}/${opts.versionId}/${opts.segmentIndex}/${opts.chunkIndex}`
}
