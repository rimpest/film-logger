import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'

/**
 * End-to-end happy-path: a brand-new user goes from registration through
 * logging a shot and sending the roll to a lab. Hits real `/api` routes
 * against the Nuxt dev server with NuxtHub local D1.
 *
 * Relies on:
 *   • NUXT_SESSION_PASSWORD set in env (we set a test one in setup).
 *   • Migrations applied automatically by NuxtHub on dev boot.
 *   • Each test run gets a unique username so re-runs don't collide.
 */

const username = `test_${Math.random().toString(36).slice(2, 10)}`
const password = 'integration-test-pw-1'

let cookie = ''

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  dev: true,
  browser: false,
  env: {
    NUXT_SESSION_PASSWORD: 'test-session-secret-must-be-at-least-32-chars',
  },
})

// `fetch` from @nuxt/test-utils returns a Response. We capture the session
// cookie from /auth/login|register and replay it on subsequent calls.
async function call<T>(
  path: string,
  init: { method?: string, body?: unknown, headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...init.headers,
  }
  if (cookie) headers.cookie = cookie
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body == null ? undefined : JSON.stringify(init.body),
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

describe('full user flow', () => {
  it('registers a new user and returns a recovery code', async () => {
    const res = await call<{ id: number, recovery_code: string }>('/api/auth/register', {
      method: 'POST',
      body: { username, password },
    })
    expect(res.id).toBeGreaterThan(0)
    expect(res.recovery_code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/)
  })

  it('authenticated user can fetch /api/auth/me', async () => {
    const me = await call<{ user: { id: number, username: string } | null }>('/api/auth/me')
    expect(me.user?.username).toBe(username)
  })

  let cameraId = 0
  it('creates a camera', async () => {
    const res = await call<{ id: number }>('/api/cameras', {
      method: 'POST',
      body: { name: 'Hasselblad 500 C/M', format: '120', has_interchangeable_back: true },
    })
    cameraId = res.id
    expect(cameraId).toBeGreaterThan(0)
  })

  let lensId = 0
  it('creates a lens tagged for the new camera', async () => {
    const res = await call<{ id: number }>('/api/lenses', {
      method: 'POST',
      body: {
        name: 'Zeiss Planar 80mm f/2.8',
        focal_length_mm: 80,
        max_aperture: 2.8,
        camera_ids: [cameraId],
      },
    })
    lensId = res.id
    expect(lensId).toBeGreaterThan(0)
  })

  it('returns the lens when filtering by camera_id', async () => {
    const lenses = await call<Array<{ id: number }>>(`/api/lenses?camera_id=${cameraId}`)
    expect(lenses.find(l => l.id === lensId)).toBeTruthy()
  })

  let rollId = 0
  it('loads a roll into the camera', async () => {
    const res = await call<{ id: number }>('/api/rolls', {
      method: 'POST',
      body: {
        camera_id: cameraId,
        film_stock: 'Kodak Portra 400',
        iso: 400,
        frame_count: 12,
      },
    })
    rollId = res.id
  })

  it('logs a shot against that roll, with idempotency on client_id', async () => {
    const client_id = crypto.randomUUID()
    const body = {
      client_id,
      roll_id: rollId,
      lens_id: lensId,
      aperture: 5.6,
      shutter_speed: '1/125',
      latitude: 25.6866,
      longitude: -100.3161,
      notes: 'Cerro de la Silla',
    }
    const a = await call<{ id: number }>('/api/shots', { method: 'POST', body })
    const b = await call<{ id: number }>('/api/shots', { method: 'POST', body })
    expect(a.id).toBe(b.id) // replayed offline write must not duplicate
  })

  it('roll detail returns the shot we just logged', async () => {
    const detail = await call<{ shots: Array<{ id: number, lens_name: string }> }>(`/api/rolls/${rollId}`)
    expect(detail.shots).toHaveLength(1)
    expect(detail.shots[0].lens_name).toBe('Zeiss Planar 80mm f/2.8')
  })

  let labId = 0
  it('creates a lab', async () => {
    const res = await call<{ id: number }>('/api/labs', {
      method: 'POST',
      body: { name: 'Test Lab MTY', address: 'Monterrey, MX' },
    })
    labId = res.id
  })

  it('marks the roll finished and creates a development record', async () => {
    await call(`/api/rolls/${rollId}`, { method: 'PATCH', body: { status: 'finished' } })

    const dev = await call<{ id: number }>('/api/developments', {
      method: 'POST',
      body: {
        roll_id: rollId,
        lab_id: labId,
        status: 'dropped_off',
        dropped_off_at: new Date().toISOString(),
        process: 'C-41',
        push_pull_stops: 0,
        scans_requested: true,
        scan_resolution: 'high',
      },
    })
    expect(dev.id).toBeGreaterThan(0)
  })

  it('derives "at_lab" state from the joined latest_development_status', async () => {
    const rolls = await call<Array<{
      id: number, status: string, latest_development_status: string | null,
    }>>('/api/rolls')
    const r = rolls.find(x => x.id === rollId)!
    expect(r.status).toBe('finished')
    expect(r.latest_development_status).toBe('dropped_off')
  })

  it('rejects requests from unauthenticated callers', async () => {
    const savedCookie = cookie
    cookie = ''
    await expect(call('/api/cameras')).rejects.toThrow()
    cookie = savedCookie
  })

  it('logout clears the session', async () => {
    await call('/api/auth/logout', { method: 'POST' })
    cookie = ''
    const me = await call<{ user: unknown }>('/api/auth/me')
    expect(me.user).toBeNull()
  })
})
