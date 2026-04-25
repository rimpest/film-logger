import { localStore } from './localStore'
import type { Camera, Lab, Lens, RollListItem, Shot } from '~~/types/models'

/**
 * Cache-first fetch helpers backed by `localStore` (IndexedDB).
 *
 * Each helper:
 *   1. Hydrates the returned ref synchronously from the cached IndexedDB rows
 *      (resolves with whatever's there — could be empty on first run).
 *   2. Kicks off a background fetch to `/api/...`. On success, writes the
 *      response into IndexedDB and updates the ref. On failure (offline,
 *      server error), keeps the cached value and does not throw.
 *
 * The returned ref always reflects "whatever we know locally right now".
 * Pages can render against it on first paint without flicker, and they
 * see offline-queued writes immediately because those land in IndexedDB
 * before the network call ever happens.
 */

interface Cached<T> {
  data: Ref<T>
  refresh: () => Promise<void>
  pending: Ref<boolean>
  error: Ref<unknown>
}

function makeCached<T>(initial: T): Cached<T> {
  return {
    data: ref(initial) as Ref<T>,
    refresh: async () => {},
    pending: ref(false),
    error: ref(null),
  }
}

export function useCachedRolls(filter?: 'active' | 'loaded' | 'finished' | 'archived') {
  const out = makeCached<RollListItem[]>([])
  const query = filter ? `?status=${filter}` : ''

  async function hydrate() {
    if (!import.meta.client) return
    const rows = await localStore.readAll('rolls')
    out.data.value = filter ? applyFilter(rows, filter) : rows
  }

  async function refresh() {
    out.pending.value = true
    out.error.value = null
    try {
      const fresh = await $fetch<RollListItem[]>(`/api/rolls${query}`)
      // We only cache the unfiltered superset to keep things simple — but the
      // filtered fetch may not return archived rows, so only replace what we
      // have if no filter was applied. Otherwise merge.
      if (!filter) {
        await localStore.replaceAll('rolls', fresh)
      } else {
        await mergeReplace('rolls', fresh)
      }
      out.data.value = fresh
    } catch (e) {
      out.error.value = e
      // keep cached value already in out.data.value
    } finally {
      out.pending.value = false
    }
  }

  if (import.meta.client) {
    onMounted(async () => {
      await hydrate()
      await refresh()
    })
  }

  return { ...out, refresh }
}

export function useCachedRollDetail(rollId: number) {
  const roll = ref<RollListItem | null>(null)
  const shots = ref<Shot[]>([])
  const developments = ref<unknown[]>([])
  const pending = ref(false)
  const error = ref<unknown>(null)

  async function hydrate() {
    if (!import.meta.client) return
    const cachedRolls = await localStore.readAll('rolls')
    roll.value = cachedRolls.find(r => r.id === rollId) ?? null
    shots.value = (await localStore.readShotsByRoll(rollId)) as Shot[]
  }

  async function refresh() {
    pending.value = true
    error.value = null
    try {
      const fresh = await $fetch<{
        roll: RollListItem & { camera_format: string }
        shots: Shot[]
        developments: unknown[]
      }>(`/api/rolls/${rollId}`)
      roll.value = fresh.roll
      shots.value = fresh.shots
      developments.value = fresh.developments
      await localStore.replaceShotsForRoll(rollId, fresh.shots)
    } catch (e) {
      error.value = e
    } finally {
      pending.value = false
    }
  }

  if (import.meta.client) {
    onMounted(async () => {
      await hydrate()
      await refresh()
    })
  }

  return { roll, shots, developments, pending, error, refresh }
}

export function useCachedCameras() {
  return cachedCollection<Camera>('cameras', '/api/cameras')
}

export function useCachedLenses() {
  return cachedCollection<Lens>('lenses', '/api/lenses')
}

export function useCachedLabs() {
  return cachedCollection<Lab>('labs', '/api/labs')
}

function cachedCollection<T extends { id: number }>(
  name: 'cameras' | 'lenses' | 'labs',
  url: string,
): Cached<T[]> {
  const data = ref<T[]>([]) as Ref<T[]>
  const pending = ref(false)
  const error = ref<unknown>(null)

  async function refresh() {
    pending.value = true
    error.value = null
    try {
      const fresh = await $fetch<T[]>(url)
      data.value = fresh
      await localStore.replaceAll(name, fresh as never)
    } catch (e) {
      error.value = e
    } finally {
      pending.value = false
    }
  }

  if (import.meta.client) {
    onMounted(async () => {
      const cached = await localStore.readAll(name)
      data.value = cached as T[]
      await refresh()
    })
  }

  return { data, refresh, pending, error }
}

function applyFilter(rows: RollListItem[], status: 'active' | 'loaded' | 'finished' | 'archived') {
  if (status === 'active') return rows.filter(r => r.status === 'loaded' || r.status === 'finished')
  return rows.filter(r => r.status === status)
}

async function mergeReplace<K extends 'rolls' | 'cameras' | 'lenses' | 'labs'>(
  name: K,
  fresh: Array<{ id: number }>,
) {
  const cached = await localStore.readAll(name)
  const ids = new Set(fresh.map(f => f.id))
  const merged = [...fresh, ...cached.filter(c => !ids.has(c.id))]
  await localStore.replaceAll(name, merged as never)
}
