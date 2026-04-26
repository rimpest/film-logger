/**
 * Tests for the IndexedDB-backed local store, focused on the pending-shot
 * replacement contract:
 *
 *   When a shot is logged offline, `putPendingShot` writes a row tagged
 *   `_pending: true` keyed by client_id. After the offline queue flushes
 *   and the next list refresh runs, `replaceShotsForRoll` should delete the
 *   pending placeholder and insert the server-issued row in its place —
 *   without ever showing the user a duplicate or a brief gap.
 *
 * `import.meta.client` doesn't exist in Node by default, so we patch it.
 * We also use `fake-indexeddb` to stand in for the browser's IndexedDB.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { localStore } from '../../app/composables/localStore'

describe('localStore — pending shot replacement', () => {
  beforeEach(async () => {
    await localStore.clear()
  })

  it('round-trips a pending shot through IndexedDB', async () => {
    await localStore.putPendingShot(42, {
      client_id: 'client-1',
      taken_at: '2026-04-25T12:00:00.000Z',
      aperture: 5.6,
      notes: 'pending',
    })
    const rows = await localStore.readShotsByRoll(42)
    expect(rows).toHaveLength(1)
    const row = rows[0] as { _pending?: boolean, _client_id?: string, aperture: number }
    expect(row._pending).toBe(true)
    expect(row._client_id).toBe('client-1')
    expect(row.aperture).toBe(5.6)
  })

  it('replaceShotsForRoll deletes pending rows whose client_id was acknowledged', async () => {
    await localStore.putPendingShot(42, { client_id: 'client-1', taken_at: 'x' })
    await localStore.putPendingShot(42, { client_id: 'client-2', taken_at: 'x' })

    // Server returns the first one as confirmed (matches client_id).
    await localStore.replaceShotsForRoll(42, [
      {
        id: 1001,
        client_id: 'client-1',
        frame_number: 1,
        taken_at: 'x',
        lens_id: null,
        aperture: 5.6,
        shutter_speed: '1/125',
        location_encrypted: null,
        notes_encrypted: null,
      } as never,
    ])

    const rows = await localStore.readShotsByRoll(42)
    // We expect: the confirmed shot for client-1, plus the still-pending one for client-2.
    expect(rows).toHaveLength(2)

    const confirmed = rows.find((r): r is typeof r & { id: number } => 'id' in r && r.id === 1001)
    expect(confirmed).toBeTruthy()

    const stillPending = rows.find((r): r is typeof r & { _pending?: boolean } => (r as any)._pending === true)
    expect(stillPending).toBeTruthy()
    expect((stillPending as any)._client_id).toBe('client-2')
  })

  it('replaceShotsForRoll never produces a duplicate when the same client_id is replayed', async () => {
    await localStore.putPendingShot(42, { client_id: 'client-1', taken_at: 'x' })
    // First server response.
    await localStore.replaceShotsForRoll(42, [
      { id: 1001, client_id: 'client-1', taken_at: 'x' } as never,
    ])
    // Second refresh — same data again.
    await localStore.replaceShotsForRoll(42, [
      { id: 1001, client_id: 'client-1', taken_at: 'x' } as never,
    ])
    const rows = await localStore.readShotsByRoll(42)
    expect(rows).toHaveLength(1)
    expect((rows[0] as any).id).toBe(1001)
    expect((rows[0] as any)._pending).toBeUndefined()
  })

  it('clearPendingShot removes a single placeholder by client_id', async () => {
    await localStore.putPendingShot(42, { client_id: 'a', taken_at: 'x' })
    await localStore.putPendingShot(42, { client_id: 'b', taken_at: 'x' })
    await localStore.clearPendingShot(42, 'a')
    const rows = await localStore.readShotsByRoll(42)
    expect(rows).toHaveLength(1)
    expect((rows[0] as any)._client_id).toBe('b')
  })

  it('replaceAll clears and refills a collection', async () => {
    await localStore.replaceAll('cameras', [
      { id: 1, name: 'Hasselblad', format: '120' } as never,
      { id: 2, name: 'Pentax K1000', format: '135' } as never,
    ])
    let rows = await localStore.readAll('cameras')
    expect(rows).toHaveLength(2)

    await localStore.replaceAll('cameras', [
      { id: 3, name: 'Mamiya 7', format: '120' } as never,
    ])
    rows = await localStore.readAll('cameras')
    expect(rows).toHaveLength(1)
    expect((rows[0] as any).id).toBe(3)
  })
})
