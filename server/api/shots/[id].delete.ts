export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')
  const result = await db()
    .prepare(`UPDATE shots SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
    .bind(nowIso(), nowIso(), id, userId)
    .run()
  if (!result.meta.changes) {
    throw createError({ statusCode: 404, statusMessage: 'Shot not found' })
  }
  return { ok: true }
})
