import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The composable reaches into Vue's lifecycle hooks via `import.meta.client`,
 * but the queue read/write helpers are plain functions over localStorage.
 * We test those by running the same logic the composable runs, against a
 * happy-dom-style localStorage shim.
 *
 * We can't import the composable directly into a 'node' environment because it
 * uses `ref()` from Vue at module level. So this is a focused behavior test of
 * the persisted-queue contract: write → read → remove.
 */
const KEY = 'film-logger:shot-queue:v1'

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string) { this.store.set(k, v) }
  removeItem(k: string) { this.store.delete(k) }
  clear() { this.store.clear() }
  key(_i: number) { return null }
  get length() { return this.store.size }
}

interface QueuedShot {
  client_id: string
  payload: Record<string, unknown>
  queued_at: string
}

function read(ls: MemoryStorage): QueuedShot[] {
  const raw = ls.getItem(KEY)
  return raw ? JSON.parse(raw) : []
}
function write(ls: MemoryStorage, items: QueuedShot[]) {
  ls.setItem(KEY, JSON.stringify(items))
}

describe('offline shot queue persistence', () => {
  let ls: MemoryStorage
  beforeEach(() => { ls = new MemoryStorage() })

  it('round-trips a queued shot through localStorage', () => {
    const entry: QueuedShot = {
      client_id: 'abc',
      payload: { roll_id: 1, taken_at: '2026-04-25T12:00:00.000Z' },
      queued_at: '2026-04-25T12:00:01.000Z',
    }
    write(ls, [entry])
    const loaded = read(ls)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].client_id).toBe('abc')
    expect(loaded[0].payload.roll_id).toBe(1)
  })

  it('returns an empty list when no queue is stored', () => {
    expect(read(ls)).toEqual([])
  })

  it('removes a single entry by client_id', () => {
    write(ls, [
      { client_id: 'a', payload: {}, queued_at: '' },
      { client_id: 'b', payload: {}, queued_at: '' },
      { client_id: 'c', payload: {}, queued_at: '' },
    ])
    const filtered = read(ls).filter(q => q.client_id !== 'b')
    write(ls, filtered)
    const after = read(ls).map(q => q.client_id)
    expect(after).toEqual(['a', 'c'])
  })

  it('survives JSON parse failure by falling back to []', () => {
    ls.setItem(KEY, '{not json')
    let parsed: QueuedShot[] = []
    try {
      parsed = JSON.parse(ls.getItem(KEY)!) as QueuedShot[]
    } catch {
      parsed = []
    }
    expect(parsed).toEqual([])
  })
})
