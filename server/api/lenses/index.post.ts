import { lensSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const input = await readValidatedJson(event, lensSchema)
  const now = nowIso()

  if (input.client_id) {
    const existing = await db()
      .prepare('SELECT id FROM lenses WHERE user_id = ? AND client_id = ?')
      .bind(userId, input.client_id)
      .first<{ id: number }>()
    if (existing) {
      return { id: existing.id }
    }
  }

  const result = await db()
    .prepare(
      `INSERT INTO lenses
        (user_id, client_id, name, focal_length_mm, max_aperture, min_aperture, mount, notes,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      input.client_id ?? null,
      input.name,
      input.focal_length_mm,
      input.max_aperture ?? null,
      input.min_aperture ?? null,
      input.mount ?? null,
      input.notes ?? null,
      now,
      now,
    )
    .run()

  const lensId = Number(result.meta.last_row_id)

  if (input.camera_ids?.length) {
    await attachLensToCameras(userId, lensId, input.camera_ids)
  }

  return { id: lensId }
})

async function attachLensToCameras(userId: number, lensId: number, cameraIds: number[]) {
  // Validate all camera ids belong to this user before inserting links.
  const placeholders = cameraIds.map(() => '?').join(',')
  const { results } = await db()
    .prepare(`SELECT id FROM cameras WHERE user_id = ? AND id IN (${placeholders}) AND deleted_at IS NULL`)
    .bind(userId, ...cameraIds)
    .all<{ id: number }>()
  const valid = new Set(results.map(r => r.id))

  const stmts = [...valid].map(cid =>
    db().prepare('INSERT OR IGNORE INTO camera_lenses (camera_id, lens_id) VALUES (?, ?)').bind(cid, lensId),
  )
  if (stmts.length) {
    await db().batch(stmts)
  }
}
