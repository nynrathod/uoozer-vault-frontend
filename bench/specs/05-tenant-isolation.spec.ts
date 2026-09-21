import { test, expect } from '@playwright/test'
import { BENCH } from '../bench.config'
import {
  generateTestFile,
  login,
  createStorageTracker,
  awaitCompletion,
  captureAuthToken,
  logResult,
} from '../lib/helpers'
import { parseR2Key } from '../lib/s3'

const SIZE_MB = 8
const CHUNK = 4 * 1024 * 1024

test('cross-tenant isolation: 100% rejection', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  const cdpA = await ctxA.newCDPSession(pageA)
  const tracker = await createStorageTracker(cdpA)
  await login(pageA)
  const { path } = await generateTestFile(SIZE_MB / 1024)
  await pageA.setInputFiles('input[type="file"]', path)
  await awaitCompletion(pageA, tracker, Math.ceil((SIZE_MB * 1024 * 1024) / CHUNK))
  const k = parseR2Key(tracker.putLog[0].url)
  await ctxA.close()

  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await login(pageB, BENCH.users.b)
  const token = await captureAuthToken(pageB)

  const attempts = [
    {
      name: 'get-file',
      run: () =>
        pageB.evaluate(
          ({ api, f, t }) =>
            fetch(`${api}/files/${f}`, { headers: { Authorization: t } }).then((r) => r.status),
          { api: BENCH.apiBase, f: k.fileId, t: token }
        ),
    },
    {
      name: 'download-manifest',
      run: () =>
        pageB.evaluate(
          ({ api, f, t }) =>
            fetch(`${api}/files/${f}/download`, { headers: { Authorization: t } }).then(
              (r) => r.status
            ),
          { api: BENCH.apiBase, f: k.fileId, t: token }
        ),
    },
    {
      name: 'resume-info',
      run: () =>
        pageB.evaluate(
          ({ api, v, t }) =>
            fetch(`${api}/chunks/${v}/resume`, { headers: { Authorization: t } }).then(
              (r) => r.status
            ),
          { api: BENCH.apiBase, v: k.versionId, t: token }
        ),
    },
    {
      name: 'verify-chunk',
      run: () =>
        pageB.evaluate(
          ({ api, v, s, c, t }) =>
            fetch(`${api}/chunks/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: t },
              body: JSON.stringify({ version_id: v, segment_index: +s, chunk_index: +c }),
            }).then((r) => r.status),
          { api: BENCH.apiBase, v: k.versionId, s: k.segment, c: k.chunk, t: token }
        ),
    },
    {
      name: 'delete-file',
      run: () =>
        pageB.evaluate(
          ({ api, f, t }) =>
            fetch(`${api}/files/${f}`, { method: 'DELETE', headers: { Authorization: t } }).then(
              (r) => r.status
            ),
          { api: BENCH.apiBase, f: k.fileId, t: token }
        ),
    },
  ]

  const results: Array<{ name: string; status: number; rejected: boolean }> = []
  for (const a of attempts) {
    const status = await a.run()
    results.push({ name: a.name, status, rejected: [401, 403, 404].includes(status) })
  }
  const rejected = results.filter((r) => r.rejected).length
  logResult({
    spec: '05-tenant-isolation',
    attempts: results.length,
    rejected,
    rejectionRate: `${rejected}/${results.length}`,
    detail: results,
  })
  expect(rejected).toBe(results.length)
})
