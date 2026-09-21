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
  waitForPutFraction,
  backendAlive,
  sql,
  logResult,
} from '../lib/helpers'
import { getObject } from '../lib/s3'

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

  let finalizeBody: string | null = null
  let finalizeStatus: number | null = null
  page.on('request', (r) => {
    if (!finalizeBody && r.method() === 'POST' && r.url().includes('complete') && r.postData())
      finalizeBody = r.postData()!
  })
  page.on('response', (r) => {
    if (r.url().includes('complete') && r.request().method() === 'POST') finalizeStatus = r.status()
  })

  const { path } = await generateTestFile(BENCH.sizeGB)
  const expectedChunks = Math.ceil((BENCH.sizeGB * 1024 ** 3) / CHUNK)
  console.log(`  [spec-06] uploading ${BENCH.sizeGB}GB (${expectedChunks} chunks)`)

  await page.setInputFiles('input[type="file"]', path)
  await waitForPutFraction(tracker, expectedChunks, 0.3)

  const killedAtPuts = tracker.puts
  console.log('  [chaos] killing backend NOW')
  killBackend()

  // wait for the restart loop (or manual restart) to revive it
  let revived = false
  for (let i = 0; i < 90; i++) {
    if (await backendAlive()) {
      revived = true
      break
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  if (!revived)
    throw new Error(
      'backend never came back after kill — run the restart loop: while ($true) { cargo run; Start-Sleep 2 }'
    )
  console.log('  [spec-06] backend revived — waiting for resume to finish')

  await awaitCompletion(page, tracker, expectedChunks)

  expect(finalizeBody).not.toBeNull()
  console.log(`  [spec-06] finalize body: ${finalizeBody!.slice(0, 200)}`)
  const parsedBody = JSON.parse(finalizeBody!)
  const finalizedVersionId: string =
    parsedBody.version_id ??
    parsedBody.uploads?.[0]?.version_id ??
    parsedBody.uploads?.[0]?.versionId
  if (!finalizedVersionId)
    throw new Error(`could not find version UUID in finalize body: ${finalizeBody}`)

  // wait for an active version on this file (finalize may retry client-side)
  let activeVersionId: string | null = null
  const fileIdRow = await sql(
    `SELECT file_id FROM file_versions WHERE version_id = '${finalizedVersionId}'`
  )
  const fileId = fileIdRow[0]?.file_id
  for (let i = 0; i < 90; i++) {
    const rows2 = await sql(
      `SELECT version_id FROM file_versions WHERE is_active = true AND file_id = '${fileId}'`
    )
    if (rows2.length > 0) {
      activeVersionId = rows2[0].version_id
      break
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  // DB-driven integrity verification of the active (or finalized) version
  const verifyVersionId = activeVersionId ?? finalizedVersionId
  const rows: any[] = await sql(
    `SELECT chunk_index, chunk_size, r2_key, encode(chunk_blake3, 'hex') AS h
     FROM file_chunks WHERE version_id = '${verifyVersionId}' ORDER BY chunk_index`
  )
  console.log(`  [verify] ${rows.length} chunk rows — verifying stored objects`)

  let verified = 0,
    failures = 0
  for (const row of rows) {
    const obj = await getObject(row.r2_key)
    if (blake3Hex(obj) === row.h && obj.length === Number(row.chunk_size)) verified++
    else failures++
    if (verified % 64 === 0) console.log(`  [verify] ${verified}/${rows.length}`)
  }

  logResult({
    spec: '06-crash-recovery',
    sizeGB: BENCH.sizeGB,
    backendKilledAtPuts: killedAtPuts,
    chunksExpected: expectedChunks,
    dbChunkRows: rows.length,
    chunksVerified: verified,
    integrityFailures: failures,
    extraPutsVsExpected: tracker.puts - expectedChunks,
    versionActivated: !!activeVersionId,
    finalizeHttpStatus: finalizeStatus,
  })
  expect(failures).toBe(0)
  expect(activeVersionId).not.toBeNull()
  await unlink(path).catch(() => {})
})
