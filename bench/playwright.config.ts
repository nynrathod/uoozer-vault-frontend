import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './specs',
  timeout: 40 * 60 * 1000,
  workers: 1, // sequential: tests share MinIO + Postgres
  retries: 0, // chaos results must not be retried silently
  reporter: [['list']],
  use: { headless: true, viewport: { width: 1440, height: 900 } },
})
