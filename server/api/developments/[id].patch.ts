import { developmentPatchSchema } from '~~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = paramId(event, 'id')
  const input = await readValidatedJson(event, developmentPatchSchema)

  const fields: string[] = []
  const values: unknown[] = []
  const set = (col: string, val: unknown) => { fields.push(`${col} = ?`); values.push(val) }

  if (input.lab_id !== undefined) set('lab_id', input.lab_id)
  if (input.dropped_off_at !== undefined) set('dropped_off_at', input.dropped_off_at)
  if (input.expected_ready_at !== undefined) set('expected_ready_at', input.expected_ready_at)
  if (input.delivered_at !== undefined) set('delivered_at', input.delivered_at)
  if (input.status !== undefined) {
    set('status', input.status)
    // When marking as delivered, default `delivered_at` if not provided.
    if (input.status === 'delivered' && input.delivered_at === undefined) {
      set('delivered_at', nowIso())
    }
  }
  if (input.process !== undefined) set('process', input.process)
  if (input.push_pull_stops !== undefined) set('push_pull_stops', input.push_pull_stops)
  if (input.scans_requested !== undefined) set('scans_requested', input.scans_requested ? 1 : 0)
  if (input.scan_resolution !== undefined) set('scan_resolution', input.scan_resolution)
  if (input.scan_format !== undefined) set('scan_format', input.scan_format)
  if (input.cost !== undefined) set('cost', input.cost)
  if (input.currency !== undefined) set('currency', input.currency)
  if (input.notes !== undefined) set('notes', input.notes)

  if (!fields.length) return { ok: true }
  fields.push('updated_at = ?')
  values.push(nowIso())
  values.push(id, userId)

  const result = await db()
    .prepare(`UPDATE developments SET ${fields.join(', ')} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`)
    .bind(...values)
    .run()
  if (!result.meta.changes) {
    throw createError({ statusCode: 404, statusMessage: 'Development not found' })
  }
  return { ok: true }
})
