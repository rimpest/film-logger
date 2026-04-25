import { loginSchema } from '~~/server/utils/schemas'
import { generateRecoveryCode } from '~~/server/utils/passwords'

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

  const result = await db()
    .prepare(
      'INSERT INTO users (username, password_hash, recovery_code_hash, created_at) VALUES (?, ?, ?, ?)',
    )
    .bind(username, passwordHash, recoveryHash, nowIso())
    .run()

  const userId = Number(result.meta.last_row_id)
  await setUserSession(event, {
    user: { id: userId, username },
  })

  // Recovery code returned ONCE; client must show it to the user and instruct them to save it.
  return { id: userId, username, recovery_code: recoveryCode }
})
