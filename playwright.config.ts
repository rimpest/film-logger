import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config.
 *
 * Boots `bun run dev` as the webServer, then drives a real Chromium through
 * the full app flow. Uses the local-mode NuxtHub D1 — every test run gets a
 * fresh randomized username, so the database can be reused across runs.
 *
 * Browser binaries live under /opt/pw-browsers (pre-installed on the host).
 *
 * Run:
 *   bun run e2e
 *
 * Screenshots land under `tests/e2e/screenshots/` and are checked in so
 * reviewers can see what the rendered app looks like without running it.
 */
const PORT = process.env.PLAYWRIGHT_PORT ?? '3939'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/.output',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 12-ish, mobile-first
    // Force English so the existing screenshots and text-based selectors
    // stay stable. The app supports Spanish too; see the i18n test below.
    locale: 'en-US',
    extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],

  webServer: {
    command: `bun run dev --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: true,
    env: {
      NUXT_SESSION_PASSWORD: 'e2e-test-session-secret-must-be-at-least-32-chars',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
