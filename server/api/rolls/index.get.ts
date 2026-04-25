/**
 * Lists rolls. Joins to the latest non-deleted development row per roll
 * so the UI can render the derived state without a second round trip.
 *
 * Optional ?status= filter accepts either a raw `rolls.status` value
 * ('loaded' | 'finished' | 'archived') or 'active' (loaded + finished).
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const statusFilter = String(getQuery(event).status ?? '')

  let where = 'r.user_id = ? AND r.deleted_at IS NULL'
  const binds: unknown[] = [userId]
  if (statusFilter === 'loaded' || statusFilter === 'finished' || statusFilter === 'archived') {
    where += ' AND r.status = ?'
    binds.push(statusFilter)
  } else if (statusFilter === 'active') {
    where += " AND r.status IN ('loaded', 'finished')"
  }

  const { results } = await db()
    .prepare(
      `SELECT
         r.id, r.client_id, r.camera_id, r.film_stock, r.iso, r.box_speed, r.frame_count,
         r.status, r.loaded_at, r.finished_at, r.notes, r.created_at, r.updated_at,
         c.name AS camera_name,
         (
           SELECT COUNT(*) FROM shots s
           WHERE s.roll_id = r.id AND s.deleted_at IS NULL
         ) AS shot_count,
         (
           SELECT d.status FROM developments d
           WHERE d.roll_id = r.id AND d.deleted_at IS NULL
           ORDER BY datetime(COALESCE(d.dropped_off_at, d.created_at)) DESC, d.id DESC
           LIMIT 1
         ) AS latest_development_status
       FROM rolls r
       INNER JOIN cameras c ON c.id = r.camera_id
       WHERE ${where}
       ORDER BY datetime(r.loaded_at) DESC`,
    )
    .bind(...binds)
    .all()
  return results
})
