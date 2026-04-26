export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { results } = await db()
    .prepare(
      `SELECT id, client_id, name, format, has_interchangeable_back, notes_encrypted,
              created_at, updated_at
       FROM cameras
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY name ASC`,
    )
    .bind(userId)
    .all()
  return results
})
