export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')

  // Block delete if any non-deleted rolls reference the camera.
  const inUse = await db()
    .prepare(
      `SELECT 1 AS x FROM rolls WHERE camera_id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1`,
    )
    .bind(id, userId)
    .first()
  if (inUse) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Camera has rolls attached. Archive those rolls first.',
    })
  }

  const result = await db()
    .prepare(`UPDATE cameras SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
    .bind(nowIso(), nowIso(), id, userId)
    .run()

  if (!result.meta.changes) {
    throw createError({ statusCode: 404, statusMessage: 'Camera not found' })
  }
  return { ok: true }
})
