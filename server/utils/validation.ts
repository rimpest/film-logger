import { z } from 'zod'
import type { H3Event } from 'h3'

/** Reads + validates the JSON body against the schema, throwing 400 on failure. */
export async function readValidatedJson<T extends z.ZodTypeAny>(
  event: H3Event,
  schema: T,
): Promise<z.infer<T>> {
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: { issues: result.error.issues },
    })
  }
  return result.data
}

/** Parses a numeric route param, throwing 400 if non-numeric or non-positive. */
export function paramId(event: H3Event, name: string): number {
  const raw = getRouterParam(event, name)
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${name}` })
  }
  return id
}
