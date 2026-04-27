/**
 * Frame-count presets per camera format.
 *
 * The first entry in each list is also the default frame count auto-selected
 * when the user picks a camera of that format on the "load a roll" page.
 *
 * Numbers come from the standard exposure counts a single roll/sheet of that
 * format yields:
 *   - 135 (35mm): full 36-exp roll, 24-exp short roll
 *   - 120: depends on the back/format mask:
 *       16 → 645 (6×4.5)   12 → 6×6   10 → 6×7   8 → 6×9
 *   - 4×5 / 8×10: one sheet at a time
 */
export type CameraFormat = '135' | '120' | '4x5' | '8x10' | 'other'

export const PRESETS_BY_FORMAT: Record<Exclude<CameraFormat, 'other'>, number[]> = {
  '135': [36, 24],
  '120': [16, 12, 10, 8],
  '4x5': [1],
  '8x10': [1],
}

export const ALL_FRAME_VALUES = [36, 24, 16, 12, 10, 8, 1] as const

/**
 * Frame counts to surface as quick-select chips for a given camera format.
 * `'other'` (or unknown) returns the full list so the user has choices.
 */
export function framePresetsFor(format: CameraFormat | string | null | undefined): number[] {
  if (format && format !== 'other' && format in PRESETS_BY_FORMAT) {
    return PRESETS_BY_FORMAT[format as Exclude<CameraFormat, 'other'>]
  }
  return [...ALL_FRAME_VALUES]
}

/** Sensible default frame count for a freshly-picked camera. */
export function defaultFrameCountFor(format: CameraFormat | string | null | undefined): number {
  return framePresetsFor(format)[0] ?? 36
}
