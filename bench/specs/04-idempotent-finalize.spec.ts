import { test, expect } from '@playwright/test'
import { unlink } from 'node:fs/promises'
import { BENCH } from '../bench.config'
import {
  generateTestFile,
  login,
  createStorageTracker,
  awaitCompletion,
  captureAuthToken,
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
  page.on('request', (r) => {
    if (!finalizeReq && r.method() === 'POST' && r.url().includes('complete') && r.postData())
      finalizeReq = { url: r.url(), body: r.postData()! }
  })

  const { path } = await generateTestFile(SIZE_MB / 1024)
  await page.setInputFiles('input[type="file"]', path)
  await awaitCompletion(page, tracker, Math.ceil((SIZE_MB * 1024 * 1024) / CHUNK))
  expect(finalizeReq).not.toBeNull()

  const k = parseR2Key(tracker.putLog[0].url)
  const token = await captureAuthToken(page)

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

  const [vr] = await sql(
    `SELECT count(*)::int AS n FROM file_versions WHERE version_id = '${k.versionId}'`
  )
  const [av] = await sql(
    `SELECT count(*)::int AS n FROM file_versions WHERE file_id = '${k.fileId}' AND is_active = true`
  )
  const [fr] = await sql(`SELECT count(*)::int AS n FROM files WHERE file_id = '${k.fileId}'`)
  const [ptr] = await sql(
    `SELECT current_version_id::text AS v FROM files WHERE file_id = '${k.fileId}'`
  )

  logResult({
    spec: '04-idempotent-finalize',
    replays: 10,
    statuses,
    serverErrors: statuses.filter((s) => s >= 500).length,
    versionRows: vr.n,
    activeVersions: av.n,
    fileRows: fr.n,
    pointerMatches: ptr.v === k.versionId,
  })
  expect(statuses.filter((s) => s >= 500)).toHaveLength(0)
  expect(vr.n).toBe(1)
  expect(av.n).toBe(1)
  expect(fr.n).toBe(1)
  expect(ptr.v).toBe(k.versionId)
  await unlink(path).catch(() => {})
})
