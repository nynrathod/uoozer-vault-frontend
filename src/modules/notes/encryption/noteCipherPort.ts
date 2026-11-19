import type { JSONContent } from '@tiptap/core'
import { decryptMetadataObject, encryptMetadataObject } from '@lib/crypto'
import { useAuthStore } from '@/stores/authStore'
import type { SealedNoteBlob } from '../types'

/**
 * Notes cipher boundary. The same vault DEK that encrypts file metadata
 * encrypts notes: XChaCha20-Poly1305 with a fresh 192-bit nonce per seal,
 * executed by the existing crypto worker. No plaintext ever crosses this
 * port. The note id is embedded in the sealed payload so a blob copied
 * between notes fails authentication instead of decrypting into the wrong
 * document.
 */

export interface NotePlaintext {
  id: string
  title: string
  tags: string[]
  plainText: string
  content: JSONContent
}

export interface NoteCipher {
  seal(plaintext: NotePlaintext): Promise<SealedNoteBlob>
  open(sealed: SealedNoteBlob): Promise<NotePlaintext>
}

export class NoteCipherError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoteCipherError'
  }
}

function isSealedBlob(value: unknown): value is SealedNoteBlob {
  if (!value || typeof value !== 'object') return false
  const blob = value as Partial<SealedNoteBlob>
  return (
    blob.version === 1 &&
    blob.algorithm === 'xchacha20-poly1305' &&
    typeof blob.ciphertext === 'string' &&
    typeof blob.nonce === 'string'
  )
}

/** Builds a cipher over any DEK source; the vault store is the default. */
export function createVaultNoteCipher(getDek: () => Uint8Array | null): NoteCipher {
  return {
    async seal(plaintext: NotePlaintext) {
      const dek = getDek()
      if (!dek) throw new NoteCipherError('The vault is locked; notes cannot be encrypted yet.')
      const { encryptedMetadata, metadataNonce } = await encryptMetadataObject(
        plaintext as unknown as Record<string, unknown>,
        dek
      )
      return {
        version: 1,
        algorithm: 'xchacha20-poly1305',
        ciphertext: encryptedMetadata,
        nonce: metadataNonce,
      }
    },

    async open(sealed: SealedNoteBlob) {
      if (!isSealedBlob(sealed)) throw new NoteCipherError('This note was saved in an unknown format.')
      const dek = getDek()
      if (!dek) throw new NoteCipherError('The vault is locked; notes cannot be decrypted yet.')
      const opened = await decryptMetadataObject<NotePlaintext>(sealed.ciphertext, sealed.nonce, dek)
      if (!opened || typeof opened.id !== 'string') {
        throw new NoteCipherError('This note could not be decrypted with the current keys.')
      }
      return opened
    },
  }
}

/** The app-wide notes cipher, fed by the unlocked vault DEK. */
export const noteCipher: NoteCipher = createVaultNoteCipher(
  () => useAuthStore.getState().cryptoState.dek
)
