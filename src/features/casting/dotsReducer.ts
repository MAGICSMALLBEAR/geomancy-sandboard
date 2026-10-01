/** State machine for the sixteen-row sand casting (SPEC §6). Only confirmed rows ever come from storage. */
import type { Draft } from '../../domain/contracts.ts';
import type { AppErrorCode } from '../../infrastructure/errors.ts';
import { ROW_MAX_DOTS } from '../../infrastructure/records.ts';

export type DotsPhase = 'collecting' | 'saving' | 'reveal' | 'mother-review' | 'finalizing';
export type DotsState = {
  phase: DotsPhase;
  /** Dots of the current, not yet confirmed row. Never persisted. */
  count: number;
  confirmed: number[];
  revision: number;
  capped: boolean;
  error: AppErrorCode | null;
};
export type DotsAction =
  | { type: 'tap' }
  | { type: 'clear' }
  | { type: 'confirm-start' }
  | { type: 'confirm-ok'; draft: Draft }
  | { type: 'confirm-fail'; code: AppErrorCode }
  | { type: 'reveal-done' }
  | { type: 'continue' }
  | { type: 'reload'; draft: Draft };

const afterRows = (rows: number): DotsPhase =>
  rows >= 16 ? 'finalizing' : rows > 0 && rows % 4 === 0 ? 'mother-review' : 'collecting';

export function initDots(draft: Draft): DotsState {
  return { phase: afterRows(draft.confirmedCounts.length), count: 0, confirmed: [...draft.confirmedCounts],
    revision: draft.revision, capped: false, error: null };
}

export const canConfirm = (s: DotsState): boolean => s.phase === 'collecting' && s.count >= 1;

export function dotsReducer(state: DotsState, action: DotsAction): DotsState {
  switch (action.type) {
    case 'tap':
      if (state.phase !== 'collecting') return state;
      if (state.count >= ROW_MAX_DOTS) return { ...state, capped: true };
      return { ...state, count: state.count + 1, error: null };
    case 'clear':
      return state.phase === 'collecting' ? { ...state, count: 0, capped: false, error: null } : state;
    case 'confirm-start':
      return canConfirm(state) ? { ...state, phase: 'saving', error: null } : state;
    case 'confirm-ok':
      if (state.phase !== 'saving') return state;
      return { ...state, phase: 'reveal', confirmed: [...action.draft.confirmedCounts], revision: action.draft.revision,
        capped: false, error: null };
    case 'confirm-fail':
      // Same row, same count: a retry must store exactly what the user tapped.
      return state.phase === 'saving' ? { ...state, phase: 'collecting', error: action.code } : state;
    case 'reveal-done':
      return state.phase === 'reveal' ? { ...state, phase: afterRows(state.confirmed.length), count: 0 } : state;
    case 'continue':
      return state.phase === 'mother-review' ? { ...state, phase: 'collecting', count: 0 } : state;
    case 'reload':
      return initDots(action.draft);
  }
}
