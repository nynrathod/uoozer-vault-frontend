import { createWriteStream } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import type { Page, CDPSession } from '@playwright/test'
import { BENCH } from '../bench.config'

let progressLast = -1
export function progress(stage: string, current: number, total: number, extra?: string) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 100
  const suffix = extra ? ` — ${extra}` : ''
  console.log(`  [${stage}] ${current}/${total} (${pct}%)${suffix}`)
}

export async function generateTestFile(sizeGB: number) {
  await mkdir(BENCH.tmpDir, { recursive: true })
  const path = `${BENCH.tmpDir}/bench-${sizeGB}gb-${Date.now()}.bin`
  const block = randomBytes(1024 * 1024)
  block.set(randomBytes(32), 0)
  const total = Math.max(1, sizeGB * 1024)
  const hash = createHash('sha256')
  const ws = createWriteStream(path)
  let written = 0
  await new Promise<void>((res, rej) => {
    ws.on('error', rej)
    function pump() {
      while (written < total) {
        hash.update(block)
        written += 1
        if (!ws.write(block)) {
          ws.once('drain', pump)
          return
        }
      }
      ws.end(() => res())
    }
    pump()
  })
  return { path, sha256: hash.digest('hex') }
}

export interface StorageTracker {
  puts: number
  putLog: { url: string; t: number }[]
  maxInFlight: number
}

export async function createStorageTracker(cdp: CDPSession): Promise<StorageTracker> {
  await cdp.send('Network.enable')
  const tracker: StorageTracker = { puts: 0, putLog: [], maxInFlight: 0 }
  const inFlight = new Set<string>()
  cdp.on('Network.requestWillBeSent', (e: any) => {
    const method = (e.request?.method ?? 'GET').toUpperCase()
    const url: string = e.request?.url ?? ''
    if (method === 'PUT' && (url.includes(BENCH.storageHost) || url.includes(':9000'))) {
      tracker.puts++
      tracker.putLog.push({ url, t: Date.now() })
      inFlight.add(e.requestId)
      tracker.maxInFlight = Math.max(tracker.maxInFlight, inFlight.size)
    }
  })
  const done = (e: any) => inFlight.delete(e.requestId)
  cdp.on('Network.loadingFinished', done)
  cdp.on('Network.loadingFailed', done)
  return tracker
}

export async function waitForStoragePuts(
  tracker: StorageTracker,
  expected: number,
  timeoutMs: number
) {
  const t0 = Date.now()
  while (tracker.puts < expected) {
    if (Date.now() - t0 > timeoutMs)
      throw new Error(`upload stalled: ${tracker.puts}/${expected} PUTs`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

export async function awaitCompletion(page: Page, tracker: StorageTracker, expectedPuts: number) {
  let finalizeSeen = false
  const onReq = (r: any) => {
    if (r.method() === 'POST' && r.url().includes('complete')) finalizeSeen = true
  }
  page.on('request', onReq)
  const toast = page.locator('[data-sonner-toast][data-type="error"]').first()
  const t0 = Date.now()
  let lastPuts = tracker.puts,
    lastProgress = Date.now(),
    reloads = 0
  try {
    while (!finalizeSeen) {
      if (Date.now() - t0 > BENCH.timeoutMs)
        throw new Error(
          `completion timeout: puts=${tracker.puts}/${expectedPuts}, finalize=${finalizeSeen}`
        )

      // fail fast with the app's own error message
      if (await toast.count().catch(() => 0)) {
        const text = ((await toast.textContent().catch(() => '')) ?? '').trim()
        throw new Error(
          `APP ERROR TOAST: "${text}" — upload rejected (check backend logs / quota / rate limit)`
        )
      }

      await new Promise((r) => setTimeout(r, 2000))

      if (tracker.puts > lastPuts) {
        progress('resume', tracker.puts, expectedPuts)
        lastPuts = tracker.puts
        lastProgress = Date.now()
      } else if (Date.now() - lastProgress > 180_000) {
        if (tracker.puts === 0) {
          throw new Error(
            'upload never started (0 PUTs, no error toast) — app accepted file but uploaded nothing; check backend logs'
          )
        }
        if (reloads < 3) {
          progress('resume', tracker.puts, expectedPuts, 'no progress 45s, reloading')
          await page.reload({ waitUntil: 'domcontentloaded' })
          reloads++
          lastProgress = Date.now()
        } else {
          throw new Error(`stalled after ${reloads} reloads at ${tracker.puts}/${expectedPuts}`)
        }
      }
    }
    console.log('  [resume] finalize request seen — upload complete')
  } finally {
    page.off('request', onReq)
  }
}

/** Waits until `tracker.puts` reaches `fraction` of `total`, logging progress. */
export async function waitForPutFraction(
  tracker: StorageTracker,
  total: number,
  fraction: number,
  label = 'upload'
) {
  const target = Math.ceil(total * fraction)
  const t0 = Date.now()
  while (tracker.puts < target) {
    if (Date.now() - t0 > BENCH.timeoutMs)
      throw new Error(
        `never reached ${Math.round(fraction * 100)}% point (${tracker.puts}/${target})`
      )
    progress(label, tracker.puts, total)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

/** Any HTTP response (even 401) = backend alive. Connection refused = dead. */
export async function backendAlive(): Promise<boolean> {
  try {
    await fetch(`${BENCH.apiBase}/devices`, { signal: AbortSignal.timeout(3000) })
    return true
  } catch {
    return false
  }
}

async function fillAuth(page: Page, email: string, password: string) {
  const emailField = page.locator('input[name="email"], input[type="email"], input#email').first()
  await emailField.waitFor({ state: 'visible', timeout: 20_000 })
  await emailField.fill(email)
  const pwFields = page.locator('input[type="password"]')
  const n = await pwFields.count()
  for (let i = 0; i < n; i++) await pwFields.nth(i).fill(password)
}

async function attemptLogin(
  page: Page,
  user: { email: string; password: string }
): Promise<'ok' | 'rejected' | 'rate-limited' | 'timeout'> {
  await page.goto(`${BENCH.appUrl}/login`, { waitUntil: 'domcontentloaded' })
  await fillAuth(page, user.email, user.password)
  await page.locator('button[type="submit"]').first().click()
  const left = page
    .waitForFunction(() => !/login|signup|recover|auth/i.test(window.location.pathname), null, {
      timeout: 30_000,
      polling: 500,
    })
    .then(() => 'left' as const)
    .catch(() => 'no' as const)
  const err = page
    .waitForSelector('[data-sonner-toast][data-type="error"]', { timeout: 30_000 })
    .then(() => 'toast' as const)
    .catch(() => 'no' as const)
  const first = await Promise.race([left, err])
  if (first === 'no') return 'timeout'
  if (first === 'toast') {
    const text =
      (await page
        .locator('[data-sonner-toast][data-type="error"]')
        .first()
        .textContent()
        .catch(() => '')) ?? ''
    if (/attempt|rate|limit|too many|minute/i.test(text)) return 'rate-limited'
    return 'rejected'
  }
  return (await page.evaluate(() => /login|signup|recover|auth/i.test(window.location.pathname)))
    ? 'rejected'
    : 'ok'
}

const stateFile = (email: string) => `bench/auth-state-${email.replace(/[^a-z0-9]/gi, '')}.json`

export async function login(page: Page, user = BENCH.users.a) {
  if (!(await backendAlive()))
    throw new Error(
      `BACKEND NOT RUNNING at ${BENCH.apiBase}. Start it (step 1), then rerun. This is why every test failed.`
    )

  // cached session for THIS user (per-user file, no cross-contamination)
  const file = stateFile(user.email)
  if (existsSync(file)) {
    try {
      const items = JSON.parse(readFileSync(file, 'utf8')).origins?.[0]?.localStorage ?? []
      if (items.length) {
        await page.goto(BENCH.appUrl, { waitUntil: 'domcontentloaded' })
        await page.evaluate((items: any[]) => {
          for (const { name, value } of items) localStorage.setItem(name, value)
        }, items)
        await page.reload({ waitUntil: 'domcontentloaded' })
        const authed = await page
          .waitForSelector('input[type="file"]', { state: 'attached', timeout: 15_000 })
          .then(() => true)
          .catch(() => false)
        if (authed) return
        await page.evaluate(() => {
          try {
            localStorage.clear()
          } catch {}
        })
      }
    } catch {
      /* fall through */
    }
  }

  let r = await attemptLogin(page, user)
  if (r === 'rate-limited') {
    console.log('  [bench] rate-limited — waiting 65s')
    await new Promise((res) => setTimeout(res, 65_000))
    r = await attemptLogin(page, user)
    if (r === 'rate-limited')
      throw new Error(
        'still rate-limited — raise auth_per_minute in config/default.toml, restart backend'
      )
  }
  if (r === 'timeout') throw new Error('login timed out — backend died mid-request')
  if (r === 'rejected')
    throw new Error(
      `login rejected for ${user.email}. If this account doesn't exist yet: create it ONCE manually at ${BENCH.appUrl}/signup with the password from bench.config.ts (click through the recovery-key screen), then rerun.`
    )
  try {
    writeFileSync(file, JSON.stringify(await page.context().storageState()))
  } catch {}
}

export async function captureAuthToken(page: Page): Promise<string> {
  return new Promise((resolve) => {
    const onReq = (r: any) => {
      const h = r.headers()['authorization']
      if (h) {
        page.off('request', onReq)
        resolve(h)
      }
    }
    page.on('request', onReq)
  })
}

export async function sql(text: string): Promise<any[]> {
  const { Client } = await import('pg')
  const client = new Client({ connectionString: BENCH.db.url })
  await client.connect()
  try {
    return (await client.query(text)).rows
  } finally {
    await client.end()
  }
}

export function logResult(result: Record<string, unknown>) {
  console.log(`\nBENCH_RESULT ${JSON.stringify(result)}\n`)
}
