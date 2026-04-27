import { z } from 'zod'

/** Optional client-generated UUID for offline-created rows. */
const clientId = z.string().uuid().optional().nullable()

const trimmedString = (max = 200) =>
  z.string().trim().min(1).max(max)

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(8).max(200),
})

/**
 * `notes_encrypted` and `location_encrypted` are opaque ciphertext blobs
 * (base64 of IV+ciphertext from AES-GCM). The server never decrypts them; we
 * just cap the size so the client can't push pathologically large payloads
 * through. 16 KiB of base64 is plenty for free-form notes.
 */
const ciphertext = z.string().max(16384).optional().nullable()

export const cameraSchema = z.object({
  client_id: clientId,
  name: trimmedString(120),
  format: z.enum(['135', '120', '4x5', '8x10', 'other']),
  has_interchangeable_back: z.boolean().optional().default(false),
  notes_encrypted: ciphertext,
})
export type CameraInput = z.infer<typeof cameraSchema>

export const lensSchema = z.object({
  client_id: clientId,
  name: trimmedString(120),
  focal_length_mm: z.number().int().positive().max(2000),
  max_aperture: z.number().positive().max(64).optional().nullable(),
  min_aperture: z.number().positive().max(128).optional().nullable(),
  mount: z.string().max(60).optional().nullable(),
  notes_encrypted: ciphertext,
  camera_ids: z.array(z.number().int().positive()).optional(),
})
export type LensInput = z.infer<typeof lensSchema>

export const labSchema = z.object({
  client_id: clientId,
  name: trimmedString(120),
  address: z.string().max(300).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  website: z.string().url().max(300).optional().nullable().or(z.literal('').transform(() => null)),
  notes_encrypted: ciphertext,
})
export type LabInput = z.infer<typeof labSchema>

export const rollSchema = z.object({
  client_id: clientId,
  camera_id: z.number().int().positive(),
  film_stock: trimmedString(120),
  iso: z.number().int().positive().max(409600),
  box_speed: z.number().int().positive().max(409600).optional().nullable(),
  frame_count: z.number().int().positive().max(1000),
  notes_encrypted: ciphertext,
})
export type RollInput = z.infer<typeof rollSchema>

export const rollPatchSchema = z.object({
  status: z.enum(['loaded', 'finished', 'archived']).optional(),
  finished_at: z.string().datetime().optional().nullable(),
  notes_encrypted: ciphertext,
})

export const shotSchema = z.object({
  client_id: clientId,
  roll_id: z.number().int().positive(),
  frame_number: z.number().int().positive().max(1000).optional().nullable(),
  taken_at: z.string().datetime().optional(),
  lens_id: z.number().int().positive().optional().nullable(),
  aperture: z.number().positive().max(128).optional().nullable(),
  shutter_speed: z.string().max(20).optional().nullable(),
  // location_encrypted is the ciphertext of {lat, lng, accuracy_m, text}.
  // The server never decrypts it.
  location_encrypted: ciphertext,
  notes_encrypted: ciphertext,
})
export type ShotInput = z.infer<typeof shotSchema>

export const developmentSchema = z.object({
  client_id: clientId,
  roll_id: z.number().int().positive(),
  lab_id: z.number().int().positive().optional().nullable(),
  dropped_off_at: z.string().datetime().optional().nullable(),
  expected_ready_at: z.string().datetime().optional().nullable(),
  delivered_at: z.string().datetime().optional().nullable(),
  status: z.enum(['dropped_off', 'in_progress', 'delivered', 'cancelled']),
  process: z.string().max(40).optional().nullable(),
  push_pull_stops: z.number().int().min(-4).max(4).optional().default(0),
  scans_requested: z.boolean().optional().default(false),
  scan_resolution: z.string().max(40).optional().nullable(),
  scan_format: z.string().max(40).optional().nullable(),
  cost: z.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  notes_encrypted: ciphertext,
})
export type DevelopmentInput = z.infer<typeof developmentSchema>

export const developmentPatchSchema = developmentSchema.partial().extend({
  client_id: clientId,
})
