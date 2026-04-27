import { describe, expect, it } from 'vitest'
import { defaultFrameCountFor, framePresetsFor } from '../../shared/frame-presets'

describe('framePresetsFor', () => {
  it('returns 36/24 for 35mm', () => {
    expect(framePresetsFor('135')).toEqual([36, 24])
  })

  it('returns 645/6×6/6×7/6×9 counts for 120', () => {
    expect(framePresetsFor('120')).toEqual([16, 12, 10, 8])
  })

  it('returns single-sheet counts for large format', () => {
    expect(framePresetsFor('4x5')).toEqual([1])
    expect(framePresetsFor('8x10')).toEqual([1])
  })

  it('returns the full list for `other` and unknown formats', () => {
    expect(framePresetsFor('other')).toEqual([36, 24, 16, 12, 10, 8, 1])
    expect(framePresetsFor(null)).toEqual([36, 24, 16, 12, 10, 8, 1])
    expect(framePresetsFor(undefined)).toEqual([36, 24, 16, 12, 10, 8, 1])
    expect(framePresetsFor('weird')).toEqual([36, 24, 16, 12, 10, 8, 1])
  })
})

describe('defaultFrameCountFor', () => {
  it('picks the first preset of each format', () => {
    expect(defaultFrameCountFor('135')).toBe(36)
    expect(defaultFrameCountFor('120')).toBe(16)
    expect(defaultFrameCountFor('4x5')).toBe(1)
    expect(defaultFrameCountFor('8x10')).toBe(1)
  })

  it('falls back to 36 for unknown / other formats', () => {
    expect(defaultFrameCountFor('other')).toBe(36)
    expect(defaultFrameCountFor(null)).toBe(36)
  })
})
