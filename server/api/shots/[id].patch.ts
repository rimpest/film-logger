import { shotSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')
  const input = await readValidatedJson(event, shotSchema.partial().omit({ roll_id: true }))

  const fields: string[] = []
  const values: unknown[] = []
  const set = (col: string, val: unknown) => { fields.push(`${col} = ?`); values.push(val) }

  if (input.frame_number !== undefined) set('frame_number', input.frame_number)
  if (input.taken_at !== undefined) set('taken_at', input.taken_at)
  if (input.lens_id !== undefined) set('lens_id', input.lens_id)
  if (input.aperture !== undefined) set('aperture', input.aperture)
  if (input.shutter_speed !== undefined) set('shutter_speed', input.shutter_speed)
  if (input.location_encrypted !== undefined) set('location_encrypted', input.location_encrypted)
  if (input.notes_encrypted !== undefined) set('notes_encrypted', input.notes_encrypted)

  if (!fields.length) return { ok: true }
  fields.push('updated_at = ?')
  values.push(nowIso())
  values.push(id, userId)

  const result = await db()
    .prepare(`UPDATE shots SET ${fields.join(', ')} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`)
    .bind(...values)
    .run()
  if (!result.meta.changes) {
    throw createError({ statusCode: 404, statusMessage: 'Shot not found' })
  }
  return { ok: true }
})
