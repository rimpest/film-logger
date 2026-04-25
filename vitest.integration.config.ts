import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Integration test config — uses `setup()` from `@nuxt/test-utils/e2e`,
 * which forks a real Nuxt+Nitro process. Test files themselves run in a
 * plain Node environment; we don't need (and don't want) the `nuxt` Vitest
 * environment because that pulls Vite-node into the test process and
 * conflicts with Nitro module resolution.
 *
 * Run with: bun run test:integration
 */
export default defineConfig({
  test: {
    name: 'integration',
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
