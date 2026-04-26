/**
 * Unit tests for the client-side crypto helper. We test the actual primitive
 * — Web Crypto AES-GCM + PBKDF2 — by importing the same code paths the
 * browser runs. Node 22 ships a working Web Crypto, and `fake-indexeddb`
 * stands in for IDB so `deriveAndStoreKey` can persist its CryptoKey.
 *
 * Goals:
 *   • round-trip: encrypt(plain) → decrypt = plain
 *   • wrong key fails to decrypt (AES-GCM tag mismatch throws)
 *   • IV uniqueness: two encryptions of the same plaintext produce
 *     different ciphertexts (would catch a hard-coded IV)
 *   • derived key is non-extractable (the whole zero-knowledge promise
 *     leans on this — nothing in the JS environment can pull the raw bytes)
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearKey,
  decryptJson,
  decryptString,
  deriveAndStoreKey,
  encryptJson,
  encryptString,
  loadKey,
} from '../../app/composables/useCrypto'

const SALT_B64 = 'AAECAwQFBgcICQoLDA0ODw==' // 16 bytes 0..15, base64

describe('crypto', () => {
  beforeEach(async () => {
    await clearKey()
  })

  it('round-trips a string through encrypt/decrypt', async () => {
    const key = await deriveAndStoreKey('hunter2-correct-horse-battery', SALT_B64)
    const blob = await encryptString(key, 'Cerro de la Silla — first frame')
    expect(blob).toMatch(/^[A-Za-z0-9+/=]+$/)
    const back = await decryptString(key, blob)
    expect(back).toBe('Cerro de la Silla — first frame')
  })

  it('round-trips a JSON object', async () => {
    const key = await deriveAndStoreKey('hunter2-correct-horse-battery', SALT_B64)
    const loc = { text: 'Monterrey', latitude: 25.6866, longitude: -100.3161, accuracy_m: 8 }
    const blob = await encryptJson(key, loc)
    const back = await decryptJson<typeof loc>(key, blob)
    expect(back).toEqual(loc)
  })

  it('produces different ciphertexts for the same plaintext (IV uniqueness)', async () => {
    const key = await deriveAndStoreKey('hunter2-correct-horse-battery', SALT_B64)
    const a = await encryptString(key, 'same')
    const b = await encryptString(key, 'same')
    expect(a).not.toBe(b) // unique IV per call → distinct ciphertext
  })

  it('fails to decrypt with the wrong derived key', async () => {
    const goodKey = await deriveAndStoreKey('right-password', SALT_B64)
    const blob = await encryptString(goodKey, 'sensitive')

    // Re-derive with a different password: gives a different AES key.
    await clearKey()
    const wrongKey = await deriveAndStoreKey('wrong-password', SALT_B64)
    await expect(decryptString(wrongKey, blob)).rejects.toBeTruthy()
  })

  it('fails to decrypt if the salt changes (also a different derived key)', async () => {
    const k1 = await deriveAndStoreKey('hunter2-correct-horse-battery', SALT_B64)
    const blob = await encryptString(k1, 'sensitive')
    await clearKey()
    const otherSalt = 'EBAQEBAQEBAQEBAQEBAQEA==' // different 16 bytes
    const k2 = await deriveAndStoreKey('hunter2-correct-horse-battery', otherSalt)
    await expect(decryptString(k2, blob)).rejects.toBeTruthy()
  })

  it('persists the key in IDB so a fresh loadKey() finds it', async () => {
    await deriveAndStoreKey('hunter2-correct-horse-battery', SALT_B64)
    const k = await loadKey()
    expect(k).toBeTruthy()
    // The persisted key should still encrypt/decrypt.
    const blob = await encryptString(k!, 'still works')
    expect(await decryptString(k!, blob)).toBe('still works')
  })

  it('the stored key is non-extractable (raw bytes cannot be exported)', async () => {
    const k = await deriveAndStoreKey('hunter2-correct-horse-battery', SALT_B64)
    expect(k.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', k)).rejects.toBeTruthy()
  })

  it('clearKey wipes the key from IDB', async () => {
    await deriveAndStoreKey('hunter2-correct-horse-battery', SALT_B64)
    expect(await loadKey()).toBeTruthy()
    await clearKey()
    expect(await loadKey()).toBeNull()
  })
})
