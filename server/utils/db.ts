import type { H3Event } from 'h3'

/**
 * D1 access wrapper. Always called from server routes — never the client.
 * `hubDatabase()` is provided by @nuxthub/core when bound to a D1 database.
 */
export function db() {
  return hubDatabase()
}

/**
 * Returns the authenticated user's id, or throws 401.
 * All DB queries scope by this id; never trust a client-supplied user_id.
 */
export async function requireUserId(event: H3Event): Promise<number> {
  const { user } = await requireUserSession(event)
  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  }
  return user.id as number
}

/** Current ISO timestamp (UTC) for `updated_at`/`created_at` columns. */
export function nowIso(): string {
  return new Date().toISOString()
}
