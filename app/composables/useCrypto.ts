/**
 * Client-side encryption (zero-knowledge to the server).
 *
 * Threat model: a database operator must not be able to read user notes or
 * shot locations. So:
 *
 *   1. At register, the server mints a per-user salt (`users.key_salt`,
 *      16 random bytes). It's not a secret — it just needs to be stable.
 *   2. The client derives an AES-GCM 256-bit key with PBKDF2-SHA256 from
 *      `password + key_salt` (200 000 iterations).
 *   3. Sensitive fields are AES-GCM encrypted client-side: `IV (12 bytes) ||
 *      ciphertext` is base64-encoded and stored in the `*_encrypted` columns.
 *      The server treats them as opaque strings and never decrypts.
 *
 * Key persistence:
 *   The derived `CryptoKey` is stored in IndexedDB as a *non-extractable*
 *   key. That means it survives page reloads (so offline users don't have to
 *   re-type their password on a refresh) but its raw bytes can't be exported
 *   from JS — even via DevTools — only used for further encrypt/decrypt calls.
 *   On logout we wipe both the key and every cached row.
 *
 * Compatibility note: AES-GCM and PBKDF2 are part of the Web Crypto API,
 * available in every modern browser and in Cloudflare Workers (where we
 * never need to run this — the server is intentionally key-less).
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

const KEY_DB = 'film-logger-keys'
const KEY_STORE = 'keys'
const KEY_NAME = 'master'
const PBKDF2_ITERATIONS = 200_000

interface KeyDB extends DBSchema {
  keys: { key: string, value: CryptoKey }
}

let keyDbPromise: Promise<IDBPDatabase<KeyDB>> | null = null

function getKeyDB() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('useCrypto requires IndexedDB (client-only)')
  }
  if (!keyDbPromise) {
    keyDbPromise = openDB<KeyDB>(KEY_DB, 1, {
      upgrade(db) {
        db.createObjectStore(KEY_STORE)
      },
    })
  }
  return keyDbPromise
}

const subtle = () => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available')
  }
  return crypto.subtle
}

const enc = new TextEncoder()
const dec = new TextDecoder()

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

/**
 * Derive a non-extractable AES-GCM key from `password + base64(key_salt)`.
 * Stored in IndexedDB so subsequent loads can encrypt/decrypt without a
 * re-derivation step.
 */
export async function deriveAndStoreKey(password: string, keySaltB64: string): Promise<CryptoKey> {
  const baseKey = await subtle().importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const aesKey = await subtle().deriveKey(
    {
      name: 'PBKDF2',
      salt: fromBase64(keySaltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    /* extractable */ false,
    ['encrypt', 'decrypt'],
  )
  const db = await getKeyDB()
  await db.put(KEY_STORE, aesKey, KEY_NAME)
  return aesKey
}

/** Read the previously-derived key, or null if the user hasn't unlocked yet. */
export async function loadKey(): Promise<CryptoKey | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await getKeyDB()
  return (await db.get(KEY_STORE, KEY_NAME)) ?? null
}

/** Wipe the derived key — call on logout. */
export async function clearKey(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await getKeyDB()
  await db.delete(KEY_STORE, KEY_NAME)
}

/**
 * Encrypt a UTF-8 string. Returns base64(IV || ciphertext+tag) — a single
 * opaque blob that goes straight into a `*_encrypted` column.
 *
 * IV is fresh per call (AES-GCM requires unique IVs for the same key);
 * 12 bytes is the spec-recommended size.
 */
export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  const ctBytes = new Uint8Array(ct)
  const out = new Uint8Array(iv.length + ctBytes.length)
  out.set(iv, 0)
  out.set(ctBytes, iv.length)
  return toBase64(out)
}

/** Decrypt a blob produced by `encryptString`. Throws if key is wrong / data tampered. */
export async function decryptString(key: CryptoKey, blob: string): Promise<string> {
  const all = fromBase64(blob)
  const iv = all.slice(0, 12)
  const ct = all.slice(12)
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct)
  return dec.decode(pt)
}

/** Encrypt an arbitrary JSON-serializable value. */
export async function encryptJson<T>(key: CryptoKey, value: T): Promise<string> {
  return encryptString(key, JSON.stringify(value))
}

/** Decrypt a blob into the matching shape. Returns null for null inputs. */
export async function decryptJson<T = unknown>(key: CryptoKey, blob: string | null | undefined): Promise<T | null> {
  if (!blob) return null
  return JSON.parse(await decryptString(key, blob)) as T
}

/** Decrypt a string-only field. Returns null for null inputs. */
export async function decryptText(key: CryptoKey, blob: string | null | undefined): Promise<string | null> {
  if (!blob) return null
  return decryptString(key, blob)
}
