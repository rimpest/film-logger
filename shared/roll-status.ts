/**
 * Computes the displayed roll state from the underlying record + its latest
 * development. Pure function so server and client share the same logic.
 *
 * `rolls.status` only tracks the physical roll (loaded / finished / archived).
 * Anything development-related is derived from the most recent `developments`
 * row for the roll. Self-developed rolls (`lab_id == null`) get their own
 * derived state ("developing") so the UI doesn't claim the roll is "at lab"
 * when it's sitting in a darkroom.
 *
 * Translation of states to user-facing labels lives in i18n (`rollStatus.*`).
 * Color mapping stays here — it's UI semantics, not text.
 */

export type RollStatus = 'loaded' | 'finished' | 'archived'
export type DevelopmentStatus =
  | 'dropped_off'
  | 'in_progress'
  | 'delivered'
  | 'cancelled'

export type DerivedRollState =
  | 'loaded'
  | 'finished'
  | 'at_lab'
  | 'developing'   // self-dev in flight
  | 'in_progress'  // at lab, in_progress
  | 'developed'
  | 'archived'

export interface DerivedInput {
  status: RollStatus
  latest_development_status?: DevelopmentStatus | null
  /** null means self-developed, non-null means at a lab. Undefined = no dev row. */
  latest_development_lab_id?: number | null
}

export function deriveRollState(input: DerivedInput): DerivedRollState {
  if (input.status === 'archived') return 'archived'
  if (input.status === 'loaded') return 'loaded'

  const isSelfDev = input.latest_development_lab_id === null
  switch (input.latest_development_status) {
    case 'dropped_off':
      return isSelfDev ? 'developing' : 'at_lab'
    case 'in_progress':
      return isSelfDev ? 'developing' : 'in_progress'
    case 'delivered':
      return 'developed'
    case 'cancelled':
    case null:
    case undefined:
    default:
      return 'finished'
  }
}

/**
 * UI color tokens for each derived state. Kept here (not in i18n) because
 * they're presentation semantics that don't depend on language.
 */
export const DERIVED_STATE_COLORS: Record<
  DerivedRollState,
  'primary' | 'success' | 'warning' | 'info' | 'neutral'
> = {
  loaded: 'primary',
  finished: 'warning',
  at_lab: 'info',
  developing: 'info',
  in_progress: 'info',
  developed: 'success',
  archived: 'neutral',
}

/**
 * The set of all derived states, in canonical display order. Useful when
 * building filter dropdowns so we don't drift between server and client.
 */
export const ALL_DERIVED_STATES: readonly DerivedRollState[] = [
  'loaded',
  'finished',
  'at_lab',
  'developing',
  'in_progress',
  'developed',
  'archived',
] as const
