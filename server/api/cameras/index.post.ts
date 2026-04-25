import { cameraSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const input = await readValidatedJson(event, cameraSchema)
  const now = nowIso()

  // Idempotent on client_id (offline queue may replay).
  if (input.client_id) {
    const existing = await db()
      .prepare('SELECT id FROM cameras WHERE user_id = ? AND client_id = ?')
      .bind(userId, input.client_id)
      .first<{ id: number }>()
    if (existing) {
      return { id: existing.id }
    }
  }

  const result = await db()
    .prepare(
      `INSERT INTO cameras
        (user_id, client_id, name, format, has_interchangeable_back, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      input.client_id ?? null,
      input.name,
      input.format,
      input.has_interchangeable_back ? 1 : 0,
      input.notes ?? null,
      now,
      now,
    )
    .run()

  return { id: Number(result.meta.last_row_id) }
})
