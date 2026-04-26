import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Camera, Lab, Lens, RollListItem, Shot } from '~~/types/models'

/**
 * Local mirror of the user's data, kept in IndexedDB.
 *
 * Writes are still authoritative on the server (per the architecture rule:
 * the client never talks to D1 directly). This store is *cache only* — it
 * exists so that:
 *
 *   1. Pages render instantly from local data, even with no network.
 *   2. Offline-queued writes (shots logged with no signal) are visible
 *      immediately in roll detail / home, before they sync to the server.
 *
 * Read flow used by callers:
 *   1. Hydrate ref from IndexedDB (cache-first).
 *   2. In background, fetch from `/api/...`. On success, replace local copy
 *      and re-emit. On failure (offline), keep the cached copy.
 *
 * Pending shots: the offline queue inserts a placeholder shot with
 * `_pending: true` keyed by `client_id`. Once the matching server row arrives
 * (server is idempotent on `(user_id, client_id)`), the placeholder is replaced.
 *
 * Client-only — never imported on the server.
 */

export type PendingShot = Shot & { roll_id: number, _pending: true, _client_id: string }
export type LocalShot = (Shot & { roll_id: number }) | PendingShot

interface FilmDB extends DBSchema {
  rolls: { key: number, value: RollListItem }
  // shots store uses out-of-line composite keys: `${rollId}:s${id}` for synced rows,
  // `${rollId}:c${client_id}` for pending offline rows.
  shots: { key: string, value: LocalShot, indexes: { 'by-roll': number } }
  cameras: { key: number, value: Camera }
  lenses: { key: number, value: Lens }
  labs: { key: number, value: Lab }
}

let dbPromise: Promise<IDBPDatabase<FilmDB>> | null = null

function getDB() {
  // Detect by capability rather than env: works in the browser (real IDB),
  // in tests (fake-indexeddb auto-importer), and bails out cleanly during SSR.
  if (typeof indexedDB === 'undefined') {
    throw new Error('localStore requires IndexedDB (client-only)')
  }
  if (!dbPromise) {
    dbPromise = openDB<FilmDB>('film-logger', 1, {
      upgrade(db) {
        db.createObjectStore('rolls', { keyPath: 'id' })
        const shots = db.createObjectStore('shots') // out-of-line keys
        shots.createIndex('by-roll', 'roll_id')
        db.createObjectStore('cameras', { keyPath: 'id' })
        db.createObjectStore('lenses', { keyPath: 'id' })
        db.createObjectStore('labs', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

function shotKey(rollId: number, idOrClient: { id?: number, client_id?: string | null, _client_id?: string }): string {
  if (idOrClient.id && idOrClient.id > 0) return `${rollId}:s${idOrClient.id}`
  return `${rollId}:c${idOrClient._client_id ?? idOrClient.client_id}`
}

/* ------------------------------- Reads -------------------------------- */

async function readAll<K extends 'rolls' | 'cameras' | 'lenses' | 'labs'>(
  name: K,
): Promise<FilmDB[K]['value'][]> {
  const db = await getDB()
  return db.getAll(name)
}

async function readShotsByRoll(rollId: number): Promise<LocalShot[]> {
  const db = await getDB()
  return db.getAllFromIndex('shots', 'by-roll', rollId)
}

/* ------------------------------- Writes -------------------------------- */

async function replaceAll<K extends 'rolls' | 'cameras' | 'lenses' | 'labs'>(
  name: K,
  rows: FilmDB[K]['value'][],
) {
  const db = await getDB()
  const tx = db.transaction(name, 'readwrite')
  await tx.store.clear()
  for (const row of rows) await tx.store.put(row)
  await tx.done
}

async function replaceShotsForRoll(rollId: number, rows: Shot[]) {
  const db = await getDB()
  const tx = db.transaction('shots', 'readwrite')
  // Drop only this roll's *confirmed* shots; keep pending ones until the server
  // has acknowledged them (matched by client_id).
  const existing = await tx.store.index('by-roll').getAll(rollId)
  const acknowledgedClientIds = new Set(rows.map(r => r.client_id).filter(Boolean) as string[])
  for (const e of existing) {
    if (e._pending && e._client_id && acknowledgedClientIds.has(e._client_id)) {
      await tx.store.delete(shotKey(rollId, e))
    } else if (!e._pending) {
      await tx.store.delete(shotKey(rollId, e))
    }
  }
  for (const s of rows) {
    await tx.store.put({ ...s, roll_id: rollId } as LocalShot, shotKey(rollId, s))
  }
  await tx.done
}

async function putPendingShot(rollId: number, payload: Record<string, unknown>) {
  const db = await getDB()
  const clientId = payload.client_id as string
  // Note that location/notes are stored as ciphertext blobs already — the page
  // encrypts them before calling enqueueShot. So this row is zero-knowledge
  // even when sitting in IndexedDB.
  const row: PendingShot = {
    id: 0 as unknown as number, // placeholder; replaced when server assigns
    client_id: clientId,
    roll_id: rollId,
    frame_number: (payload.frame_number as number | null) ?? null,
    taken_at: (payload.taken_at as string) ?? new Date().toISOString(),
    lens_id: (payload.lens_id as number | null) ?? null,
    aperture: (payload.aperture as number | null) ?? null,
    shutter_speed: (payload.shutter_speed as string | null) ?? null,
    location_encrypted: (payload.location_encrypted as string | null) ?? null,
    notes_encrypted: (payload.notes_encrypted as string | null) ?? null,
    _pending: true,
    _client_id: clientId,
  }
  await db.put('shots', row, `${rollId}:c${clientId}`)
}

async function clearPendingShot(rollId: number, clientId: string) {
  const db = await getDB()
  await db.delete('shots', `${rollId}:c${clientId}`)
}

async function clear() {
  const db = await getDB()
  await Promise.all([
    db.clear('rolls'),
    db.clear('shots'),
    db.clear('cameras'),
    db.clear('lenses'),
    db.clear('labs'),
  ])
}

export const localStore = {
  readAll,
  readShotsByRoll,
  replaceAll,
  replaceShotsForRoll,
  putPendingShot,
  clearPendingShot,
  clear,
  shotKey,
}
