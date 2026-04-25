export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')

  const lens = await db()
    .prepare(
      `SELECT id, client_id, name, focal_length_mm, max_aperture, min_aperture, mount, notes,
              created_at, updated_at
       FROM lenses
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    )
    .bind(id, userId)
    .first()
  if (!lens) {
    throw createError({ statusCode: 404, statusMessage: 'Lens not found' })
  }

  const { results: cameraLinks } = await db()
    .prepare('SELECT camera_id FROM camera_lenses WHERE lens_id = ?')
    .bind(id)
    .all<{ camera_id: number }>()

  return { ...lens, camera_ids: cameraLinks.map(r => r.camera_id) }
})
