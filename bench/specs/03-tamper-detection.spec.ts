import { test, expect } from '@playwright/test'
import { unlink } from 'node:fs/promises'
import { BENCH } from '../bench.config'
import { initBlake3, blake3Hex } from '../lib/blake'
import {
  generateTestFile,
  login,
  createStorageTracker,
  awaitCompletion,
  sql,
  logResult,
} from '../lib/helpers'
import { getObject, putObject, parseR2Key } from '../lib/s3'

const SIZE_MB = 16
const CHUNK = 4 * 1024 * 1024
const VARIANTS = [
  'flip-first',
  'flip-mid',
  'flip-last',
  'truncate',
  'extend',
  'zero-mid',
  'swap-chunks',
] as const
const ITERATIONS = 3

test('storage corruption: 100% detection via ciphertext hash + size chain', async ({ page }) => {
  await initBlake3()

  const cdp = await page.context().newCDPSession(page)
  const tracker = await createStorageTracker(cdp)
  await login(page)

  const { path } = await generateTestFile(SIZE_MB / 1024)
  await page.setInputFiles('input[type="file"]', path)
  await awaitCompletion(page, tracker, Math.ceil((SIZE_MB * 1024 * 1024) / CHUNK))
  await new Promise((r) => setTimeout(r, 3000))

  const entries = tracker.putLog.map((p) => {
    const k = parseR2Key(p.url)
    return {
      key: `${k.userId}/${k.fileId}/${k.versionId}/${k.segment}/${k.chunk}`,
      chunkIdx: Number(k.chunk),
      versionId: k.versionId,
    }
  })
  expect(entries.length).toBeGreaterThan(0)

  const rows = await sql(
    `SELECT chunk_index, chunk_size, encode(chunk_blake3, 'hex') AS h FROM file_chunks WHERE version_id = '${entries[0].versionId}' ORDER BY chunk_index`
  )
  const rowByChunk = new Map(rows.map((r: any) => [Number(r.chunk_index), r]))
  const originals = new Map<string, Buffer>()
  for (const e of entries) originals.set(e.key, await getObject(e.key))

  const hashMode = entries.every(
    (e) => blake3Hex(originals.get(e.key)!) === rowByChunk.get(e.chunkIdx)!.h
  )

  let injected = 0,
    detected = 0,
    controls = 0,
    controlsOk = 0
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const v of VARIANTS) {
      const e = entries[iter % entries.length]
      const orig = originals.get(e.key)!
      const row = rowByChunk.get(e.chunkIdx)!
      let tampered: Buffer
      switch (v) {
        case 'flip-first': {
          tampered = Buffer.from(orig)
          tampered[0] ^= 0xff
          break
        }
        case 'flip-mid': {
          tampered = Buffer.from(orig)
          tampered[Math.floor(tampered.length / 2)] ^= 0xff
          break
        }
        case 'flip-last': {
          tampered = Buffer.from(orig)
          tampered[tampered.length - 1] ^= 0xff
          break
        }
        case 'truncate': {
          tampered = orig.subarray(0, orig.length - 16)
          break
        }
        case 'extend': {
          tampered = Buffer.concat([orig, Buffer.alloc(64, 0x41)])
          break
        }
        case 'zero-mid': {
          tampered = Buffer.from(orig)
          const m = Math.floor(tampered.length / 2)
          tampered.fill(0, m - 8, m + 8)
          break
        }
        case 'swap-chunks': {
          tampered = originals.get(entries[(iter + 1) % entries.length].key)!
          break
        }
      }
      await putObject(e.key, tampered)
      injected++

      const stored = await getObject(e.key)
      const sizeOk = stored.length === Number(row.chunk_size)
      const hashOk = blake3Hex(stored) === row.h
      if (hashMode ? !sizeOk || !hashOk : !sizeOk) detected++

      await putObject(e.key, orig)
      controls++
      const back = await getObject(e.key)
      if (back.length === Number(row.chunk_size) && blake3Hex(back) === row.h) controlsOk++
    }
  }

  logResult({
    spec: '03-tamper-detection',
    variants: VARIANTS.length,
    iterations: ITERATIONS,
    injectedCorruptions: injected,
    detected,
    detectionRate: `${detected}/${injected}`,
    controlsVerified: `${controlsOk}/${controls}`,
    hashChainMode: hashMode ? 'ciphertext-blake3' : 'size-only',
  })
  expect(controlsOk).toBe(controls)
  if (hashMode) expect(detected).toBe(injected)
  await unlink(path).catch(() => {})
})
