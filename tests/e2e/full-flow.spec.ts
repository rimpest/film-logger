import { test, expect, type Page, type Locator } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * End-to-end UI test: drives a real Chromium through the entire MVP flow
 * against a live Nuxt dev server (with NuxtHub local D1), taking screenshots
 * at each meaningful step.
 *
 * Selector strategy: Nuxt UI 4's `UFormField` separates labels from inputs
 * across DOM nodes, but the inputs expose stable `autocomplete`,
 * `placeholder`, `name`, and `type` attributes — we prefer those.
 *
 * Hydration: the dev server lazy-loads component chunks, so a `page.fill()`
 * fired before Vue hooks the input listener silently no-ops on the v-model.
 * Every interaction goes through `hydratedFill` / `hydratedClick` which wait
 * for the form / button to be Vue-bound before driving it.
 */
const SHOT_DIR = join(process.cwd(), 'tests/e2e/screenshots')
mkdirSync(SHOT_DIR, { recursive: true })

const username = `e2e_${Math.random().toString(36).slice(2, 9)}`
const password = 'e2e-strong-password-1'

let stepCounter = 0
async function shoot(page: Page, name: string) {
  stepCounter++
  const file = join(SHOT_DIR, `${String(stepCounter).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
}

/** Wait for Vue to finish hooking up event listeners on the active form. */
async function waitForFormHydration(page: Page, timeout = 30_000) {
  await page.waitForFunction(() => {
    const f = document.querySelector('form') as any
    return f && f.__vnode?.props && 'onSubmit' in f.__vnode.props
  }, null, { timeout })
}

/** Fill an input and wait for v-model to absorb the value. */
async function hydratedFill(locator: Locator, value: string) {
  await locator.waitFor({ state: 'visible' })
  await locator.fill(value)
  // Sanity: the input should reflect the value (and Vue's v-model
  // mirror it on next microtask).
  await expect(locator).toHaveValue(value)
}

async function hydratedClick(locator: Locator) {
  await locator.waitFor({ state: 'visible' })
  await expect(locator).toBeEnabled()
  await locator.click()
}

test('full user flow with screenshots', async ({ page }) => {
  test.setTimeout(240_000)

  // Console / network logging for post-mortem debugging.
  page.on('pageerror', err => console.log(`[browser pageerror] ${err.message}`))
  page.on('response', async r => {
    if (r.url().includes('/api/') && !r.url().includes('/_nuxt/') && r.status() >= 400) {
      console.log(`[api ${r.status()}] ${r.request().method()} ${r.url()} ${(await r.text().catch(() => '')).slice(0, 200)}`)
    }
  })

  // ---- 1. Login screen --------------------------------------------------
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible()
  await shoot(page, 'login-empty')

  await page.getByRole('link', { name: /Create an account/i }).click()
  await expect(page).toHaveURL(/\/register/)
  await waitForFormHydration(page)
  await shoot(page, 'register-empty')

  // ---- 2. Register ------------------------------------------------------
  await hydratedFill(page.locator('input[autocomplete="username"]'), username)
  const newPwd = page.locator('input[autocomplete="new-password"]')
  await hydratedFill(newPwd.nth(0), password)
  await hydratedFill(newPwd.nth(1), password)
  await shoot(page, 'register-filled')

  await hydratedClick(page.getByRole('button', { name: /^Create account$/ }))
  await expect(page.getByText(/Save your recovery code/i)).toBeVisible({ timeout: 30_000 })
  await shoot(page, 'register-recovery-code')

  await hydratedClick(page.getByRole('button', { name: /I've saved it/i }))
  await expect(page).toHaveURL('/')

  // ---- 3. Empty home ----------------------------------------------------
  await expect(page.getByText(/No active rolls/i)).toBeVisible()
  await shoot(page, 'home-empty')

  // ---- 4. Add a camera --------------------------------------------------
  await page.goto('/cameras')
  await expect(page.getByRole('heading', { name: /Cameras/i })).toBeVisible()
  await shoot(page, 'cameras-empty')

  await hydratedClick(page.getByRole('button', { name: /Add camera/i }))
  await waitForFormHydration(page)
  await hydratedFill(page.locator('input').first(), 'Hasselblad 500 C/M')
  await shoot(page, 'camera-form')

  await hydratedClick(page.getByRole('button', { name: /^Save$/ }))
  await expect(page.getByText('Hasselblad 500 C/M')).toBeVisible({ timeout: 15_000 })
  await shoot(page, 'camera-saved')

  // ---- 5. Add a lens ----------------------------------------------------
  await page.goto('/lenses')
  await expect(page.getByRole('heading', { name: /Lenses/i })).toBeVisible()
  await hydratedClick(page.getByRole('button', { name: /Add lens/i }))
  await waitForFormHydration(page)
  const lensInputs = page.locator('input:visible')
  await hydratedFill(lensInputs.nth(0), 'Zeiss Planar 80mm f/2.8')
  await hydratedFill(lensInputs.nth(1), '80')
  await shoot(page, 'lens-form')

  await hydratedClick(page.getByRole('button', { name: /^Save$/ }))
  await expect(page.getByText(/Zeiss Planar 80mm/)).toBeVisible({ timeout: 15_000 })
  await shoot(page, 'lens-saved')

  // ---- 6. Load a roll ---------------------------------------------------
  await page.goto('/rolls/new')
  await waitForFormHydration(page)
  await hydratedFill(page.locator('input:visible').first(), 'Kodak Portra 400')
  await shoot(page, 'roll-form')

  await hydratedClick(page.getByRole('button', { name: /Load roll/i }))
  await expect(page).toHaveURL(/\/rolls\/\d+$/, { timeout: 15_000 })
  const rollUrl = page.url()
  await shoot(page, 'roll-detail-empty')

  // ---- 7. Log a shot ----------------------------------------------------
  await page.goto('/log')
  await waitForFormHydration(page).catch(() => {}) // log page may have form OR not depending on rolls
  await shoot(page, 'log-screen')

  // Aperture preset, then notes.
  await hydratedClick(page.getByRole('button', { name: 'f/5.6' }))
  await page.locator('textarea:visible').last().fill('Cerro de la Silla — first frame')
  await shoot(page, 'log-filled')

  await hydratedClick(page.getByRole('button', { name: /Save shot/i }))
  await expect(page).toHaveURL(/\/rolls\/\d+$/, { timeout: 15_000 })
  await expect(page.getByText(/Cerro de la Silla/)).toBeVisible({ timeout: 15_000 })
  await shoot(page, 'shot-logged')

  // ---- 8. Mark roll finished --------------------------------------------
  await hydratedClick(page.getByRole('button', { name: /Mark finished/i }))
  await expect(
    page.getByRole('link', { name: /Send to lab/i })
      .or(page.getByRole('button', { name: /Send to lab/i })),
  ).toBeVisible({ timeout: 10_000 })
  await shoot(page, 'roll-finished')

  // ---- 9. Add a lab -----------------------------------------------------
  await page.goto('/labs')
  await expect(page.getByRole('heading', { name: /^Labs$/ })).toBeVisible()
  await hydratedClick(page.getByRole('button', { name: /Add lab/i }))
  await waitForFormHydration(page)
  const labInputs = page.locator('input:visible')
  await hydratedFill(labInputs.nth(0), 'Boutique Lab MTY')
  await hydratedFill(labInputs.nth(1), 'Monterrey, MX')
  await shoot(page, 'lab-form')

  await hydratedClick(page.getByRole('button', { name: /^Save$/ }))
  await expect(page.getByText('Boutique Lab MTY')).toBeVisible({ timeout: 15_000 })
  await shoot(page, 'lab-saved')

  // ---- 10. Send roll to lab --------------------------------------------
  await page.goto(rollUrl)
  await hydratedClick(
    page.getByRole('link', { name: /Send to lab/i })
      .or(page.getByRole('button', { name: /Send to lab/i }))
      .first(),
  )
  await expect(page).toHaveURL(/\/send/)
  await waitForFormHydration(page)
  await shoot(page, 'send-to-lab-form')
  await hydratedClick(page.getByRole('button', { name: /Save development record/i }))
  await expect(page).toHaveURL(rollUrl, { timeout: 15_000 })
  await expect(page.getByText(/At lab/i).first()).toBeVisible({ timeout: 10_000 })
  await shoot(page, 'roll-at-lab')

  // ---- 11. Rolls list --------------------------------------------------
  await page.goto('/rolls')
  await expect(page.getByText('Kodak Portra 400')).toBeVisible({ timeout: 15_000 })
  await shoot(page, 'rolls-list')

  // ---- 12. Settings + log out ------------------------------------------
  await page.goto('/settings')
  await shoot(page, 'settings')
  await hydratedClick(page.getByRole('button', { name: /^Sign out$/ }).first())
  await expect(page).toHaveURL(/\/login/)
  await shoot(page, 'logged-out')
})
