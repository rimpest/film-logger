import { cameraSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')
  const input = await readValidatedJson(event, cameraSchema.partial())

  const fields: string[] = []
  const values: unknown[] = []
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name) }
  if (input.format !== undefined) { fields.push('format = ?'); values.push(input.format) }
  if (input.has_interchangeable_back !== undefined) {
    fields.push('has_interchangeable_back = ?')
    values.push(input.has_interchangeable_back ? 1 : 0)
  }
  if (input.notes_encrypted !== undefined) { fields.push('notes_encrypted = ?'); values.push(input.notes_encrypted) }

  if (fields.length === 0) {
    return { ok: true }
  }

  fields.push('updated_at = ?')
  values.push(nowIso())
  values.push(id, userId)

  const result = await db()
    .prepare(`UPDATE cameras SET ${fields.join(', ')} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`)
    .bind(...values)
    .run()

  if (!result.meta.changes) {
    throw createError({ statusCode: 404, statusMessage: 'Camera not found' })
  }
  return { ok: true }
})
