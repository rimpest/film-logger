import { rollPatchSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')
  const input = await readValidatedJson(event, rollPatchSchema)

  const fields: string[] = []
  const values: unknown[] = []
  if (input.status !== undefined) {
    fields.push('status = ?'); values.push(input.status)
    // When transitioning to 'finished', stamp finished_at if the client didn't provide one.
    if (input.status === 'finished' && input.finished_at === undefined) {
      fields.push('finished_at = ?'); values.push(nowIso())
    }
  }
  if (input.finished_at !== undefined) {
    fields.push('finished_at = ?'); values.push(input.finished_at)
  }
  if (input.notes !== undefined) {
    fields.push('notes = ?'); values.push(input.notes)
  }
  if (!fields.length) return { ok: true }

  fields.push('updated_at = ?')
  values.push(nowIso())
  values.push(id, userId)

  const result = await db()
    .prepare(`UPDATE rolls SET ${fields.join(', ')} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`)
    .bind(...values)
    .run()

  if (!result.meta.changes) {
    throw createError({ statusCode: 404, statusMessage: 'Roll not found' })
  }
  return { ok: true }
})
