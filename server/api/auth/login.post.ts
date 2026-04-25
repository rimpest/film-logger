import { loginSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const { username, password } = await readValidatedJson(event, loginSchema)

  const row = await db()
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: number, username: string, password_hash: string }>()

  // Always run a verify against *something* so timing stays roughly constant
  // when the account doesn't exist. Hash format is whatever nuxt-auth-utils emits.
  const ok = row
    ? await verifyPassword(row.password_hash, password)
    : await verifyPassword('$scrypt$1:1:1$ZmFrZQ==$ZmFrZQ==', password).catch(() => false)

  if (!row || !ok) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  await setUserSession(event, {
    user: { id: row.id, username: row.username },
  })

  return { id: row.id, username: row.username }
})
