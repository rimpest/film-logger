import { describe, it, expect } from 'vitest'
import {
  ALL_DERIVED_STATES,
  DERIVED_STATE_COLORS,
  deriveRollState,
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

  describe('lab vs self-developed disambiguation', () => {
    it('maps dropped_off + lab_id to "at_lab"', () => {
      expect(deriveRollState({
        status: 'finished',
        latest_development_status: 'dropped_off',
        latest_development_lab_id: 7,
      })).toBe('at_lab')
    })

    it('maps dropped_off + null lab_id (self-developed) to "developing"', () => {
      expect(deriveRollState({
        status: 'finished',
        latest_development_status: 'dropped_off',
        latest_development_lab_id: null,
      })).toBe('developing')
    })

    it('maps in_progress + lab_id to "in_progress"', () => {
      expect(deriveRollState({
        status: 'finished',
        latest_development_status: 'in_progress',
        latest_development_lab_id: 7,
      })).toBe('in_progress')
    })

    it('maps in_progress + null lab_id to "developing"', () => {
      expect(deriveRollState({
        status: 'finished',
        latest_development_status: 'in_progress',
        latest_development_lab_id: null,
      })).toBe('developing')
    })

    it('maps delivered to "developed" regardless of lab_id', () => {
      expect(deriveRollState({
        status: 'finished',
        latest_development_status: 'delivered',
        latest_development_lab_id: null,
      })).toBe('developed')
      expect(deriveRollState({
        status: 'finished',
        latest_development_status: 'delivered',
        latest_development_lab_id: 7,
      })).toBe('developed')
    })

    it('treats undefined lab_id (no dev row joined yet) as not-self-developed', () => {
      // When there's a status but lab_id wasn't sent, we can't claim self-dev.
      // Behaviour: fall through to the at_lab/in_progress branches.
      expect(deriveRollState({
        status: 'finished',
        latest_development_status: 'dropped_off',
        // latest_development_lab_id omitted
      })).toBe('at_lab')
    })
  })

  it('exposes a color for every derived state', () => {
    for (const s of ALL_DERIVED_STATES) {
      expect(DERIVED_STATE_COLORS[s]).toBeTruthy()
    }
  })
})
