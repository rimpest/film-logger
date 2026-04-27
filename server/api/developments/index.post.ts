import { developmentSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const input = await readValidatedJson(event, developmentSchema)
  const now = nowIso()

  if (input.client_id) {
    const existing = await db()
      .prepare('SELECT id FROM developments WHERE user_id = ? AND client_id = ?')
      .bind(userId, input.client_id)
      .first<{ id: number }>()
    if (existing) {
      return { id: existing.id }
    }
  }

  const roll = await db()
    .prepare('SELECT id FROM rolls WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(input.roll_id, userId)
    .first()
  if (!roll) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown roll' })
  }

  if (input.lab_id != null) {
    const lab = await db()
      .prepare('SELECT id FROM labs WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
      .bind(input.lab_id, userId)
      .first()
    if (!lab) {
      throw createError({ statusCode: 400, statusMessage: 'Unknown lab' })
    }
  }

  const result = await db()
    .prepare(
      `INSERT INTO developments
        (user_id, client_id, roll_id, lab_id, dropped_off_at, expected_ready_at, delivered_at,
         status, process, push_pull_stops, scans_requested, scan_resolution, scan_format, cost,
         currency, notes_encrypted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      input.client_id ?? null,
      input.roll_id,
      input.lab_id ?? null,
      input.dropped_off_at ?? null,
      input.expected_ready_at ?? null,
      input.delivered_at ?? null,
      input.status,
      input.process ?? null,
      input.push_pull_stops ?? 0,
      input.scans_requested ? 1 : 0,
      input.scan_resolution ?? null,
      input.scan_format ?? null,
      input.cost ?? null,
      input.currency ?? null,
      input.notes_encrypted ?? null,
      now,
      now,
    )
    .run()

  // Auto-bump roll status to 'finished' when a development record is created on a still-loaded roll.
  await db()
    .prepare(
      `UPDATE rolls SET status = 'finished', finished_at = COALESCE(finished_at, ?), updated_at = ?
       WHERE id = ? AND user_id = ? AND status = 'loaded'`,
    )
    .bind(now, now, input.roll_id, userId)
    .run()

  return { id: Number(result.meta.last_row_id) }
})
