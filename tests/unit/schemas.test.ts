import { describe, it, expect } from 'vitest'
import {
  cameraSchema,
  developmentSchema,
  labSchema,
  lensSchema,
  loginSchema,
  rollPatchSchema,
  rollSchema,
  shotSchema,
} from '../../server/utils/schemas'

describe('loginSchema', () => {
  it('accepts a clean username + 8+ char password', () => {
    expect(loginSchema.safeParse({ username: 'mateo_91', password: 'hunter2-stronger' }).success).toBe(true)
  })

  it('rejects spaces or unsupported characters in usernames', () => {
    expect(loginSchema.safeParse({ username: 'has space', password: 'hunter2-stronger' }).success).toBe(false)
    expect(loginSchema.safeParse({ username: 'm@teo', password: 'hunter2-stronger' }).success).toBe(false)
  })

  it('rejects passwords shorter than 8 characters', () => {
    expect(loginSchema.safeParse({ username: 'mateo', password: 'short' }).success).toBe(false)
  })
})

describe('cameraSchema', () => {
  it('requires a known format', () => {
    expect(cameraSchema.safeParse({ name: 'Hasselblad 500', format: '120' }).success).toBe(true)
    expect(cameraSchema.safeParse({ name: 'Hasselblad 500', format: 'IMAX' }).success).toBe(false)
  })

  it('defaults `has_interchangeable_back` to false when omitted', () => {
    const parsed = cameraSchema.parse({ name: 'Pentax K1000', format: '135' })
    expect(parsed.has_interchangeable_back).toBe(false)
  })

  it('rejects empty names', () => {
    expect(cameraSchema.safeParse({ name: '   ', format: '135' }).success).toBe(false)
  })
})

describe('lensSchema', () => {
  it('requires a positive integer focal length', () => {
    expect(lensSchema.safeParse({ name: 'Planar 80', focal_length_mm: 80 }).success).toBe(true)
    expect(lensSchema.safeParse({ name: 'Planar 80', focal_length_mm: 0 }).success).toBe(false)
    expect(lensSchema.safeParse({ name: 'Planar 80', focal_length_mm: 80.5 }).success).toBe(false)
  })

  it('accepts optional aperture range and camera_ids', () => {
    const ok = lensSchema.parse({
      name: 'Planar 80',
      focal_length_mm: 80,
      max_aperture: 2.8,
      min_aperture: 22,
      camera_ids: [1, 2, 3],
    })
    expect(ok.camera_ids).toEqual([1, 2, 3])
  })
})

describe('labSchema', () => {
  it('coerces empty website strings to null', () => {
    const parsed = labSchema.parse({ name: 'Boutique Lab', website: '' })
    expect(parsed.website).toBeNull()
  })

  it('rejects non-URL websites', () => {
    expect(labSchema.safeParse({ name: 'Boutique Lab', website: 'not a url' }).success).toBe(false)
  })
})

describe('rollSchema', () => {
  const base = {
    camera_id: 1,
    film_stock: 'Portra 400',
    iso: 400,
    frame_count: 36,
  }
  it('accepts a minimal valid roll', () => {
    expect(rollSchema.safeParse(base).success).toBe(true)
  })
  it('rejects non-positive frame counts and ISOs', () => {
    expect(rollSchema.safeParse({ ...base, frame_count: 0 }).success).toBe(false)
    expect(rollSchema.safeParse({ ...base, iso: -100 }).success).toBe(false)
  })
})

describe('rollPatchSchema', () => {
  it('only accepts the allowed status values', () => {
    expect(rollPatchSchema.safeParse({ status: 'finished' }).success).toBe(true)
    expect(rollPatchSchema.safeParse({ status: 'developed' }).success).toBe(false)
  })
})

describe('shotSchema', () => {
  const base = { roll_id: 1 }
  it('accepts a barebones shot (everything but roll_id is optional)', () => {
    expect(shotSchema.safeParse(base).success).toBe(true)
  })
  it('rejects unknown plaintext fields (we never accept them anymore)', () => {
    // These keys used to be valid; making sure they are now silently dropped
    // (zod default = strip) and don't survive into the parsed object.
    const parsed = shotSchema.safeParse({ ...base, latitude: 91, notes: 'plain' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect((parsed.data as any).latitude).toBeUndefined()
      expect((parsed.data as any).notes).toBeUndefined()
    }
  })
  it('accepts opaque ciphertext blobs for notes/location', () => {
    expect(shotSchema.safeParse({
      ...base,
      notes_encrypted: 'AAECAwQFBgcICQoLDA0ODxA=',
      location_encrypted: 'AAECAwQFBgcICQoLDA0ODxE=',
    }).success).toBe(true)
  })
  it('rejects ciphertext blobs over the size limit', () => {
    expect(shotSchema.safeParse({
      ...base,
      notes_encrypted: 'a'.repeat(20_000),
    }).success).toBe(false)
  })
  it('rejects malformed taken_at', () => {
    expect(shotSchema.safeParse({ ...base, taken_at: 'yesterday' }).success).toBe(false)
  })
})

describe('developmentSchema', () => {
  it('treats lab_id as optional (self-developed = null)', () => {
    const ok = developmentSchema.safeParse({ roll_id: 1, status: 'dropped_off' })
    expect(ok.success).toBe(true)
  })

  it('clamps push/pull to a reasonable range', () => {
    expect(developmentSchema.safeParse({ roll_id: 1, status: 'dropped_off', push_pull_stops: 10 }).success).toBe(false)
    expect(developmentSchema.safeParse({ roll_id: 1, status: 'dropped_off', push_pull_stops: -2 }).success).toBe(true)
  })

  it('rejects an unknown status value', () => {
    expect(developmentSchema.safeParse({ roll_id: 1, status: 'lost' }).success).toBe(false)
  })
})
