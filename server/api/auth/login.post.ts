import { loginSchema } from '~~/server/utils/schemas'
import { assertLoginAllowed, clearLoginAttempts, recordFailedLogin } from '~~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  const { username, password } = await readValidatedJson(event, loginSchema)

  // Hard cap on per-username attempts per hour. Returns 429 if exceeded.
  await assertLoginAllowed(username)

  const row = await db()
    .prepare('SELECT id, username, password_hash, key_salt FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: number, username: string, password_hash: string, key_salt: string | null }>()

  // Always run a verify against *something* so timing stays roughly constant
  // when the account doesn't exist. Hash format is whatever nuxt-auth-utils emits.
  const ok = row
    ? await verifyPassword(row.password_hash, password)
    : await verifyPassword('$scrypt$1:1:1$ZmFrZQ==$ZmFrZQ==', password).catch(() => false)

  if (!row || !ok) {
    await recordFailedLogin(username)
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  await setUserSession(event, {
    user: { id: row.id, username: row.username },
  })
  await clearLoginAttempts(username)

  return { id: row.id, username: row.username, key_salt: row.key_salt }
})
