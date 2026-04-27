export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')

  const camera = await db()
    .prepare(
      `SELECT id, client_id, name, format, has_interchangeable_back, notes_encrypted,
              created_at, updated_at
       FROM cameras
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    )
    .bind(id, userId)
    .first()
  if (!camera) {
    throw createError({ statusCode: 404, statusMessage: 'Camera not found' })
  }
  return camera
})
