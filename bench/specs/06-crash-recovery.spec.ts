import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
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
import { getObject, parseR2Key } from '../lib/s3'

const CHUNK = 4 * 1024 * 1024

function killBackend() {
  execSync(
    `powershell -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }"`,
    { stdio: 'ignore' }
  )
}

test('backend killed mid-upload: resume completes, integrity chain intact', async ({ page }) => {
  await initBlake3()

  const cdp = await page.context().newCDPSession(page)
  const tracker = await createStorageTracker(cdp)
  await login(page)

  const { path } = await generateTestFile(BENCH.sizeGB)
  const expectedChunks = Math.ceil((BENCH.sizeGB * 1024 ** 3) / CHUNK)
  await page.setInputFiles('input[type="file"]', path)

  const t0 = Date.now()
  while (tracker.puts < Math.ceil(expectedChunks * 0.3)) {
    if (Date.now() - t0 > BENCH.timeoutMs) throw new Error('never reached 30% kill point')
    await new Promise((r) => setTimeout(r, 1000))
  }

  killBackend()
  await new Promise((r) => setTimeout(r, 25_000)) // restart loop revives backend

  await awaitCompletion(page, tracker, expectedChunks)

  const parsed = tracker.putLog.map((p) => parseR2Key(p.url))
  const versionId = parsed[0].versionId

  let active = false
  for (let i = 0; i < 90; i++) {
    const [a] = await sql(`SELECT is_active FROM file_versions WHERE version_id = '${versionId}'`)
    if (a?.is_active === true) {
      active = true
      break
    }
    if (i === 30) await page.reload({ waitUntil: 'domcontentloaded' })
    await new Promise((r) => setTimeout(r, 2000))
  }

  const rows = await sql(
    `SELECT chunk_index, chunk_size, encode(chunk_blake3, 'hex') AS h FROM file_chunks WHERE version_id = '${versionId}' ORDER BY chunk_index`
  )
  const rowByChunk = new Map(rows.map((r: any) => [Number(r.chunk_index), r]))

  let verified = 0,
    failures = 0
  for (const p of parsed) {
    const key = `${p.userId}/${p.fileId}/${p.versionId}/${p.segment}/${p.chunk}`
    const row = rowByChunk.get(Number(p.chunk))
    if (!row) {
      failures++
      continue
    }
    const obj = await getObject(key)
    if (blake3Hex(obj) === row.h && obj.length === Number(row.chunk_size)) verified++
    else failures++
  }
  const [ptr] = await sql(
    `SELECT current_version_id::text AS v FROM files WHERE file_id = '${parsed[0].fileId}'`
  )

  logResult({
    spec: '06-crash-recovery',
    sizeGB: BENCH.sizeGB,
    chunksExpected: expectedChunks,
    chunksVerified: verified,
    integrityFailures: failures,
    extraPutsVsExpected: tracker.puts - expectedChunks,
    pointerRestored: ptr?.v === versionId,
    versionActive: active,
  })
  expect(failures).toBe(0)
  expect(active).toBe(true)
  expect(ptr?.v).toBe(versionId)
  await unlink(path).catch(() => {})
})
