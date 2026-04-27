/**
 * Per-username login rate limiter, backed by the `login_attempts` table.
 *
 * Algorithm: bucket attempts by username + UTC hour. If a username exceeds
 * `MAX_PER_HOUR` failed attempts in the current bucket, block further tries
 * until the next hour rolls over. Successful logins are not counted (we clear
 * any existing bucket on success so a legitimate user isn't penalised for a
 * few mistypes followed by a correct login).
 *
 * This is intentionally simple: the buckets are coarse, the counter is
 * username-based (not IP), and we accept that an attacker with many usernames
 * gets multiple buckets. Good enough for the personal-app threat model;
 * pre-launch we'd add IP-based limits via a Worker binding.
 */
const MAX_PER_HOUR = 10

function currentBucket(): string {
  // ISO 8601 truncated to the hour — UTC.
  const d = new Date()
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}`
}
function pad(n: number) { return String(n).padStart(2, '0') }

export async function assertLoginAllowed(username: string): Promise<void> {
  const bucket = currentBucket()
  const row = await db()
    .prepare('SELECT count FROM login_attempts WHERE username = ? AND bucket = ?')
    .bind(username, bucket)
    .first<{ count: number }>()

  if (row && row.count >= MAX_PER_HOUR) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many attempts. Try again later.',
    })
  }
}

export async function recordFailedLogin(username: string): Promise<void> {
  const bucket = currentBucket()
  // INSERT OR IGNORE then UPDATE keeps the operation atomic per (username, bucket).
  await db()
    .prepare(
      'INSERT INTO login_attempts (username, bucket, count) VALUES (?, ?, 1) ' +
      'ON CONFLICT (username, bucket) DO UPDATE SET count = count + 1',
    )
    .bind(username, bucket)
    .run()
}

/** Drop *any* attempt counters for this user — called after a successful login. */
export async function clearLoginAttempts(username: string): Promise<void> {
  await db().prepare('DELETE FROM login_attempts WHERE username = ?').bind(username).run()
}
