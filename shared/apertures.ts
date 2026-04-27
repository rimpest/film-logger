/**
 * F-stop dictionary used by the shot logger.
 *
 * `common: true` stops appear by default — they're the values found on most
 * lenses and the ones a typical user is going to reach for. The rest stay
 * behind a "show more" toggle, except when a particular lens's max aperture
 * happens to land on one (e.g. a Noctilux f/0.95) — in that case we always
 * surface it so the user can pick their lens's widest opening with one tap.
 *
 * Source: standard photography f-stop scale (full + commonly-marked
 * third/half stops). Values like f/6.3 and f/7.1 exist on variable-aperture
 * zooms but are rarely chosen deliberately, so they're marked uncommon.
 */
export interface FStop {
  value: number
  /** Display label without the "f/" prefix. */
  label: string
  common: boolean
}

export const F_STOPS: ReadonlyArray<FStop> = [
  { value: 0.95, label: '0.95', common: false },
  { value: 1.0,  label: '1',    common: false },
  { value: 1.1,  label: '1.1',  common: false },
  { value: 1.2,  label: '1.2',  common: false },
  { value: 1.4,  label: '1.4',  common: true  },
  { value: 1.8,  label: '1.8',  common: true  },
  { value: 2,    label: '2',    common: true  },
  { value: 2.4,  label: '2.4',  common: false },
  { value: 2.8,  label: '2.8',  common: true  },
  { value: 3.5,  label: '3.5',  common: true  },
  { value: 4,    label: '4',    common: true  },
  { value: 4.5,  label: '4.5',  common: true  },
  { value: 5.6,  label: '5.6',  common: true  },
  { value: 6.3,  label: '6.3',  common: false },
  { value: 7.1,  label: '7.1',  common: false },
  { value: 8,    label: '8',    common: true  },
  { value: 11,   label: '11',   common: true  },
  { value: 16,   label: '16',   common: true  },
  { value: 22,   label: '22',   common: true  },
]

/**
 * Pick the f-stops worth showing for the selected lens.
 *
 * - `maxAperture` (lens's widest opening, the *lowest* f-number) clips the
 *   wide end — you can't open the lens wider than its physical max.
 * - `minAperture` (lens's narrowest opening, the *highest* f-number) clips
 *   the narrow end. Most lenses stop at f/22 so this is usually a no-op.
 * - `showUncommon = true` includes the third/half stops marked uncommon.
 *   Otherwise they're hidden, except the one that exactly matches the lens's
 *   max aperture (so a Noctilux user still gets their f/0.95 button).
 */
export function visibleFStops(opts: {
  maxAperture?: number | null
  minAperture?: number | null
  showUncommon?: boolean
} = {}): FStop[] {
  const max = opts.maxAperture ?? null
  const min = opts.minAperture ?? null
  return F_STOPS.filter((fs) => {
    if (max != null && fs.value < max) return false
    if (min != null && fs.value > min) return false
    if (fs.common) return true
    if (opts.showUncommon) return true
    if (max != null && fs.value === max) return true
    return false
  })
}
