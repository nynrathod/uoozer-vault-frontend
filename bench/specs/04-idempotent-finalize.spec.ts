import { test, expect } from '@playwright/test'
import { unlink } from 'node:fs/promises'
import { BENCH } from '../bench.config'
import {
  generateTestFile,
  login,
  createStorageTracker,
  awaitCompletion,
  sql,
  logResult,
} from '../lib/helpers'
import { parseR2Key } from '../lib/s3'

const SIZE_MB = 8
const CHUNK = 4 * 1024 * 1024

test('concurrent finalize replays: exactly-once, zero duplicates', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  const tracker = await createStorageTracker(cdp)
  await login(page)

  let finalizeReq: { url: string; body: string } | null = null
  let authHeader: string | null = null
  page.on('request', (r) => {
    const h = r.headers()['authorization']
    if (h && !authHeader) authHeader = h
    if (!finalizeReq && r.method() === 'POST' && r.url().includes('complete') && r.postData())
      finalizeReq = { url: r.url(), body: r.postData()! }
  })

  const { path } = await generateTestFile(SIZE_MB / 1024)
  const expectedChunks = Math.ceil((SIZE_MB * 1024 * 1024) / CHUNK)
  console.log(`  [spec-04] uploading ${SIZE_MB}MB (${expectedChunks} chunks)`)

  await page.setInputFiles('input[type="file"]', path)
  await awaitCompletion(page, tracker, expectedChunks)

  expect(finalizeReq).not.toBeNull()
  // version ID from the storage key — same method as this morning's passing run
  const k = parseR2Key(tracker.putLog[0].url)
  const token: string = authHeader ?? ''
  console.log('  [spec-04] upload complete — replaying finalize 10x concurrently')

  const statuses: number[] = await page.evaluate(
    async ({ url, body, token }) => {
      return Promise.all(
        Array.from({ length: 10 }, () =>
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: token },
            body,
          })
            .then((r) => r.status)
            .catch(() => -1)
        )
      )
    },
    { url: finalizeReq!.url, body: finalizeReq!.body, token }
  )
  console.log(`  [replay] statuses: [${statuses.join(', ')}]`)

  const [vr] = await sql(
    `SELECT count(*)::int AS n FROM file_versions WHERE version_id = '${k.versionId}'`
  )
  const [av] = await sql(
    `SELECT count(*)::int AS n FROM file_versions WHERE file_id = '${k.fileId}' AND is_active = true`
  )
  const [fr] = await sql(
    `SELECT count(*)::int AS n FROM files WHERE current_version_id = '${k.versionId}'`
  )
  const [ptr] = await sql(
    `SELECT current_version_id::text AS v FROM files WHERE current_version_id = '${k.versionId}'`
  )
  console.log(`  [verify] versions=${vr.n} active=${av.n} files=${fr.n} pointer=${!!ptr}`)

  logResult({
    spec: '04-idempotent-finalize',
    replays: 10,
    statuses,
    serverErrors: statuses.filter((s) => s >= 500).length,
    versionRows: vr.n,
    activeVersions: av.n,
    fileRows: fr.n,
    pointerMatches: !!ptr,
  })
  expect(statuses.filter((s) => s >= 500)).toHaveLength(0)
  expect(vr.n).toBe(1)
  expect(av.n).toBe(1)
  expect(fr.n).toBe(1)
  await unlink(path).catch(() => {})
})
