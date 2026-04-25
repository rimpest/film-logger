import { labSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')
  const input = await readValidatedJson(event, labSchema.partial())

  const fields: string[] = []
  const values: unknown[] = []
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name) }
  if (input.address !== undefined) { fields.push('address = ?'); values.push(input.address) }
  if (input.phone !== undefined) { fields.push('phone = ?'); values.push(input.phone) }
  if (input.website !== undefined) { fields.push('website = ?'); values.push(input.website) }
  if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes) }

  if (!fields.length) return { ok: true }
  fields.push('updated_at = ?')
  values.push(nowIso())
  values.push(id, userId)

  const result = await db()
    .prepare(`UPDATE labs SET ${fields.join(', ')} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`)
    .bind(...values)
    .run()
  if (!result.meta.changes) {
    throw createError({ statusCode: 404, statusMessage: 'Lab not found' })
  }
  return { ok: true }
})
