import { test, expect } from '@playwright/test'
import { unlink } from 'node:fs/promises'
import { BENCH } from '../bench.config'
import {
  generateTestFile,
  login,
  createStorageTracker,
  awaitCompletion,
  logResult,
} from '../lib/helpers'

const CHUNK = 4 * 1024 * 1024

test('mid-upload network cut: bounded retransmission + completion', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  const tracker = await createStorageTracker(cdp)
  await login(page)

  const { path } = await generateTestFile(BENCH.sizeGB)
  const expectedChunks = Math.ceil((BENCH.sizeGB * 1024 ** 3) / CHUNK)
  await page.setInputFiles('input[type="file"]', path)

  const t0 = Date.now()
  while (tracker.puts < Math.ceil(expectedChunks * 0.3)) {
    if (Date.now() - t0 > BENCH.timeoutMs) throw new Error('never reached 30% cut point')
    await new Promise((r) => setTimeout(r, 1000))
  }

  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  })
  await new Promise((r) => setTimeout(r, 6000))
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })

  await awaitCompletion(page, tracker, expectedChunks)
  await new Promise((r) => setTimeout(r, 5000))

  const extraPuts = tracker.puts - expectedChunks
  const overheadPct = +((extraPuts / expectedChunks) * 100).toFixed(2)
  logResult({
    spec: '02-network-resume',
    sizeGB: BENCH.sizeGB,
    expectedChunks,
    totalPuts: tracker.puts,
    extraChunkUploads: extraPuts,
    inFlightWindow: tracker.maxInFlight,
    retransmitOverheadPct: overheadPct,
    retransmissionUnder10Pct: overheadPct < 10,
  })
  expect(overheadPct).toBeLessThan(10)
  await unlink(path).catch(() => {})
})
