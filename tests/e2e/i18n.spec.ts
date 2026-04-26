import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Verifies device-language detection: when the browser advertises Spanish,
 * the UI renders in Spanish without any user action.
 *
 * Also captures one screenshot of the Spanish home/login so a reviewer can
 * eyeball the translation against the English screenshots in the same dir.
 */
const SHOT_DIR = join(process.cwd(), 'tests/e2e/screenshots')
mkdirSync(SHOT_DIR, { recursive: true })

test.use({
  locale: 'es-MX',
  extraHTTPHeaders: { 'accept-language': 'es-MX,es;q=0.9,en;q=0.5' },
})

test('renders in Spanish when the browser advertises es-MX', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')

  // The login page should render in Spanish — heading + tagline + footer link.
  await expect(page.getByRole('heading', { name: /Iniciar sesión/i })).toBeVisible()
  await expect(page.getByText('Registra tus tomas en el momento.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Crear cuenta/i })).toBeVisible()

  await page.screenshot({ path: join(SHOT_DIR, '24-login-es.png'), fullPage: true })

  await page.getByRole('link', { name: /Crear cuenta/i }).click()
  await expect(page.getByRole('heading', { name: /Crear cuenta/i })).toBeVisible()
  await page.screenshot({ path: join(SHOT_DIR, '25-register-es.png'), fullPage: true })
})
