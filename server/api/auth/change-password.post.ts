import { z } from 'zod'

const schema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(200),
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { current_password, new_password } = await readValidatedJson(event, schema)

  const row = await db()
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(userId)
    .first<{ password_hash: string }>()

  if (!row || !(await verifyPassword(row.password_hash, current_password))) {
    throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' })
  }

  const newHash = await hashPassword(new_password)
  await db()
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(newHash, userId)
    .run()

  return { ok: true }
})
