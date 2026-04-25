import { shotSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const input = await readValidatedJson(event, shotSchema)
  const now = nowIso()

  if (input.client_id) {
    const existing = await db()
      .prepare('SELECT id FROM shots WHERE user_id = ? AND client_id = ?')
      .bind(userId, input.client_id)
      .first<{ id: number }>()
    if (existing) {
      return { id: existing.id }
    }
  }

  // Confirm roll ownership; reject if archived (loaded/finished are both fine —
  // some users log a frame after capping the roll).
  const roll = await db()
    .prepare(
      `SELECT id, status FROM rolls
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    )
    .bind(input.roll_id, userId)
    .first<{ id: number, status: string }>()
  if (!roll) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown roll' })
  }
  if (roll.status === 'archived') {
    throw createError({ statusCode: 409, statusMessage: 'Roll is archived' })
  }

  if (input.lens_id) {
    const lens = await db()
      .prepare('SELECT id FROM lenses WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
      .bind(input.lens_id, userId)
      .first()
    if (!lens) {
      throw createError({ statusCode: 400, statusMessage: 'Unknown lens' })
    }
  }

  const result = await db()
    .prepare(
      `INSERT INTO shots
        (user_id, client_id, roll_id, frame_number, taken_at, lens_id, aperture, shutter_speed,
         location_text, latitude, longitude, location_accuracy_m, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      input.client_id ?? null,
      input.roll_id,
      input.frame_number ?? null,
      input.taken_at ?? now,
      input.lens_id ?? null,
      input.aperture ?? null,
      input.shutter_speed ?? null,
      input.location_text ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.location_accuracy_m ?? null,
      input.notes ?? null,
      now,
      now,
    )
    .run()

  return { id: Number(result.meta.last_row_id) }
})
