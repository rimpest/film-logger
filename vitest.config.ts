import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Unit test config — fast, no Nuxt boot, no DB.
 * Tests pure helpers (validation schemas, derived state, recovery codes,
 * offline queue persistence contract).
 *
 * Integration tests live in `vitest.integration.config.ts` and run separately
 * via `bun run test:integration` because they boot the full Nuxt app + D1.
 */
export default defineConfig({
  test: {
    name: 'unit',
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
