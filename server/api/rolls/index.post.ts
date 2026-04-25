import { rollSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const input = await readValidatedJson(event, rollSchema)
  const now = nowIso()

  if (input.client_id) {
    const existing = await db()
      .prepare('SELECT id FROM rolls WHERE user_id = ? AND client_id = ?')
      .bind(userId, input.client_id)
      .first<{ id: number }>()
    if (existing) {
      return { id: existing.id }
    }
  }

  // Confirm camera ownership before linking.
  const camera = await db()
    .prepare('SELECT id FROM cameras WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(input.camera_id, userId)
    .first()
  if (!camera) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown camera' })
  }

  const result = await db()
    .prepare(
      `INSERT INTO rolls
        (user_id, client_id, camera_id, film_stock, iso, box_speed, frame_count, status,
         loaded_at, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'loaded', ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      input.client_id ?? null,
      input.camera_id,
      input.film_stock,
      input.iso,
      input.box_speed ?? null,
      input.frame_count,
      now,
      input.notes ?? null,
      now,
      now,
    )
    .run()

  return { id: Number(result.meta.last_row_id) }
})
