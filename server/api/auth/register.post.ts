import { loginSchema } from '~~/server/utils/schemas'
import { generateRecoveryCode } from '~~/server/utils/passwords'
import { generateKeySalt } from '~~/server/utils/keysalt'

export default defineEventHandler(async (event) => {
  const { username, password } = await readValidatedJson(event, loginSchema)

  const existing = await db()
    .prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first()
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Username already taken' })
  }

  const passwordHash = await hashPassword(password)
  const recoveryCode = generateRecoveryCode()
  const recoveryHash = await hashPassword(recoveryCode)
  // Per-user salt for client-side encryption key derivation.
  // Returned ONCE here; afterwards retrieved from /api/auth/me.
  const keySalt = generateKeySalt()

  const result = await db()
    .prepare(
      'INSERT INTO users (username, password_hash, recovery_code_hash, key_salt, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(username, passwordHash, recoveryHash, keySalt, nowIso())
    .run()

  const userId = Number(result.meta.last_row_id)
  await setUserSession(event, {
    user: { id: userId, username },
  })

  // Recovery code returned ONCE; client must show it to the user.
  // `key_salt` is needed for the client to derive its encryption key.
  return { id: userId, username, recovery_code: recoveryCode, key_salt: keySalt }
})
