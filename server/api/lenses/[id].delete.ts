export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')

  const result = await db()
    .prepare(`UPDATE lenses SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
    .bind(nowIso(), nowIso(), id, userId)
    .run()

  if (!result.meta.changes) {
    throw createError({ statusCode: 404, statusMessage: 'Lens not found' })
  }
  // Drop links — shots that reference this lens keep the FK pointing at the soft-deleted row,
  // which is fine because they only display the lens name.
  await db().prepare('DELETE FROM camera_lenses WHERE lens_id = ?').bind(id).run()
  return { ok: true }
})
