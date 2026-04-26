export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user?.id) return { user: null, key_salt: null }

  // Salt is needed by the client to re-derive the encryption key on a fresh
  // session (e.g. after a tab restart). Doesn't reveal anything by itself —
  // it's only useful to someone who also knows the user's password.
  const row = await db()
    .prepare('SELECT key_salt FROM users WHERE id = ?')
    .bind(session.user.id)
    .first<{ key_salt: string | null }>()

  return { user: session.user, key_salt: row?.key_salt ?? null }
})
