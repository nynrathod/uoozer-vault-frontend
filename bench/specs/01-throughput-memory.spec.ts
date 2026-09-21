import { test } from '@playwright/test'
import { unlink } from 'node:fs/promises'
import { BENCH } from '../bench.config'
import {
  generateTestFile,
  login,
  createStorageTracker,
  waitForStoragePuts,
  logResult,
} from '../lib/helpers'

const PLAINTEXT_CHUNK = 4 * 1024 * 1024

test('encrypted upload: throughput + memory bound + parallelism', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const tracker = await createStorageTracker(cdp)
  await login(page)

  const { path } = await generateTestFile(BENCH.sizeGB)
  const bytes = BENCH.sizeGB * 1024 ** 3
  const expectedChunks = Math.ceil(bytes / PLAINTEXT_CHUNK)

  const heapSamples: number[] = []
  const sampler = setInterval(async () => {
    try {
      const { metrics } = await cdp.send('Performance.getMetrics')
      const h = metrics.find((m: any) => m.name === 'JSHeapUsedSize')?.value
      if (h) heapSamples.push(h)
    } catch {}
  }, 500)

  const t0 = Date.now()
  await page.setInputFiles('input[type="file"]', path)

  // completion = finalize request seen OR all chunk PUTs seen, whichever first
  const finalizeSeen = page
    .waitForRequest((r) => r.method() === 'POST' && r.url().includes('complete'), {
      timeout: BENCH.timeoutMs,
    })
    .then(() => 'finalize-request')
    .catch(() => null)
  const allPuts = waitForStoragePuts(tracker, expectedChunks, BENCH.timeoutMs).then(
    () => 'all-puts'
  )
  const signal = await Promise.race([finalizeSeen, allPuts])

  await new Promise((r) => setTimeout(r, 5000)) // let finalize + toast settle
  const durationMs = Date.now() - t0
  clearInterval(sampler)

  logResult({
    spec: '01-throughput-memory',
    sizeGB: BENCH.sizeGB,
    completionSignal: signal,
    durationMs,
    throughputMBps: +(bytes / 1e6 / (durationMs / 1000)).toFixed(1),
    maxHeapMB: +(Math.max(0, ...heapSamples) / 1e6).toFixed(1),
    parallelChunkStreams: tracker.maxInFlight,
    chunkPuts: tracker.puts,
    heapSamples: heapSamples.length,
  })
  await unlink(path).catch(() => {})
})
