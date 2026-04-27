import { localStore } from './localStore'

/**
 * Offline write queue for shot logging.
 *
 * Strategy:
 *   - Every "create shot" mutation calls `enqueueShot()`. The payload is
 *     written to localStorage (durable across reloads) AND inserted into
 *     IndexedDB as a `_pending` shot row, so the UI sees it immediately on
 *     subsequent reads — even before the server has acknowledged it.
 *   - On `online` events and on app start, `flush()` replays each queued
 *     write to `/api/shots`. The server is idempotent on `(user_id, client_id)`
 *     so a double-replay is safe.
 *   - On success: remove from queue. The next read of the roll detail will
 *     replace the pending row with the server-confirmed one (matched by
 *     `client_id` in `localStore.replaceShotsForRoll`).
 *
 * This is intentionally minimal — full bidirectional sync of edits/deletes
 * is v2 work. The MVP guarantee: if you log a shot offline, it's visible
 * immediately AND it doesn't get lost.
 */
const QUEUE_KEY = 'film-logger:shot-queue:v1'

export interface QueuedShot {
  client_id: string
  payload: Record<string, unknown>
  queued_at: string
}

function read(): QueuedShot[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedShot[]) : []
  } catch {
    return []
  }
}

function write(items: QueuedShot[]) {
  if (!import.meta.client) return
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
}

const queue = ref<QueuedShot[]>([])
const flushing = ref(false)
const online = ref(true)

export function useOfflineQueue() {
  if (import.meta.client && queue.value.length === 0) {
    queue.value = read()
    online.value = navigator.onLine
  }

  function refresh() {
    queue.value = read()
  }

  function enqueueShot(payload: Record<string, unknown>): QueuedShot {
    const client_id = (payload.client_id as string | undefined) ?? crypto.randomUUID()
    const entry: QueuedShot = {
      client_id,
      payload: { ...payload, client_id },
      queued_at: new Date().toISOString(),
    }
    const next = [...read(), entry]
    write(next)
    queue.value = next
    // Mirror into IndexedDB so views render the pending shot immediately.
    const rollId = entry.payload.roll_id as number
    if (rollId) {
      void localStore.putPendingShot(rollId, entry.payload)
    }
    return entry
  }

  function remove(clientId: string) {
    const next = read().filter(q => q.client_id !== clientId)
    write(next)
    queue.value = next
  }

  async function flush() {
    if (flushing.value || !online.value) return
    const items = read()
    if (!items.length) return
    flushing.value = true
    try {
      for (const item of items) {
        try {
          await $fetch('/api/shots', { method: 'POST', body: item.payload })
          remove(item.client_id)
          // We deliberately leave the IndexedDB pending row in place until the
          // next list refresh — `localStore.replaceShotsForRoll` matches on
          // client_id and replaces it with the server-confirmed row, so the
          // user never sees the shot momentarily disappear.
        } catch (err: any) {
          // 4xx = bad data, drop it so we don't loop forever.
          // 5xx / network errors = leave for next attempt.
          const status = err?.response?.status ?? err?.statusCode
          if (status && status >= 400 && status < 500) {
            remove(item.client_id)
          } else {
            break
          }
        }
      }
    } finally {
      flushing.value = false
    }
  }

  if (import.meta.client) {
    onMounted(() => {
      const onOnline = () => { online.value = true; void flush() }
      const onOffline = () => { online.value = false }
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOffline)
      // Best-effort flush on mount.
      void flush()
      onUnmounted(() => {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOffline)
      })
    })
  }

  return {
    queue,
    online,
    flushing,
    enqueueShot,
    flush,
    refresh,
  }
}
