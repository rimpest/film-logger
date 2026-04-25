# Film Logger

A lightweight, offline-friendly web app for logging film-camera shots in the moment.

## Stack

- **Nuxt 3** + Vue 3 (TypeScript)
- **Bun** as package manager / script runner
- **Nuxt UI 3** (Tailwind 4)
- **NuxtHub / Cloudflare D1** for data — accessed exclusively via server API routes
- **nuxt-auth-utils** for session cookies + scrypt password hashing
- **@vite-pwa/nuxt** for the installable PWA shell + offline cache
- **Vitest** for unit tests, `@nuxt/test-utils` for end-to-end integration tests

## Architecture rules

- The browser **never** talks to D1 directly. Every read/write goes through `/api/*` endpoints in `server/api/**`.
- All endpoints scope by `user_id` from the session — `client_id` and route params are validated, but never trusted as the user identifier.
- Mutations on rows that participate in offline sync are idempotent on `(user_id, client_id)`, so a replayed offline write doesn't duplicate.
- Soft deletes (`deleted_at`) are used everywhere a future sync could otherwise resurrect a tombstoned row.
- Roll status separates the physical roll (`loaded` / `finished` / `archived`) from development events (`developments` table). The UI label (e.g. "at lab", "developed") is derived in `shared/roll-status.ts` and used identically on server and client.

## Layout

```
server/
  api/                 # Every DB operation lives here
    auth/              # register, login, logout, me, change-password
    cameras/           # GET, POST, [id].{get,patch,delete}
    lenses/            # …with optional camera tagging via camera_lenses
    labs/
    rolls/             # plus [id]/index.get for full detail
    shots/
    developments/
  database/migrations/ # 0001_init.sql — applied automatically by NuxtHub on dev/deploy
  utils/               # db wrapper, schemas (zod), validation helpers, recovery code
shared/                # Pure code shared between server and client
  roll-status.ts       # deriveRollState(...)
composables/           # useApi, useGeolocation, useOfflineQueue
pages/                 # Mobile-first Vue pages
layouts/               # default (with bottom nav) + auth
middleware/            # auth.global.ts
types/                 # API response shapes
tests/
  unit/                # Vitest, plain Node — schemas, recovery codes, derived state, queue
  integration/         # @nuxt/test-utils — boots the app, exercises real /api endpoints
```

## Running

```bash
bun install
echo 'NUXT_SESSION_PASSWORD=please-change-this-to-32-or-more-chars' > .env
bun run dev
```

NuxtHub automatically creates a local SQLite-backed D1 binding and runs the migrations in `server/database/migrations/`.

## Testing

```bash
bun run test               # unit tests — fast, no Nuxt boot
bun run test:integration   # full happy-path against a real Nuxt server + local D1
```

The integration test exercises: register → me → camera CRUD → lens CRUD with camera tagging → roll create → idempotent shot logging → lab create → mark finished → development drop-off → derived status check → unauthenticated rejection → logout.

## Deploying

```bash
bun run build
bunx nuxthub deploy        # pushes to Cloudflare via NuxtHub
```

## What's intentionally not in MVP

- Image upload / scan attachment (planned for v2; schema is ready)
- Reverse geocoding (we store coords + free-text place; no third-party geocoder calls)
- XMP / Lightroom export
- Shared rolls / multi-user collaboration
- Email-based password reset (we issue a one-time recovery code at signup instead)

## Open questions intentionally deferred

See section 10 of the original spec. Current MVP defaults:

- Frame numbers: optional, manual.
- Lens-camera compatibility: soft hint via `camera_lenses` join — not enforced.
- Loaded film attaches to the camera body; back-tracking deferred.
- Push/pull captured at drop-off only.
- Lab cost & currency are exposed in the send-to-lab form.
- Self-development supported (`lab_id = null` in the form).
