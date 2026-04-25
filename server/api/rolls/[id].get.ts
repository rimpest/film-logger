export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')

  const roll = await db()
    .prepare(
      `SELECT r.id, r.client_id, r.camera_id, r.film_stock, r.iso, r.box_speed, r.frame_count,
              r.status, r.loaded_at, r.finished_at, r.notes, r.created_at, r.updated_at,
              c.name AS camera_name, c.format AS camera_format
       FROM rolls r
       INNER JOIN cameras c ON c.id = r.camera_id
       WHERE r.id = ? AND r.user_id = ? AND r.deleted_at IS NULL`,
    )
    .bind(id, userId)
    .first()
  if (!roll) {
    throw createError({ statusCode: 404, statusMessage: 'Roll not found' })
  }

  const { results: shots } = await db()
    .prepare(
      `SELECT s.id, s.client_id, s.frame_number, s.taken_at, s.lens_id, s.aperture,
              s.shutter_speed, s.location_text, s.latitude, s.longitude, s.location_accuracy_m,
              s.notes, l.name AS lens_name
       FROM shots s
       LEFT JOIN lenses l ON l.id = s.lens_id
       WHERE s.roll_id = ? AND s.user_id = ? AND s.deleted_at IS NULL
       ORDER BY datetime(s.taken_at) ASC, s.id ASC`,
    )
    .bind(id, userId)
    .all()

  const { results: developments } = await db()
    .prepare(
      `SELECT d.id, d.lab_id, lb.name AS lab_name, d.status, d.dropped_off_at,
              d.expected_ready_at, d.delivered_at, d.process, d.push_pull_stops,
              d.scans_requested, d.scan_resolution, d.scan_format, d.cost, d.currency,
              d.notes, d.created_at, d.updated_at
       FROM developments d
       LEFT JOIN labs lb ON lb.id = d.lab_id
       WHERE d.roll_id = ? AND d.user_id = ? AND d.deleted_at IS NULL
       ORDER BY datetime(COALESCE(d.dropped_off_at, d.created_at)) DESC, d.id DESC`,
    )
    .bind(id, userId)
    .all()

  return { roll, shots, developments }
})
