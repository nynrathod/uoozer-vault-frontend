import { test, expect } from '@playwright/test'
import { BENCH } from '../bench.config'
import { logResult } from '../lib/helpers'

const N = 8
const GAP_MS = 9000 // respect auth rate limit (10/min)

async function timedLoginAttempt(page: any, email: string, password: string): Promise<number> {
  await page.goto(`${BENCH.appUrl}/login`, { waitUntil: 'domcontentloaded' })
  const emailField = page.locator('input[name="email"], input[type="email"], input#email').first()
  await emailField.waitFor({ state: 'visible', timeout: 20_000 })
  await emailField.fill(email)
  await page.locator('input[type="password"], input[name="password"]').first().fill(password)
  const t0 = Date.now()
  await page.locator('button[type="submit"]').first().click()
  await Promise.race([
    page.waitForFunction(() => !/login|signup|recover|auth/i.test(window.location.pathname), null, {
      timeout: 60_000,
      polling: 500,
    }),
    page.waitForSelector('[data-sonner-toast][data-type="error"]', { timeout: 60_000 }),
  ])
  const dt = Date.now() - t0
  await page.evaluate(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  return dt
}

test('login timing: known vs unknown email indistinguishable', async ({ page }) => {
  await page.goto(BENCH.appUrl)
  const known: number[] = [],
    unknown: number[] = []
  for (let i = 0; i < N; i++) {
    known.push(await timedLoginAttempt(page, BENCH.users.a.email, 'WrongPass123!')) // same failure mode
    await new Promise((r) => setTimeout(r, GAP_MS))
    unknown.push(
      await timedLoginAttempt(page, `ghost-${i}-${Date.now()}@test.local`, 'WrongPass123!')
    )
    await new Promise((r) => setTimeout(r, GAP_MS))
  }
  const avg = (a: number[]) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(0)
  const delta = Math.abs(avg(known) - avg(unknown))
  logResult({
    spec: '07-login-timing',
    n: N,
    knownAvgMs: avg(known),
    unknownAvgMs: avg(unknown),
    deltaMs: delta,
    sideChannelClosed: delta < 200,
  })
  expect(delta).toBeLessThan(200)
})
