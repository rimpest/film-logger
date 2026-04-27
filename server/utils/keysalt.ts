/**
 * Per-user key derivation salt for client-side encryption (PBKDF2 → AES-GCM).
 *
 * The server stores this salt in `users.key_salt` and returns it on
 * register/login/me so the client can deterministically re-derive the
 * encryption key from `password + salt`. Re-rolling a salt would invalidate
 * every existing ciphertext, so we mint exactly one per account, at
 * registration time.
 */

/** 16 random bytes, base64-encoded — sufficient salt for PBKDF2-SHA256. */
export function generateKeySalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return base64Encode(bytes)
}

function base64Encode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  // `btoa` is available in Workers + Node 18+.
  return btoa(binary)
}
