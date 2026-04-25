import { describe, it, expect } from 'vitest'
import {
  deriveRollState,
  DERIVED_STATE_LABELS,
  DERIVED_STATE_COLORS,
} from '../../shared/roll-status'

describe('deriveRollState', () => {
  it('returns "loaded" for a roll still in the camera regardless of any (stale) development', () => {
    expect(deriveRollState({ status: 'loaded', latest_development_status: null })).toBe('loaded')
    // Edge: a development was created but the roll was reverted to loaded — shouldn't break.
    expect(deriveRollState({ status: 'loaded', latest_development_status: 'dropped_off' })).toBe('loaded')
  })

  it('returns "archived" no matter what is in developments', () => {
    expect(deriveRollState({ status: 'archived', latest_development_status: 'delivered' })).toBe('archived')
    expect(deriveRollState({ status: 'archived', latest_development_status: null })).toBe('archived')
  })

  it('returns "finished" for finished rolls without an active development', () => {
    expect(deriveRollState({ status: 'finished', latest_development_status: null })).toBe('finished')
    expect(deriveRollState({ status: 'finished', latest_development_status: undefined })).toBe('finished')
  })

  it('treats a cancelled development the same as no development', () => {
    expect(deriveRollState({ status: 'finished', latest_development_status: 'cancelled' })).toBe('finished')
  })

  it('maps active development states to user-facing labels', () => {
    expect(deriveRollState({ status: 'finished', latest_development_status: 'dropped_off' })).toBe('at_lab')
    expect(deriveRollState({ status: 'finished', latest_development_status: 'in_progress' })).toBe('in_progress')
    expect(deriveRollState({ status: 'finished', latest_development_status: 'delivered' })).toBe('developed')
  })

  it('exposes a label and color for every derived state (no missing UI strings)', () => {
    const states = ['loaded', 'finished', 'at_lab', 'in_progress', 'developed', 'archived'] as const
    for (const s of states) {
      expect(DERIVED_STATE_LABELS[s]).toBeTruthy()
      expect(DERIVED_STATE_COLORS[s]).toBeTruthy()
    }
  })
})
