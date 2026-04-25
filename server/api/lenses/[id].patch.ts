import { lensSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')
  const input = await readValidatedJson(event, lensSchema.partial())

  const fields: string[] = []
  const values: unknown[] = []
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name) }
  if (input.focal_length_mm !== undefined) { fields.push('focal_length_mm = ?'); values.push(input.focal_length_mm) }
  if (input.max_aperture !== undefined) { fields.push('max_aperture = ?'); values.push(input.max_aperture) }
  if (input.min_aperture !== undefined) { fields.push('min_aperture = ?'); values.push(input.min_aperture) }
  if (input.mount !== undefined) { fields.push('mount = ?'); values.push(input.mount) }
  if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes) }

  if (fields.length) {
    fields.push('updated_at = ?')
    values.push(nowIso())
    values.push(id, userId)
    const result = await db()
      .prepare(`UPDATE lenses SET ${fields.join(', ')} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`)
      .bind(...values)
      .run()
    if (!result.meta.changes) {
      throw createError({ statusCode: 404, statusMessage: 'Lens not found' })
    }
  }

  if (input.camera_ids !== undefined) {
    await db().prepare('DELETE FROM camera_lenses WHERE lens_id = ?').bind(id).run()
    if (input.camera_ids.length) {
      const placeholders = input.camera_ids.map(() => '?').join(',')
      const { results } = await db()
        .prepare(`SELECT id FROM cameras WHERE user_id = ? AND id IN (${placeholders}) AND deleted_at IS NULL`)
        .bind(userId, ...input.camera_ids)
        .all<{ id: number }>()
      const stmts = results.map(r =>
        db()
          .prepare('INSERT OR IGNORE INTO camera_lenses (camera_id, lens_id) VALUES (?, ?)')
          .bind(r.id, id),
      )
      if (stmts.length) await db().batch(stmts)
    }
  }

  return { ok: true }
})
