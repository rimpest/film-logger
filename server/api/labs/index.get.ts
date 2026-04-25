export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { results } = await db()
    .prepare(
      `SELECT id, client_id, name, address, phone, website, notes, created_at, updated_at
       FROM labs
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY name ASC`,
    )
    .bind(userId)
    .all()
  return results
})
