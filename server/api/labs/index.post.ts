import { labSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const input = await readValidatedJson(event, labSchema)
  const now = nowIso()

  if (input.client_id) {
    const existing = await db()
      .prepare('SELECT id FROM labs WHERE user_id = ? AND client_id = ?')
      .bind(userId, input.client_id)
      .first<{ id: number }>()
    if (existing) {
      return { id: existing.id }
    }
  }

  const result = await db()
    .prepare(
      `INSERT INTO labs (user_id, client_id, name, address, phone, website, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      input.client_id ?? null,
      input.name,
      input.address ?? null,
      input.phone ?? null,
      input.website ?? null,
      input.notes ?? null,
      now,
      now,
    )
    .run()

  return { id: Number(result.meta.last_row_id) }
})
