export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const cameraId = Number(getQuery(event).camera_id) || null

  // When `?camera_id=` is supplied, only return lenses tagged for that camera.
  if (cameraId) {
    const { results } = await db()
      .prepare(
        `SELECT l.id, l.client_id, l.name, l.focal_length_mm, l.max_aperture, l.min_aperture,
                l.mount, l.notes, l.created_at, l.updated_at
         FROM lenses l
         INNER JOIN camera_lenses cl ON cl.lens_id = l.id
         WHERE l.user_id = ? AND l.deleted_at IS NULL AND cl.camera_id = ?
         ORDER BY l.focal_length_mm ASC, l.name ASC`,
      )
      .bind(userId, cameraId)
      .all()
    return results
  }

  const { results } = await db()
    .prepare(
      `SELECT id, client_id, name, focal_length_mm, max_aperture, min_aperture, mount, notes,
              created_at, updated_at
       FROM lenses
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY focal_length_mm ASC, name ASC`,
    )
    .bind(userId)
    .all()
  return results
})
