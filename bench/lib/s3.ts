import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { BENCH } from '../bench.config'

const client = new S3Client({
  endpoint: BENCH.minio.endpoint,
  region: BENCH.minio.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: BENCH.minio.accessKeyId,
    secretAccessKey: BENCH.minio.secretAccessKey,
  },
})

export async function getObject(key: string): Promise<Buffer> {
  const res = await client.send(new GetObjectCommand({ Bucket: BENCH.minio.bucket, Key: key }))
  return Buffer.from(await res.Body!.transformToByteArray())
}

export async function putObject(key: string, body: Buffer): Promise<void> {
  await client.send(new PutObjectCommand({ Bucket: BENCH.minio.bucket, Key: key, Body: body }))
}

export type Corruption =
  'flip-first' | 'flip-mid' | 'flip-last' | 'truncate' | 'extend' | 'zero-mid' | 'swap-chunks'

/** Corrupt a stored (encrypted) chunk object. Returns the original for restoration. */
export async function corruptObject(key: string, mode: Corruption): Promise<Buffer> {
  const original = await getObject(key)
  const tampered = Buffer.from(original)
  const mid = Math.floor(tampered.length / 2)
  switch (mode) {
    case 'flip-first':
      tampered[0] ^= 0xff
      break
    case 'flip-mid':
      tampered[mid] ^= 0xff
      break
    case 'flip-last':
      tampered[tampered.length - 1] ^= 0xff
      break
    case 'truncate':
      tampered.subarray(0, tampered.length - 16)
      break
    case 'extend':
      Buffer.concat([tampered, Buffer.alloc(64, 0x41)])
      break
    case 'zero-mid':
      tampered.fill(0, mid - 8, mid + 8)
      break
    case 'swap-chunks':
      break // handled by caller (puts chunk A's bytes under chunk B's key)
  }
  if (mode !== 'swap-chunks') await putObject(key, tampered)
  return original
}

/** Parse `{user}/{file}/{version}/{segment}/{chunk}` out of a presigned PUT URL. */
export function parseR2Key(putUrl: string): {
  userId: string
  fileId: string
  versionId: string
  segment: string
  chunk: string
} {
  const m = putUrl.match(/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/(\d+)\/(\d+)/i)
  if (!m) throw new Error(`could not parse r2 key from ${putUrl}`)
  return { userId: m[1], fileId: m[2], versionId: m[3], segment: m[4], chunk: m[5] }
}
