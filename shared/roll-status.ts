/**
 * Computes the displayed roll state from the underlying record + its latest development.
 * Pure function so both server and client use the same logic.
 *
 * `rolls.status` only tracks the physical roll (loaded / finished / archived).
 * Development-related state is derived from `developments`.
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
  | 'in_progress'
  | 'developed'
  | 'archived'

export interface DerivedInput {
  status: RollStatus
  latest_development_status?: DevelopmentStatus | null
}

export function deriveRollState(input: DerivedInput): DerivedRollState {
  if (input.status === 'archived') return 'archived'
  if (input.status === 'loaded') return 'loaded'
  switch (input.latest_development_status) {
    case 'dropped_off': return 'at_lab'
    case 'in_progress': return 'in_progress'
    case 'delivered': return 'developed'
    case 'cancelled':
    case null:
    case undefined:
    default:
      return 'finished'
  }
}

export const DERIVED_STATE_LABELS: Record<DerivedRollState, string> = {
  loaded: 'Loaded',
  finished: 'Finished',
  at_lab: 'At lab',
  in_progress: 'In progress',
  developed: 'Developed',
  archived: 'Archived',
}

export const DERIVED_STATE_COLORS: Record<DerivedRollState, 'primary' | 'success' | 'warning' | 'info' | 'neutral'> = {
  loaded: 'primary',
  finished: 'warning',
  at_lab: 'info',
  in_progress: 'info',
  developed: 'success',
  archived: 'neutral',
}
