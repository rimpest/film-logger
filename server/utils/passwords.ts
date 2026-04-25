/**
 * Password hashing is provided by nuxt-auth-utils as auto-imported `hashPassword` /
 * `verifyPassword` server utils (scrypt-based, Workers-compatible). This file only
 * carries the recovery-code generator — kept here so the register endpoint can
 * mint and persist a one-time code without depending on the auth library's internals.
 */

/**
 * One-time recovery code shown to the user at signup.
 * Stored as a hash via the platform's hashPassword util — never raw.
 * Format: 5-char groups of base32-ish characters, e.g. ABCDE-FGHJK-MNPQR.
 */
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(15)
  crypto.getRandomValues(bytes)
  // Crockford base32-ish: omit characters that are easily confused (0, O, 1, I, L).
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    if (i > 0 && i % 5 === 0) out += '-'
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}
